"""Commute ride and ride-booking schemas."""

from marshmallow import fields, validate

from models import (
    RECURRENCE,
    RIDE_BOOKING_STATUSES,
    RIDE_STATUSES,
    CommuteRide,
    RideBooking,
)
from schemas.base import BaseAutoSchema, BaseSchema, money
from schemas.user import UserSummarySchema


class RideBookingSchema(BaseAutoSchema):
    """One passenger's claim on seats."""

    class Meta(BaseAutoSchema.Meta):
        model = RideBooking
        dump_only = ("ride_booking_id", "passenger_id", "created_at", "amount")

    amount = money(dump_only=True)
    status = fields.String(validate=validate.OneOf(RIDE_BOOKING_STATUSES))
    passenger = fields.Nested(UserSummarySchema, dump_only=True)
    ride = fields.Nested("CommuteRideSchema", dump_only=True)


class CommuteRideSchema(BaseAutoSchema):
    """A trip on offer.

    `seats_taken` and `seats_left` are derived from the seat bookings.
    Keeping a stored counter in step with the join table is a classic
    source of drift — one failed transaction and the number lies forever.
    """

    class Meta(BaseAutoSchema.Meta):
        model = CommuteRide
        dump_only = ("ride_id", "driver_id", "estate_id", "created_at", "updated_at")

    price_per_seat = money()
    status = fields.String(validate=validate.OneOf(RIDE_STATUSES))
    recurrence = fields.String(validate=validate.OneOf(RECURRENCE))

    driver = fields.Nested(UserSummarySchema, dump_only=True)
    seats_taken = fields.Method("count_taken", dump_only=True)
    seats_left = fields.Method("count_left", dump_only=True)

    def count_taken(self, ride):
        return sum(
            b.seats_booked for b in ride.seat_bookings if b.status != "cancelled"
        )

    def count_left(self, ride):
        return max(ride.available_seats - self.count_taken(ride), 0)


class CommuteRideInputSchema(BaseSchema):
    """POST /api/rides — offer a ride."""

    from_location = fields.String(
        required=True, validate=validate.Length(min=2, max=255)
    )
    to_location = fields.String(required=True, validate=validate.Length(min=2, max=255))
    departure_time = fields.DateTime(required=True)
    return_time = fields.DateTime(load_default=None)
    available_seats = fields.Integer(
        load_default=1, validate=validate.Range(min=1, max=8)
    )
    price_per_seat = money(load_default=0, validate=validate.Range(min=0))
    recurrence = fields.String(load_default="none", validate=validate.OneOf(RECURRENCE))


class CommuteRideUpdateSchema(BaseSchema):
    """PATCH /api/rides/<id> — driver only."""

    from_location = fields.String(validate=validate.Length(min=2, max=255))
    to_location = fields.String(validate=validate.Length(min=2, max=255))
    departure_time = fields.DateTime()
    return_time = fields.DateTime(allow_none=True)
    available_seats = fields.Integer(validate=validate.Range(min=1, max=8))
    price_per_seat = money(validate=validate.Range(min=0))
    recurrence = fields.String(validate=validate.OneOf(RECURRENCE))
    status = fields.String(validate=validate.OneOf(RIDE_STATUSES))


class RideBookingInputSchema(BaseSchema):
    """POST /api/rides/<id>/bookings — claim seats.

    The amount is not accepted from the client: it is seats x the ride's
    own price, worked out server-side.
    """

    seats_booked = fields.Integer(
        load_default=1, validate=validate.Range(min=1, max=8)
    )
