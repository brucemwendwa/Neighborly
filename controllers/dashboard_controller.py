"""
Dashboard — the numbers the landing screen shows once you are signed in.

One endpoint instead of the client firing eight list requests and counting
the results. Everything is a COUNT or a SUM in SQL, so the response stays
small no matter how much history an account has.
"""

from decimal import Decimal

from flask import Blueprint, jsonify
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import func, select

from extensions import db
from models import (
    Booking,
    JobQuote,
    CommuteRide,
    GatePass,
    HouseListing,
    MoveRequest,
    Notification,
    Payment,
    RideBooking,
    Service,
    ServiceCategory,
    ServiceProvider,
    ServiceRequest,
    User,
)
from models.base import utcnow
from schemas import BookingSchema, CommuteRideSchema, NotificationSchema
from controllers.utils import role_required

dashboard_bp = Blueprint("dashboard", __name__)


def count(stmt):
    """How many rows would this query return?

    Takes a normal `select(Model).where(...)` and swaps the columns for
    COUNT(*), keeping the WHERE clause. So this:

        select(Booking).where(Booking.status == "pending")

    is sent to the database as:

        SELECT count(*) FROM bookings WHERE status = 'pending'

    That matters: the alternative — loading every booking and calling len()
    in Python — pulls the whole table over the wire to produce one number.
    `order_by(None)` drops any sort, which a COUNT has no use for.

    `maintain_column_froms=True` is load-bearing. Without it,
    with_only_columns() re-derives the FROM clause from the *new* columns,
    and `func.count()` names no table — so a query with a WHERE clause still
    found its table (inferred from the WHERE) while an unfiltered
    `select(User)` degraded to a bare `SELECT count(*)` with no FROM, which
    returns one row: every total on the admin dashboard read 1 no matter how
    much data existed. Keeping the original FROM makes both cases correct.
    """
    return db.session.scalar(
        stmt.with_only_columns(func.count(), maintain_column_froms=True).order_by(None)
    ) or 0


@dashboard_bp.get("")
@jwt_required()
def dashboard():
    """GET /api/dashboard — a summary for whoever is asking."""
    uid = current_user.user_id

    active_bookings = count(
        select(Booking).where(
            Booking.user_id == uid,
            Booking.status.in_(("pending", "accepted", "in_progress")),
        )
    )
    spent = db.session.scalar(
        select(func.sum(Payment.amount)).where(
            Payment.user_id == uid, Payment.status == "success"
        )
    ) or Decimal("0")

    summary = {
        "active_bookings": active_bookings,
        "completed_bookings": count(
            select(Booking).where(Booking.user_id == uid, Booking.status == "completed")
        ),
        "total_spent": str(spent),
        "wallet_balance": str(current_user.wallet.balance if current_user.wallet else 0),
        "unread_notifications": count(
            select(Notification).where(
                Notification.user_id == uid, Notification.is_read.is_(False)
            )
        ),
        "active_gate_passes": count(
            select(GatePass).where(GatePass.user_id == uid, GatePass.status == "active")
        ),
        "my_listings": count(select(HouseListing).where(HouseListing.user_id == uid)),
        "open_moves": count(
            select(MoveRequest).where(
                MoveRequest.user_id == uid,
                MoveRequest.status.in_(("pending", "assigned", "in_progress")),
            )
        ),
        "rides_offered": count(
            select(CommuteRide).where(
                CommuteRide.driver_id == uid, CommuteRide.status == "active"
            )
        ),
        "seats_claimed": count(
            select(RideBooking).where(
                RideBooking.passenger_id == uid, RideBooking.status == "booked"
            )
        ),
    }

    # A provider gets their side of the ledger too.
    if current_user.provider_profile:
        pid = current_user.provider_profile.provider_id
        summary["jobs_pending"] = count(
            select(Booking).where(
                Booking.provider_id == pid,
                Booking.status.in_(("pending", "accepted", "in_progress")),
            )
        )
        summary["jobs_completed"] = count(
            select(Booking).where(
                Booking.provider_id == pid, Booking.status == "completed"
            )
        )
        earned = db.session.scalar(
            select(func.sum(Payment.amount))
            .join(Booking, Payment.booking_id == Booking.booking_id)
            .where(Booking.provider_id == pid, Payment.status == "success")
        ) or Decimal("0")
        summary["total_earned"] = str(earned)
        summary["is_approved"] = current_user.provider_profile.is_approved

    upcoming_rides = db.session.scalars(
        select(CommuteRide)
        .where(
            CommuteRide.estate_id == current_user.estate_id,
            CommuteRide.status == "active",
            CommuteRide.departure_time >= utcnow(),
        )
        .order_by(CommuteRide.departure_time)
        .limit(3)
    ).all()

    recent_bookings = db.session.scalars(
        select(Booking)
        .where(Booking.user_id == uid)
        .order_by(Booking.created_at.desc())
        .limit(5)
    ).all()

    recent_notifications = db.session.scalars(
        select(Notification)
        .where(Notification.user_id == uid)
        .order_by(Notification.created_at.desc())
        .limit(5)
    ).all()

    return jsonify(
        summary=summary,
        recent_bookings=BookingSchema(many=True).dump(recent_bookings),
        upcoming_rides=CommuteRideSchema(many=True).dump(upcoming_rides),
        recent_notifications=NotificationSchema(many=True).dump(recent_notifications),
    )


