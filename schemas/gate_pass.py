"""Gate pass schemas."""

from marshmallow import fields, validate

from models import GATE_PASS_STATUSES, GatePass
from schemas.base import BaseAutoSchema, BaseSchema
from schemas.user import PHONE_RULES, UserSummarySchema


class GatePassSchema(BaseAutoSchema):
    """A visitor pass.

    `qr_code` is dump_only: the server mints the token. A client-chosen
    code could be guessed, or collide with someone else's.
    """

    class Meta(BaseAutoSchema.Meta):
        model = GatePass
        dump_only = ("gate_pass_id", "user_id", "created_at", "qr_code")

    status = fields.String(validate=validate.OneOf(GATE_PASS_STATUSES))
    host = fields.Nested(UserSummarySchema, dump_only=True)
    booking = fields.Nested("BookingSchema", dump_only=True)


class GatePassInputSchema(BaseSchema):
    """POST /api/gate-passes."""

    visitor_name = fields.String(required=True, validate=validate.Length(min=2, max=120))
    visitor_phone = fields.String(required=True, validate=PHONE_RULES)
    purpose = fields.String(load_default=None, validate=validate.Length(max=255))
    entry_date = fields.DateTime(required=True)
    exit_date = fields.DateTime(load_default=None)
    booking_id = fields.String(load_default=None)


class GatePassStatusSchema(BaseSchema):
    """PATCH /api/gate-passes/<id> — used by security at the gate."""

    status = fields.String(required=True, validate=validate.OneOf(GATE_PASS_STATUSES))
    exit_date = fields.DateTime(load_default=None)
