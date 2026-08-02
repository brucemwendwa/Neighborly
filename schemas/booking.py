"""Booking schemas."""

from marshmallow import fields, validate, validates_schema, ValidationError

from models import BOOKING_STATUSES, BOOKING_TYPES, Booking
from schemas.base import BaseAutoSchema, BaseSchema, money
from schemas.catalogue import ServiceSummarySchema
from schemas.user import UserSummarySchema


class BookingSchema(BaseAutoSchema):
    """A booking with everything the UI needs to render a row.

    The nested service, customer and provider are what let the bookings
    screen show "Plumbing · Jane Doe · KES 1,500" from one request instead
    of four.
    """

    class Meta(BaseAutoSchema.Meta):
        model = Booking
        dump_only = ("booking_id", "created_at", "updated_at")

    total_amount = money()
    status = fields.String(validate=validate.OneOf(BOOKING_STATUSES))
    booking_type = fields.String(validate=validate.OneOf(BOOKING_TYPES))

    service = fields.Nested(ServiceSummarySchema, dump_only=True)
    customer = fields.Nested(UserSummarySchema, dump_only=True)
    provider = fields.Nested("ServiceProviderSchema", dump_only=True)
    payments = fields.Nested("PaymentSchema", many=True, dump_only=True)
    reviews = fields.Nested("ReviewSchema", many=True, dump_only=True)

    # Saves the client from re-deriving "is this paid?" in three places.
    amount_paid = fields.Method("sum_successful_payments", dump_only=True)
    is_paid = fields.Method("check_paid", dump_only=True)

    def sum_successful_payments(self, booking):
        return str(
            sum(p.amount for p in booking.payments if p.status == "success") or 0
        )

    def check_paid(self, booking):
        paid = sum(p.amount for p in booking.payments if p.status == "success") or 0
        return bool(booking.total_amount) and paid >= booking.total_amount


class BookingCreateSchema(BaseSchema):
    """POST /api/bookings.

    Absent by design: user_id and estate_id. Both are taken from the JWT,
    because a client that can name the customer can book on someone else's
    behalf.
    """

    service_id = fields.String(required=True)
    provider_id = fields.String(load_default=None)
    booking_type = fields.String(
        load_default="instant", validate=validate.OneOf(BOOKING_TYPES)
    )
    scheduled_date = fields.DateTime(load_default=None)
    total_amount = money(load_default=None, validate=validate.Range(min=0))

    @validates_schema
    def scheduled_needs_a_date(self, data, **kwargs):
        if data.get("booking_type") == "scheduled" and not data.get("scheduled_date"):
            raise ValidationError(
                {"scheduled_date": ["Pick a date and time for a scheduled booking."]}
            )


class BookingUpdateSchema(BaseSchema):
    """PATCH /api/bookings/<id>.

    Status transitions are checked in the controller, not here: whether
    'completed' is legal depends on the booking's current status and on
    who is asking, and a schema sees neither.
    """

    status = fields.String(validate=validate.OneOf(BOOKING_STATUSES))
    provider_id = fields.String(allow_none=True)
    scheduled_date = fields.DateTime(allow_none=True)
    total_amount = money(validate=validate.Range(min=0))
