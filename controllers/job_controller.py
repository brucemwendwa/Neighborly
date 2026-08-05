"""
The quote marketplace — requests, bids, and the job history.

A resident who already knows which plumber they want books them directly;
that path is untouched and still lives in booking_controller.py. This file is
the other path: the resident describes the job, providers in the estate bid on
it, and accepting a bid is what creates the booking.

    open ──▶ quoting ──▶ assigned ──▶ completed
      │         │            │
      └─────────┴────────────┴──────▶ cancelled

Accepting a quote is the hinge. It does five things in one transaction, so
there is no window where a request is spoken for but no booking exists:

    1. the winning quote     -> accepted
    2. every other quote     -> rejected
    3. the request           -> assigned
    4. a Booking is created, carrying the quoted amount
    5. an 'accepted' event is written to the trail
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import select
from werkzeug.exceptions import Forbidden

from extensions import db
from models import (
    Booking,
    JobQuote,
    JobStatusEvent,
    Service,
    ServiceCategory,
    ServiceRequest,
)
from schemas import (
    JobQuoteInputSchema,
    JobQuoteSchema,
    ServiceRequestInputSchema,
    ServiceRequestListSchema,
    ServiceRequestSchema,
    ServiceRequestUpdateSchema,
)
from controllers.utils import (
    body,
    delete,
    get_or_404,
    is_admin,
    notify,
    paginate,
    query_arg,
    save,
)

job_bp = Blueprint("jobs", __name__)

request_schema = ServiceRequestSchema()
quote_schema = JobQuoteSchema()

# A request stops taking bids once it is spoken for. Without this a provider
# could quote on a job that already has someone on the way to it.
OPEN_TO_QUOTES = ("open", "quoting")


def record(event_type, *, request=None, booking=None, note=None):
    """Append one line to the job's history.

    Every status change goes through here rather than each handler writing
    its own row, so no transition can be made without leaving a trace.
    """
    db.session.add(
        JobStatusEvent(
            request_id=request.request_id if request else None,
            booking_id=booking.booking_id if booking else None,
            event_type=event_type,
            actor_id=current_user.user_id,
            note=note,
        )
    )


def owner_or_403(service_request):
    """Only the resident who posted it, or an admin, may change a request."""
    if is_admin() or service_request.resident_id == current_user.user_id:
        return
    raise Forbidden("This request is not yours.")


def approved_provider_or_error():
    """The provider profile allowed to bid, or a reason it is not."""
    profile = current_user.provider_profile
    if profile is None:
        return None, (jsonify(error="You do not have a provider profile yet."), 404)
    if not profile.is_approved:
        return None, (
            jsonify(
                error="Your provider profile is awaiting approval, so you "
                "cannot quote on jobs yet."
            ),
            403,
        )
    return profile, None


@job_bp.get("")
@jwt_required()
def list_requests():
    """GET /api/requests?mine=true&status=&kind=&page=

    Defaults to the estate's open board — what a provider looking for work
    sees. `?mine=true` narrows it to the caller's own requests.
    """
    stmt = select(ServiceRequest)

    if query_arg("mine") == "true":
        stmt = stmt.where(ServiceRequest.resident_id == current_user.user_id)
    elif is_admin() and query_arg("all") == "true":
        pass  # admins can see every estate's board
    else:
        # Everyone else sees their own estate only. A request names a house
        # and a budget, so it does not travel outside the community.
        if not current_user.estate_id:
            return jsonify(items=[], page=1, per_page=0, total=0, pages=0)
        stmt = stmt.where(ServiceRequest.estate_id == current_user.estate_id)
        stmt = stmt.where(ServiceRequest.status.in_(OPEN_TO_QUOTES))

    if status := query_arg("status"):
        stmt = stmt.where(ServiceRequest.status == status)
    if kind := query_arg("kind"):
        stmt = stmt.where(ServiceRequest.kind == kind)

    stmt = stmt.order_by(ServiceRequest.created_at.desc())
    return jsonify(paginate(stmt, ServiceRequestListSchema))


@job_bp.get("/<request_id>")
@jwt_required()
def get_request(request_id):
    """GET /api/requests/<id> — the request with its quotes and timeline."""
    service_request = get_or_404(ServiceRequest, request_id, "Request")

    # A provider needs to read the job to bid on it, so this is estate-wide
    # rather than owner-only. The quotes it embeds are the competing bids,
    # which is the same information the pricing on any job board is built on.
    if not is_admin() and service_request.estate_id != current_user.estate_id:
        raise Forbidden("That request is in another estate.")

    return jsonify(request=request_schema.dump(service_request))


@job_bp.post("")
@jwt_required()
def create_request():
    """POST /api/requests — a resident puts a job out for quotes."""
    data = body(ServiceRequestInputSchema)

    if not current_user.estate_id:
        return jsonify(
            error="Set your estate on your profile before posting a request."
        ), 400

    # Validate whichever of the two the client sent, so a typo in an id
    # fails here rather than producing a request nobody can find.
    if data.get("service_id"):
        get_or_404(Service, data["service_id"], "Service")
    if data.get("category_id"):
        get_or_404(ServiceCategory, data["category_id"], "Category")

    service_request = ServiceRequest(
        resident_id=current_user.user_id,
        estate_id=current_user.estate_id,
        service_id=data.get("service_id"),
        category_id=data.get("category_id"),
        kind=data["kind"],
        title=data["title"],
        description=data.get("description"),
        budget_min=data.get("budget_min"),
        budget_max=data.get("budget_max"),
        scheduled_for=data.get("scheduled_for"),
        status="open",
    )
    db.session.add(service_request)
    db.session.flush()  # assigns the id the event row needs
    record("created", request=service_request)
    save(service_request)

    return jsonify(request=request_schema.dump(service_request)), 201


@job_bp.patch("/<request_id>")
@jwt_required()
def update_request(request_id):
    """PATCH /api/requests/<id> — edit the wording or the budget."""
    service_request = get_or_404(ServiceRequest, request_id, "Request")
    owner_or_403(service_request)

    if service_request.status not in OPEN_TO_QUOTES:
        return jsonify(
            error="This request has already been assigned, so it can no "
            "longer be edited."
        ), 409

    data = body(ServiceRequestUpdateSchema, partial=True)
    for field, value in data.items():
        setattr(service_request, field, value)

    save(service_request)
    return jsonify(request=request_schema.dump(service_request))


@job_bp.delete("/<request_id>")
@jwt_required()
def cancel_request(request_id):
    """DELETE /api/requests/<id> — the resident calls it off.

    The row is kept and marked cancelled rather than deleted: providers who
    spent time quoting should still find it in their history, and deleting it
    would take their quotes with it.
    """
    service_request = get_or_404(ServiceRequest, request_id, "Request")
    owner_or_403(service_request)

    if service_request.status == "assigned":
        return jsonify(
            error="This request already has a booking. Cancel the booking instead."
        ), 409

    service_request.status = "cancelled"
    for quote in service_request.quotes:
        if quote.status == "pending":
            quote.status = "rejected"
            notify(
                quote.provider.user_id,
                "Request withdrawn",
                f"{current_user.full_name} withdrew “{service_request.title}”.",
                type="booking",
            )

    record("cancelled", request=service_request)
    save(service_request)
    return jsonify(request=request_schema.dump(service_request))


# --- Quotes ---------------------------------------------------------------


@job_bp.post("/<request_id>/quotes")
@jwt_required()
def create_quote(request_id):
    """POST /api/requests/<id>/quotes — a provider bids."""
    service_request = get_or_404(ServiceRequest, request_id, "Request")

    profile, error = approved_provider_or_error()
    if error:
        return error

    if service_request.estate_id != profile.user.estate_id:
        return jsonify(error="That request is in another estate."), 403
    if service_request.status not in OPEN_TO_QUOTES:
        return jsonify(error="This request is no longer taking quotes."), 409
    if service_request.resident_id == current_user.user_id:
        return jsonify(error="You cannot quote on your own request."), 409

    existing = db.session.scalar(
        select(JobQuote)
        .where(JobQuote.request_id == request_id)
        .where(JobQuote.provider_id == profile.provider_id)
    )
    if existing and existing.status != "withdrawn":
        return jsonify(
            error="You have already quoted on this request. Withdraw that "
            "quote first if you want to re-price it."
        ), 409

    data = body(JobQuoteInputSchema)

    if existing:
        # Re-using the withdrawn row keeps the one-bid-per-provider constraint
        # satisfied without the provider having to be told about it.
        existing.amount = data["amount"]
        existing.message = data.get("message")
        existing.eta_minutes = data.get("eta_minutes")
        existing.status = "pending"
        quote = existing
    else:
        quote = JobQuote(
            request_id=request_id,
            provider_id=profile.provider_id,
            amount=data["amount"],
            message=data.get("message"),
            eta_minutes=data.get("eta_minutes"),
        )
        db.session.add(quote)

    # First bid moves the request out of 'open' so the resident's list can
    # show "3 quotes" rather than making them open every row to find out.
    if service_request.status == "open":
        service_request.status = "quoting"

    record("quoted", request=service_request, note=f"{profile.business_name} quoted")
    notify(
        service_request.resident_id,
        "New quote received",
        f"{profile.business_name} quoted KES {data['amount']} for "
        f"“{service_request.title}”.",
        type="booking",
    )
    save(quote, service_request)

    return jsonify(quote=quote_schema.dump(quote)), 201


@job_bp.delete("/<request_id>/quotes/mine")
@jwt_required()
def withdraw_quote(request_id):
    """DELETE /api/requests/<id>/quotes/mine — the provider pulls out."""
    profile, error = approved_provider_or_error()
    if error:
        return error

    quote = db.session.scalar(
        select(JobQuote)
        .where(JobQuote.request_id == request_id)
        .where(JobQuote.provider_id == profile.provider_id)
    )
    if quote is None:
        return jsonify(error="You have not quoted on this request."), 404
    if quote.status == "accepted":
        return jsonify(
            error="This quote was accepted. Cancel the booking instead."
        ), 409

    quote.status = "withdrawn"
    save(quote)
    return jsonify(quote=quote_schema.dump(quote))


@job_bp.post("/<request_id>/quotes/<quote_id>/accept")
@jwt_required()
def accept_quote(request_id, quote_id):
    """POST /api/requests/<id>/quotes/<quote_id>/accept.

    The hinge between the marketplace and the rest of the platform: this is
    what turns a request into a Booking, and from there payments, gate passes
    and reviews all work exactly as they do for a direct booking.
    """
    service_request = get_or_404(ServiceRequest, request_id, "Request")
    owner_or_403(service_request)

    if service_request.status not in OPEN_TO_QUOTES:
        return jsonify(error="This request has already been assigned."), 409

    quote = get_or_404(JobQuote, quote_id, "Quote")
    if quote.request_id != request_id:
        return jsonify(error="That quote belongs to another request."), 400
    if quote.status != "pending":
        return jsonify(error=f"That quote is {quote.status}."), 409

    # A request may name a category rather than a service, but a Booking
    # always needs a concrete service — fall back to the provider's own.
    service_id = service_request.service_id
    if not service_id:
        offered = quote.provider.services
        if not offered:
            return jsonify(
                error="That provider has no service to book this against."
            ), 409
        service_id = offered[0].service_id

    booking = Booking(
        user_id=service_request.resident_id,
        estate_id=service_request.estate_id,
        service_id=service_id,
        provider_id=quote.provider_id,
        request_id=service_request.request_id,
        booking_type="quotation",
        status="accepted",  # a quote the resident chose is already agreed
        scheduled_date=service_request.scheduled_for,
        total_amount=quote.amount,
    )
    db.session.add(booking)

    quote.status = "accepted"
    for other in service_request.quotes:
        if other.quote_id != quote.quote_id and other.status == "pending":
            other.status = "rejected"
            notify(
                other.provider.user_id,
                "Quote not accepted",
                f"Another provider was chosen for “{service_request.title}”.",
                type="booking",
            )

    service_request.status = "assigned"
    db.session.flush()  # booking id, for the event row below
    record(
        "accepted",
        request=service_request,
        booking=booking,
        note=f"{quote.provider.business_name} accepted at KES {quote.amount}",
    )

    notify(
        quote.provider.user_id,
        "Your quote was accepted",
        f"You won “{service_request.title}”. The job is now in your bookings.",
        type="booking",
    )
    save(booking, quote, service_request)

    return jsonify(
        request=request_schema.dump(service_request),
        booking_id=booking.booking_id,
    ), 201
