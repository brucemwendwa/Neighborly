"""
Bookings — the hub of the platform.

Most of this file is one rule expressed carefully: a booking may only move
between certain statuses, and only certain people may move it. Everything
else (who can see it, what a new one costs) falls out of that.

    pending ──▶ accepted ──▶ in_progress ──▶ completed
       │           │              │
       └───────────┴──────────────┴────────▶ cancelled
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import or_, select
from werkzeug.exceptions import Forbidden

from models import Booking, Service, ServiceProvider
from schemas import BookingCreateSchema, BookingSchema, BookingUpdateSchema
from controllers.utils import (
    body,
    delete,
    get_or_404,
    is_admin,
    notify,
    paginate,
    query_arg,
    record_event,
    save,
)

booking_bp = Blueprint("bookings", __name__)

booking_schema = BookingSchema()

# Which statuses each status may move to. A booking that has reached
# 'completed' or 'cancelled' is finished — reopening it would let a
# provider quietly un-complete a job after being reviewed.
TRANSITIONS = {
    "pending": {"accepted", "cancelled"},
    "accepted": {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}

# Which *role in this booking* may request each status.
# The customer can call the whole thing off; only the person doing the work
# can say it has started or finished.
WHO_MAY_SET = {
    "accepted": ("provider", "admin"),
    "in_progress": ("provider", "admin"),
    "completed": ("provider", "admin"),
    "cancelled": ("customer", "provider", "admin"),
}

# Statuses and events are deliberately different vocabularies. A status says
# where the work *is* and is overwritten on every move; an event says what
# *happened* and is kept forever. 'in_progress' is a state, 'started' is the
# thing that caused it.
STATUS_EVENTS = {
    "accepted": "accepted",
    "in_progress": "started",
    "completed": "completed",
    "cancelled": "cancelled",
}


def party(booking, user):
    """What is this user to this booking: customer, provider, admin, or None?"""
    if user.role == "admin":
        return "admin"
    if booking.user_id == user.user_id:
        return "customer"
    if booking.provider and booking.provider.user_id == user.user_id:
        return "provider"
    return None


def visible_or_403(booking):
    role = party(booking, current_user)
    if role is None:
        raise Forbidden("This booking is not yours.")
    return role


@booking_bp.get("")
@jwt_required()
def list_bookings():
    """GET /api/bookings?as=customer|provider&status=&page=

    Defaults to "anything I am involved in", which is what the bookings
    screen shows. A provider who also books services sees both, and can
    split them with ?as=.
    """
    stmt = select(Booking)
    as_role = query_arg("as")

    if is_admin() and query_arg("all") == "true":
        pass  # admins can ask for the whole estate's traffic
    elif as_role == "customer":
        stmt = stmt.where(Booking.user_id == current_user.user_id)
    elif as_role == "provider":
        profile = current_user.provider_profile
        if profile is None:
            return jsonify(items=[], page=1, per_page=0, total=0, pages=0)
        stmt = stmt.where(Booking.provider_id == profile.provider_id)
    else:
        mine = [Booking.user_id == current_user.user_id]
        if current_user.provider_profile:
            mine.append(
                Booking.provider_id == current_user.provider_profile.provider_id
            )
        stmt = stmt.where(or_(*mine))

    if status := query_arg("status"):
        stmt = stmt.where(Booking.status == status)
    if estate_id := query_arg("estate_id"):
        stmt = stmt.where(Booking.estate_id == estate_id)

    return jsonify(paginate(stmt.order_by(Booking.created_at.desc()), BookingSchema))


@booking_bp.get("/available")
@jwt_required()
def available_jobs():
    """GET /api/bookings/available — the open job board for providers.

    Unassigned, still pending, and inside the provider's own estate. This
    is how a plumber finds work rather than waiting to be picked.
    """
    profile = current_user.provider_profile
    if profile is None:
        return jsonify(error="You do not have a provider profile yet."), 404
    if not profile.is_approved:
        return jsonify(
            error="Your provider profile is awaiting approval, so you cannot "
            "take jobs yet."
        ), 403

    stmt = (
        select(Booking)
        .where(Booking.provider_id.is_(None))
        .where(Booking.status == "pending")
        .where(Booking.estate_id == current_user.estate_id)
        .order_by(Booking.created_at.desc())
    )
    return jsonify(paginate(stmt, BookingSchema))


@booking_bp.get("/<booking_id>")
@jwt_required()
def get_booking(booking_id):
    """GET /api/bookings/<id> — customer, assigned provider or admin only."""
    booking = get_or_404(Booking, booking_id, "Booking")
    visible_or_403(booking)
    return jsonify(booking=booking_schema.dump(booking))


@booking_bp.post("")
@jwt_required()
def create_booking():
    """POST /api/bookings — a resident orders a service.

    The customer and the estate come from the token, never the body. The
    price falls back to the service's base price so the client can post
    the minimum: {"service_id": "..."}.
    """
    data = body(BookingCreateSchema)

    if not current_user.estate_id:
        return jsonify(
            error="Set your estate on your profile before booking a service."
        ), 400

    service = get_or_404(Service, data["service_id"], "Service")

    provider = None
    if data.get("provider_id"):
        provider = get_or_404(ServiceProvider, data["provider_id"], "Provider")
        if not provider.is_approved:
            return jsonify(error="That provider is not approved to take jobs."), 409

    booking = Booking(
        user_id=current_user.user_id,
        estate_id=current_user.estate_id,
        service_id=service.service_id,
        provider_id=provider.provider_id if provider else None,
        booking_type=data["booking_type"],
        scheduled_date=data.get("scheduled_date"),
        total_amount=(
            data["total_amount"] if data.get("total_amount") is not None
            else service.base_price
        ),
    )

    if provider:
        notify(
            provider.user_id,
            "New booking request",
            f"{current_user.full_name} requested {service.name}.",
            type="booking",
        )

    save(booking)
    return jsonify(booking=booking_schema.dump(booking)), 201


@booking_bp.post("/<booking_id>/accept")
@jwt_required()
def accept_booking(booking_id):
    """POST /api/bookings/<id>/accept — a provider claims an open job.

    Separate from the general PATCH because it does two things at once:
    assigns the provider *and* moves the status. Doing it in one request
    means a job cannot end up accepted by nobody.
    """
    booking = get_or_404(Booking, booking_id, "Booking")
    profile = current_user.provider_profile

    if profile is None or not profile.is_approved:
        return jsonify(error="Only an approved provider can accept jobs."), 403
    if booking.status != "pending":
        return jsonify(error=f"This booking is already {booking.status}."), 409
    if booking.provider_id and booking.provider_id != profile.provider_id:
        return jsonify(error="Another provider has already taken this job."), 409

    booking.provider_id = profile.provider_id
    booking.status = "accepted"
    # Claiming a job is a status change like any other, so it belongs in the
    # trail too — otherwise a directly-booked job's history starts at
    # "started", with no record of who picked it up or when.
    log_transition(booking, "accepted")

    notify(
        booking.user_id,
        "Booking accepted",
        f"{current_user.full_name} accepted your {booking.service.name} booking.",
        type="booking",
    )
    save(booking)
    return jsonify(booking=booking_schema.dump(booking))


@booking_bp.patch("/<booking_id>")
@jwt_required()
def update_booking(booking_id):
    """PATCH /api/bookings/<id> — move the status, or adjust the details.

    Two gates on a status change, and both have to pass: the transition
    must be legal for the current status, and the caller must be entitled
    to ask for it.
    """
    booking = get_or_404(Booking, booking_id, "Booking")
    role = visible_or_403(booking)
    data = body(BookingUpdateSchema, partial=True)

    # One PATCH can do two different things, so they are handled by two
    # named functions below. Each returns an error response when it refuses,
    # or None when it applied the change.
    new_status = data.pop("status", None)

    if new_status and new_status != booking.status:
        refused = change_status(booking, role, new_status)
        if refused:
            return refused

    if data:
        refused = edit_details(booking, role, data)
        if refused:
            return refused

    save(booking)
    return jsonify(booking=booking_schema.dump(booking))


def change_status(booking, role, new_status):
    """Move the booking to `new_status`, or refuse and say why.

    Two gates, and both have to pass:
      1. is the transition legal from where the booking is now?
      2. is this person entitled to ask for it?
    """
    if new_status not in TRANSITIONS[booking.status]:
        return jsonify(
            error=f"A {booking.status} booking cannot become {new_status}."
        ), 409

    if role not in WHO_MAY_SET[new_status]:
        return jsonify(
            error=f"As the {role} you cannot mark this booking {new_status}."
        ), 403

    booking.status = new_status
    log_transition(booking, new_status)
    announce_status(booking, role, new_status)
    return None


def log_transition(booking, new_status):
    """Write the move to the job trail, and close the request behind it.

    Two things were falling through the gap between this file and
    job_controller.py. A booking made from an accepted quote leaves its
    ServiceRequest alive alongside it, and nothing moved that request off
    'assigned' — so a finished job sat on the resident's board forever, and
    the 'completed' status declared in REQUEST_STATUSES was never once
    reached. The trail had the same break: events stopped at the moment the
    quote was accepted, because only job_controller wrote them.

    Both halves now write to the same history, so the resident reads one
    timeline from "posted" through to "completed" rather than one that ends
    where the work actually begins.
    """
    record_event(
        STATUS_EVENTS[new_status],
        request=booking.request,
        booking=booking,
        note=f"{current_user.full_name} marked it {new_status.replace('_', ' ')}",
    )

    # A direct booking has no request behind it; only the quoted path does.
    if booking.request and new_status in ("completed", "cancelled"):
        booking.request.status = new_status


def edit_details(booking, role, data):
    """Change the price, the schedule or the provider.

    Only negotiable before work starts: renegotiating the price of a job
    that is already finished is not an edit, it is a dispute.
    """
    if booking.status not in ("pending", "accepted"):
        return jsonify(
            error=f"A {booking.status} booking's details can no longer be changed."
        ), 409

    if "provider_id" in data and role == "provider":
        return jsonify(error="Only the customer can reassign a booking."), 403

    for field, value in data.items():
        setattr(booking, field, value)
    return None


def announce_status(booking, actor_role, status):
    """Tell the *other* party what just happened."""
    service_name = booking.service.name if booking.service else "your booking"
    messages = {
        "in_progress": ("Work has started", f"Your {service_name} job is under way."),
        "completed": (
            "Booking completed",
            f"Your {service_name} job is done. Leave a review to help your neighbours.",
        ),
        "cancelled": ("Booking cancelled", f"The {service_name} booking was cancelled."),
        "accepted": ("Booking accepted", f"Your {service_name} booking was accepted."),
    }
    title, message = messages[status]

    # The person who acted already knows; notify the counterpart.
    if actor_role == "customer" and booking.provider:
        notify(booking.provider.user_id, title, message, type="booking")
    elif actor_role != "customer":
        notify(booking.user_id, title, message, type="booking")


@booking_bp.delete("/<booking_id>")
@jwt_required()
def delete_booking(booking_id):
    """DELETE /api/bookings/<id>.

    Only while it is still pending, and only by the customer or an admin.
    Once money or a review is attached, cancel it instead — deleting would
    destroy the record of what happened.
    """
    booking = get_or_404(Booking, booking_id, "Booking")
    role = visible_or_403(booking)

    if role not in ("customer", "admin"):
        return jsonify(error="Only the customer can delete a booking."), 403
    if booking.status != "pending" and not is_admin():
        return jsonify(error="Cancel the booking instead of deleting it."), 409
    if booking.payments or booking.reviews:
        return jsonify(
            error="This booking has payments or reviews attached and cannot be "
            "deleted."
        ), 409

    delete(booking)
    return jsonify(message="Booking deleted.")
