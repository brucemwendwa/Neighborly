"""Review schemas."""

from marshmallow import fields, validate

from models import Review
from schemas.base import BaseAutoSchema, BaseSchema
from schemas.user import UserSummarySchema


class ReviewSchema(BaseAutoSchema):
    """Feedback on a finished booking."""

    class Meta(BaseAutoSchema.Meta):
        model = Review
        dump_only = ("review_id", "reviewer_id", "created_at")

    # The same 1-5 rule the CheckConstraint enforces in the database.
    # Validating in both places is intentional: the schema gives the user a
    # readable message, the constraint guarantees the data.
    rating = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    reviewer = fields.Nested(UserSummarySchema, dump_only=True)
    reviewee = fields.Nested(UserSummarySchema, dump_only=True)


class ReviewInputSchema(BaseSchema):
    """POST /api/reviews.

    reviewee_id is optional — for a normal service booking the server
    infers "the other party" from the booking itself.
    """

    booking_id = fields.String(required=True)
    reviewee_id = fields.String(load_default=None)
    rating = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    comment = fields.String(load_default=None, validate=validate.Length(max=2000))


class ReviewUpdateSchema(BaseSchema):
    """PATCH /api/reviews/<id> — the author can revise their own review."""

    rating = fields.Integer(validate=validate.Range(min=1, max=5))
    comment = fields.String(allow_none=True, validate=validate.Length(max=2000))
