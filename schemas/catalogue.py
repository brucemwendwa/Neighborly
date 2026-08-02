"""Service catalogue schemas: categories and the services inside them."""

from marshmallow import fields, validate

from models import Service, ServiceCategory
from schemas.base import BaseAutoSchema, BaseSchema, money


class ServiceCategorySchema(BaseAutoSchema):
    """A tile on the home screen."""

    class Meta(BaseAutoSchema.Meta):
        model = ServiceCategory
        dump_only = ("category_id", "created_at")

    service_count = fields.Method("count_services", dump_only=True)

    def count_services(self, category):
        return len(category.services)


class ServiceCategoryInputSchema(BaseSchema):
    """POST / PATCH /api/categories — admin only."""

    name = fields.String(required=True, validate=validate.Length(min=2, max=80))
    description = fields.String(load_default=None)
    icon = fields.String(load_default=None, validate=validate.Length(max=255))


class ServiceSummarySchema(BaseAutoSchema):
    """Embedded inside a booking, where the full description is noise."""

    class Meta(BaseAutoSchema.Meta):
        model = Service
        fields = ("service_id", "name", "icon", "base_price", "category_id")

    base_price = money(dump_only=True)


class ServiceSchema(BaseAutoSchema):
    """A bookable offering, with its category inlined for the catalogue grid."""

    class Meta(BaseAutoSchema.Meta):
        model = Service
        dump_only = ("service_id", "created_at")

    base_price = money(required=True)
    category = fields.Nested(ServiceCategorySchema, dump_only=True)


class ServiceInputSchema(BaseSchema):
    """POST / PATCH /api/services — admin only."""

    name = fields.String(required=True, validate=validate.Length(min=2, max=120))
    category_id = fields.String(required=True)
    description = fields.String(load_default=None)
    base_price = money(load_default=0, validate=validate.Range(min=0))
    icon = fields.String(load_default=None, validate=validate.Length(max=255))
