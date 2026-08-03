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
    CommuteRide,
    GatePass,
    HouseListing,
    MoveRequest,
    Notification,
    Payment,
    RideBooking,
    ServiceProvider,
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
    """
    return db.session.scalar(stmt.with_only_columns(func.count()).order_by(None)) or 0


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