@dashboard_bp.get("/admin")
@role_required("admin")
def admin_dashboard():
    """GET /api/dashboard/admin — platform-wide totals and the review queue."""
    return jsonify(
        summary={
            "users": count(select(User)),
            "residents": count(select(User).where(User.role == "resident")),
            "providers": count(select(User).where(User.role == "provider")),
            "providers_awaiting_approval": count(
                select(ServiceProvider).where(ServiceProvider.is_approved.is_(False))
            ),
            "bookings": count(select(Booking)),
            "bookings_pending": count(
                select(Booking).where(Booking.status == "pending")
            ),
            "listings": count(select(HouseListing)),
            "listings_unverified": count(
                select(HouseListing).where(HouseListing.is_verified.is_(False))
            ),
            "rides_active": count(
                select(CommuteRide).where(CommuteRide.status == "active")
            ),
            "moves_open": count(
                select(MoveRequest).where(MoveRequest.status != "completed")
            ),
            "revenue": str(
                db.session.scalar(
                    select(func.sum(Payment.amount)).where(Payment.status == "success")
                )
                or Decimal("0")
            ),
        }
    )


@dashboard_bp.get("/insights")
@role_required("admin")
def insights():
    """GET /api/dashboard/insights — the analytics the admin overview shows.

    Three queries that each do real work in SQL rather than in Python:

      1. revenue by category — joins bookings -> services -> categories,
         groups by category, and uses HAVING to drop categories nobody has
         ever booked. Counting in Python would mean pulling every booking
         row across the wire to throw most of them away.

      2. top providers — joins providers -> users -> bookings, aggregates
         completed jobs and money earned per provider, and orders by the
         aggregate. HAVING again, so providers with nothing completed do
         not occupy the leaderboard.

      3. busiest requesters — groups the marketplace by resident and counts
         the quotes their requests attracted, which needs both the request
         and quote tables in one statement.
    """
    # 1. Revenue and volume per service category.
    by_category = db.session.execute(
        select(
            ServiceCategory.name,
            func.count(Booking.booking_id).label("bookings"),
            func.coalesce(func.sum(Booking.total_amount), 0).label("value"),
        )
        .join(Service, Service.category_id == ServiceCategory.category_id)
        .join(Booking, Booking.service_id == Service.service_id)
        .group_by(ServiceCategory.category_id)
        .having(func.count(Booking.booking_id) > 0)
        .order_by(func.sum(Booking.total_amount).desc())
    ).all()

    # 2. Providers ranked by completed work.
    top_providers = db.session.execute(
        select(
            User.full_name,
            func.count(Booking.booking_id).label("jobs"),
            func.coalesce(func.sum(Booking.total_amount), 0).label("earned"),
        )
        .join(ServiceProvider, ServiceProvider.user_id == User.user_id)
        .join(Booking, Booking.provider_id == ServiceProvider.provider_id)
        .where(Booking.status == "completed")
        .group_by(User.user_id)
        .having(func.count(Booking.booking_id) > 0)
        .order_by(func.sum(Booking.total_amount).desc())
        .limit(5)
    ).all()

    # 3. Which residents are actually using the marketplace.
    demand = db.session.execute(
        select(
            User.full_name,
            func.count(func.distinct(ServiceRequest.request_id)).label("requests"),
            func.count(JobQuote.quote_id).label("quotes_received"),
        )
        .join(ServiceRequest, ServiceRequest.resident_id == User.user_id)
        .outerjoin(JobQuote, JobQuote.request_id == ServiceRequest.request_id)
        .group_by(User.user_id)
        .having(func.count(func.distinct(ServiceRequest.request_id)) > 0)
        .order_by(func.count(JobQuote.quote_id).desc())
        .limit(5)
    ).all()

    return jsonify(
        revenue_by_category=[
            {"category": name, "bookings": count, "value": str(value)}
            for name, count, value in by_category
        ],
        top_providers=[
            {"provider": name, "jobs": jobs, "earned": str(earned)}
            for name, jobs, earned in top_providers
        ],
        demand_by_resident=[
            {"resident": name, "requests": requests, "quotes_received": quotes}
            for name, requests, quotes in demand
        ],
    )
