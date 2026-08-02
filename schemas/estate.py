"""Estate schemas."""

from marshmallow import fields, validate

from models import Estate
from schemas.base import BaseAutoSchema, BaseSchema


class EstateSchema(BaseAutoSchema):
    """An estate, plus a cheap headcount the estate list screen shows."""

    class Meta(BaseAutoSchema.Meta):
        model = Estate
        dump_only = ("estate_id", "created_at")

    # Method fields are computed at dump time. len() on the relationship
    # is fine for a handful of estates; if this ever gets slow, replace it
    # with a COUNT query in the controller.
    resident_count = fields.Method("count_residents", dump_only=True)

    def count_residents(self, estate):
        return len(estate.users)


class EstateInputSchema(BaseSchema):
    """POST / PATCH /api/estates — admin only."""

    estate_name = fields.String(required=True, validate=validate.Length(min=2, max=120))
    address = fields.String(required=True, validate=validate.Length(min=3, max=255))
    city = fields.String(required=True, validate=validate.Length(min=2, max=80))
    country = fields.String(load_default="Kenya", validate=validate.Length(max=80))
