"""Service request, quote and job event schemas."""

from marshmallow import fields, validate, validates_schema, ValidationError

from models import (
    JOB_EVENT_TYPES,
    QUOTE_STATUSES,
    REQUEST_KINDS,
    REQUEST_STATUSES,
    JobQuote,
    JobStatusEvent,
    ServiceRequest,
)
from schemas.base import BaseAutoSchema, BaseSchema, money
from schemas.catalogue import ServiceSummarySchema
from schemas.user import UserSummarySchema


class JobQuoteSchema(BaseAutoSchema):
    """A bid, with enough of the provider attached to judge it."""

    class Meta(BaseAutoSchema.Meta):
        model = JobQuote
        dump_only = ("quote_id", "request_id", "created_at", "updated_at")

    amount = money()
    status = fields.String(validate=validate.OneOf(QUOTE_STATUSES))
    provider = fields.Nested("ServiceProviderSchema", dump_only=True)


class JobStatusEventSchema(BaseAutoSchema):
    """One line of the timeline."""

    class Meta(BaseAutoSchema.Meta):
        model = JobStatusEvent
        dump_only = ("event_id", "created_at")

    event_type = fields.String(validate=validate.OneOf(JOB_EVENT_TYPES))
    actor = fields.Nested(UserSummarySchema, dump_only=True)


class ServiceRequestSchema(BaseAutoSchema):
    """A request with its quotes, for the resident's own view of it."""

    class Meta(BaseAutoSchema.Meta):
        model = ServiceRequest
        dump_only = ("request_id", "resident_id", "estate_id", "created_at", "updated_at")

    budget_min = money()
    budget_max = money()
    kind = fields.String(validate=validate.OneOf(REQUEST_KINDS))
    status = fields.String(validate=validate.OneOf(REQUEST_STATUSES))

    resident = fields.Nested(UserSummarySchema, dump_only=True)
    service = fields.Nested(ServiceSummarySchema, dump_only=True)
    quotes = fields.Nested(JobQuoteSchema, many=True, dump_only=True)
    events = fields.Nested(JobStatusEventSchema, many=True, dump_only=True)

    # The provider list needs "how competitive is this" without downloading
    # every rival bid, and the resident's own list wants the same two numbers
    # as a summary. Cheaper here than a second request per row.
    quote_count = fields.Method("count_quotes", dump_only=True)
    lowest_quote = fields.Method("find_lowest_quote", dump_only=True)
    booking_id = fields.Method("linked_booking", dump_only=True)

    def count_quotes(self, request):
        return len([q for q in request.quotes if q.status != "withdrawn"])

    def find_lowest_quote(self, request):
        live = [q.amount for q in request.quotes if q.status == "pending"]
        return str(min(live)) if live else None

    def linked_booking(self, request):
        return request.booking.booking_id if request.booking else None


class ServiceRequestListSchema(ServiceRequestSchema):
    """The feed version: no quotes, no timeline.

    A provider browsing open work in their estate would otherwise pull every
    rival's bid and the full history of each job just to render a list.
    """

    class Meta(ServiceRequestSchema.Meta):
        exclude = ("quotes", "events")


class ServiceRequestInputSchema(BaseSchema):
    """POST /api/requests.

    Absent by design: resident_id and estate_id. Both come from the JWT — a
    client that can name the resident can post work in someone else's name.
    """

    title = fields.String(required=True, validate=validate.Length(min=3, max=140))
    description = fields.String(load_default=None)
    kind = fields.String(load_default="skilled", validate=validate.OneOf(REQUEST_KINDS))
    service_id = fields.String(load_default=None)
    category_id = fields.String(load_default=None)
    budget_min = fields.Decimal(load_default=None, as_string=True, places=2)
    budget_max = fields.Decimal(load_default=None, as_string=True, places=2)
    scheduled_for = fields.DateTime(load_default=None)

    @validates_schema
    def check(self, data, **kwargs):
        # Without one or the other there is nothing for a provider to filter
        # on, and the request would never surface in anybody's feed.
        if not data.get("service_id") and not data.get("category_id"):
            raise ValidationError(
                "Give either a service or a category so providers can find this.",
                "service_id",
            )

        low, high = data.get("budget_min"), data.get("budget_max")
        if low is not None and high is not None and low > high:
            raise ValidationError(
                "The minimum budget cannot be above the maximum.", "budget_min"
            )


class ServiceRequestUpdateSchema(BaseSchema):
    """PATCH /api/requests/<id> — the resident editing their own request."""

    title = fields.String(validate=validate.Length(min=3, max=140))
    description = fields.String()
    budget_min = fields.Decimal(as_string=True, places=2)
    budget_max = fields.Decimal(as_string=True, places=2)
    scheduled_for = fields.DateTime()


class JobQuoteInputSchema(BaseSchema):
    """POST /api/requests/<id>/quotes — a provider bidding.

    provider_id is absent for the same reason: it is the caller's own
    provider profile, resolved from the JWT.
    """

    amount = fields.Decimal(
        required=True, as_string=True, places=2, validate=validate.Range(min=1)
    )
    message = fields.String(load_default=None)
    eta_minutes = fields.Integer(
        load_default=None, validate=validate.Range(min=1, max=10080)
    )
