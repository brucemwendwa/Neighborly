"""
Commute rides — a neighbour's spare seats.

The one rule that matters here is seat accounting. Seats left is derived at
read time from the seat bookings (see CommuteRideSchema) rather than kept
as a counter, and the check "are there enough seats?" happens inside the
same transaction as the insert, so two passengers claiming the last seat
cannot both succeed.
"""

from decimal import Decimal

from flask import Blueprint, jsonify
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import select

from extensions import db
from models import CommuteRide, RideBooking
from schemas import (
    CommuteRideInputSchema,
    CommuteRideSchema,
    CommuteRideUpdateSchema,
    RideBookingInputSchema,
    RideBookingSchema,
)
from controllers.utils import (
    body,
    delete,
    get_or_404,
    is_admin,
    notify,
    paginate,
    query_arg,
    require_owner,
    save,
)

ride_bp = Blueprint("rides", __name__)

ride_schema = CommuteRideSchema()
ride_booking_schema = RideBookingSchema()


def seats_taken(ride):
    return sum(b.seats_booked for b in ride.seat_bookings if b.status != "cancelled")


@ride_bp.get("")
@jwt_required()
def list_rides():
    """GET /api/rides?from=&to=&status=&estate_id=&page=

    Scoped to the caller's estate by default — the point of the feature is
    sharing a car with someone who leaves from the same gate.
    """
    stmt = select(CommuteRide)

    estate_id = query_arg("estate_id") or current_user.estate_id
    if estate_id:
        stmt = stmt.where(CommuteRide.estate_id == estate_id)

    stmt = stmt.where(CommuteRide.status == (query_arg("status") or "active"))

    if origin := query_arg("from"):
        stmt = stmt.where(CommuteRide.from_location.ilike(f"%{origin}%"))
    if destination := query_arg("to"):
        stmt = stmt.where(CommuteRide.to_location.ilike(f"%{destination}%"))

    return jsonify(
        paginate(stmt.order_by(CommuteRide.departure_time), CommuteRideSchema)
    )


@ride_bp.get("/mine")
@jwt_required()
def my_rides():
    """GET /api/rides/mine — both sides of the feature in one call.

    `offered` are rides I drive; `joined` are seats I have claimed in
    someone else's car. The commute screen shows them as two lists.
    """
    offered = db.session.scalars(
        select(CommuteRide)
        .where(CommuteRide.driver_id == current_user.user_id)
        .order_by(CommuteRide.departure_time.desc())
    ).all()
    joined = db.session.scalars(
        select(RideBooking)
        .where(RideBooking.passenger_id == current_user.user_id)
        .order_by(RideBooking.created_at.desc())
    ).all()

    return jsonify(
        offered=CommuteRideSchema(many=True).dump(offered),
        joined=RideBookingSchema(many=True).dump(joined),
    )


@ride_bp.get("/<ride_id>")
@jwt_required()
def get_ride(ride_id):
    """GET /api/rides/<id>, with its passenger list."""
    ride = get_or_404(CommuteRide, ride_id, "Ride")
    return jsonify(
        ride=ride_schema.dump(ride),
        seat_bookings=RideBookingSchema(many=True, exclude=("ride",)).dump(
            ride.seat_bookings
        ),
    )


@ride_bp.post("")
@jwt_required()
def create_ride():
    """POST /api/rides — offer seats."""
    if not current_user.estate_id:
        return jsonify(error="Set your estate on your profile before offering a ride."), 400

    ride = CommuteRide(
        driver_id=current_user.user_id,
        estate_id=current_user.estate_id,
        **body(CommuteRideInputSchema),
    )
    save(ride)
    return jsonify(ride=ride_schema.dump(ride)), 201


