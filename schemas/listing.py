"""House listing schemas."""

from marshmallow import fields, validate

from models import LISTING_STATUSES, HouseListing
from schemas.base import BaseAutoSchema, BaseSchema, money
from schemas.estate import EstateSchema
from schemas.user import UserSummarySchema


class HouseListingSchema(BaseAutoSchema):
    """A rental unit, with the landlord and estate inlined for the card."""

    class Meta(BaseAutoSchema.Meta):
        model = HouseListing
        dump_only = (
            "listing_id",
            "user_id",
            "created_at",
            "updated_at",
            "is_verified",
        )

    rent_price = money(required=True)
    status = fields.String(validate=validate.OneOf(LISTING_STATUSES))
    images = fields.List(fields.String(), load_default=list)

    landlord = fields.Nested(UserSummarySchema, dump_only=True)
    estate = fields.Nested(EstateSchema, dump_only=True)


class HouseListingInputSchema(BaseSchema):
    """POST /api/listings.

    estate_id is not accepted: a listing belongs to the estate the poster
    lives in, which the server already knows from the JWT. Taking it from
    the body would let someone advertise a unit in an estate they have no
    connection to.
    """

    title = fields.String(required=True, validate=validate.Length(min=4, max=160))
    description = fields.String(load_default=None)
    rent_price = money(required=True, validate=validate.Range(min=0))
    bedrooms = fields.Integer(load_default=1, validate=validate.Range(min=0, max=20))
    bathrooms = fields.Integer(load_default=1, validate=validate.Range(min=0, max=20))
    images = fields.List(
        fields.String(validate=validate.Length(max=500)), load_default=list
    )
    status = fields.String(
        load_default="vacant", validate=validate.OneOf(LISTING_STATUSES)
    )


class HouseListingUpdateSchema(BaseSchema):
    """PATCH /api/listings/<id> — every field optional."""

    title = fields.String(validate=validate.Length(min=4, max=160))
    description = fields.String(allow_none=True)
    rent_price = money(validate=validate.Range(min=0))
    bedrooms = fields.Integer(validate=validate.Range(min=0, max=20))
    bathrooms = fields.Integer(validate=validate.Range(min=0, max=20))
    images = fields.List(fields.String(validate=validate.Length(max=500)))
    status = fields.String(validate=validate.OneOf(LISTING_STATUSES))


class ListingVerificationSchema(BaseSchema):
    """PATCH /api/listings/<id>/verification — admin only."""

    is_verified = fields.Boolean(required=True)
