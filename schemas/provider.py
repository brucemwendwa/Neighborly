"""ServiceProvider schemas."""

from marshmallow import fields, validate

from models import ServiceProvider
from schemas.base import BaseAutoSchema, BaseSchema
from schemas.user import UserSummarySchema


class ServiceProviderSchema(BaseAutoSchema):
    """A professional profile.

    `rating` and `jobs_completed` are computed rather than stored. Storing
    them would mean two writes per review and a number that drifts out of
    sync the first time a review is deleted.
    """

    class Meta(BaseAutoSchema.Meta):
        model = ServiceProvider
        dump_only = (
            "provider_id",
            "user_id",
            "created_at",
            "updated_at",
            "is_verified",
            "is_approved",
        )

    user = fields.Nested(UserSummarySchema, dump_only=True)
    rating = fields.Method("average_rating", dump_only=True)
    review_count = fields.Method("count_reviews", dump_only=True)
    jobs_completed = fields.Method("count_completed_jobs", dump_only=True)

    def average_rating(self, provider):
        ratings = [r.rating for r in provider.user.reviews_received]
        return round(sum(ratings) / len(ratings), 1) if ratings else None

    def count_reviews(self, provider):
        return len(provider.user.reviews_received)

    def count_completed_jobs(self, provider):
        return sum(1 for job in provider.jobs if job.status == "completed")


class ProviderInputSchema(BaseSchema):
    """POST / PATCH /api/providers/me.

    The verification flags are absent on purpose: a provider must not be
    able to approve themselves. Those move through
    PATCH /api/providers/<id>/verification, which is admin-only.
    """

    bio = fields.String(load_default=None, validate=validate.Length(max=2000))


class ProviderVerificationSchema(BaseSchema):
    """PATCH /api/providers/<id>/verification — admin only."""

    is_verified = fields.Boolean()
    is_approved = fields.Boolean()