@ride_bp.patch("/<ride_id>")
@jwt_required()
def update_ride(ride_id):
    """PATCH /api/rides/<id> — the driver only.

    Seats cannot be reduced below what passengers have already claimed;
    that would silently bump someone who is counting on the lift.
    """
    ride = get_or_404(CommuteRide, ride_id, "Ride")
    require_owner(ride.driver_id, "Only the driver can change this ride.")
    data = body(CommuteRideUpdateSchema, partial=True)

    taken = seats_taken(ride)
    if "available_seats" in data and data["available_seats"] < taken:
        return jsonify(
            error=f"{taken} seat(s) are already claimed, so you cannot go below that."
        ), 409

    was_cancelled = data.get("status") == "cancelled" and ride.status != "cancelled"

    for field, value in data.items():
        setattr(ride, field, value)

    if was_cancelled:
        for seat in ride.seat_bookings:
            if seat.status == "booked":
                seat.status = "cancelled"
                notify(
                    seat.passenger_id,
                    "Ride cancelled",
                    f"{current_user.full_name} cancelled the "
                    f"{ride.from_location} → {ride.to_location} ride.",
                    type="ride",
                )

    save(ride)
    return jsonify(ride=ride_schema.dump(ride))


@ride_bp.delete("/<ride_id>")
@jwt_required()
def delete_ride(ride_id):
    """DELETE /api/rides/<id> — only while nobody has claimed a seat.

    Once passengers are on board, cancel the ride instead: that keeps the
    record and tells them what happened.
    """
    ride = get_or_404(CommuteRide, ride_id, "Ride")
    require_owner(ride.driver_id, "Only the driver can delete this ride.")

    if any(b.status == "booked" for b in ride.seat_bookings) and not is_admin():
        return jsonify(
            error="Passengers have booked seats. Cancel the ride instead."
        ), 409

    delete(ride)
    return jsonify(message="Ride deleted.")


# --- Seats ----------------------------------------------------------------


@ride_bp.post("/<ride_id>/bookings")
@jwt_required()
def claim_seats(ride_id):
    """POST /api/rides/<id>/bookings — take a seat.

    The amount is computed here, not accepted from the client: seats x the
    driver's price. Anything the client can name, the client can lie about.
    """
    ride = get_or_404(CommuteRide, ride_id, "Ride")
    data = body(RideBookingInputSchema)
    wanted = data["seats_booked"]

    if ride.status != "active":
        return jsonify(error=f"This ride is {ride.status}."), 409
    if ride.driver_id == current_user.user_id:
        return jsonify(error="You are driving this one."), 409

    existing = db.session.scalar(
        select(RideBooking)
        .where(RideBooking.ride_id == ride.ride_id)
        .where(RideBooking.passenger_id == current_user.user_id)
    )
    # The unique constraint on (ride_id, passenger_id) means a second claim
    # must update the first rather than insert alongside it.
    already = existing.seats_booked if existing and existing.status != "cancelled" else 0
    free = ride.available_seats - seats_taken(ride) + already
    if wanted > free:
        return jsonify(error=f"Only {free} seat(s) left."), 409

    amount = Decimal(ride.price_per_seat or 0) * wanted

    if existing:
        existing.seats_booked = wanted
        existing.amount = amount
        existing.status = "booked"
        seat = existing
    else:
        seat = RideBooking(
            ride_id=ride.ride_id,
            passenger_id=current_user.user_id,
            seats_booked=wanted,
            amount=amount,
        )

    notify(
        ride.driver_id,
        "Seat claimed",
        f"{current_user.full_name} booked {wanted} seat(s) on your "
        f"{ride.from_location} → {ride.to_location} ride.",
        type="ride",
    )
    save(seat)
    return jsonify(seat_booking=ride_booking_schema.dump(seat)), 201


@ride_bp.delete("/<ride_id>/bookings/me")
@jwt_required()
def release_seat(ride_id):
    """DELETE /api/rides/<id>/bookings/me — give the seat back.

    Marked cancelled rather than deleted, so the driver keeps the history
    of who dropped out.
    """
    seat = db.session.scalar(
        select(RideBooking)
        .where(RideBooking.ride_id == ride_id)
        .where(RideBooking.passenger_id == current_user.user_id)
    )
    if seat is None:
        return jsonify(error="You have no seat on this ride."), 404

    seat.status = "cancelled"
    notify(
        seat.ride.driver_id,
        "Seat released",
        f"{current_user.full_name} released {seat.seats_booked} seat(s).",
        type="ride",
    )
    save(seat)
    return jsonify(seat_booking=ride_booking_schema.dump(seat))
