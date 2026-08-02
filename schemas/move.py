"""Move request schemas."""

from marshmallow import fields, validate

from models import MOVE_SERVICE_TYPES, MOVE_STATUSES, MoveRequest
from schemas.base import BaseAutoSchema, BaseSchema, money
from schemas.user import UserSummarySchema


class MoveRequestSchema(BaseAutoSchema):
    """A house move."""

    class Meta(BaseAutoSchema.Meta):
        model = MoveRequest
        dump_only = ("move_id", "user_id", "created_at", "updated_at")

    total_amount = money()
    status = fields.String(validate=validate.OneOf(MOVE_STATUSES))
    service_type = fields.String(validate=validate.OneOf(MOVE_SERVICE_TYPES))
    requester = fields.Nested(UserSummarySchema, dump_only=True)


class MoveRequestInputSchema(BaseSchema):
    """POST /api/moves."""

    pickup_location = fields.String(
        required=True, validate=validate.Length(min=3, max=255)
    )
    dropoff_location = fields.String(
        required=True, validate=validate.Length(min=3, max=255)
    )
    move_date = fields.DateTime(required=True)
    service_type = fields.String(
        load_default="all", validate=validate.OneOf(MOVE_SERVICE_TYPES)
    )
    total_amount = money(load_default=0, validate=validate.Range(min=0))


class MoveRequestUpdateSchema(BaseSchema):
    """PATCH /api/moves/<id>."""

    pickup_location = fields.String(validate=validate.Length(min=3, max=255))
    dropoff_location = fields.String(validate=validate.Length(min=3, max=255))
    move_date = fields.DateTime()
    service_type = fields.String(validate=validate.OneOf(MOVE_SERVICE_TYPES))
    status = fields.String(validate=validate.OneOf(MOVE_STATUSES))
    total_amount = money(validate=validate.Range(min=0))
