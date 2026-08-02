"""Notification schemas."""

from marshmallow import fields, validate

from models import Notification
from schemas.base import BaseAutoSchema, BaseSchema


class NotificationSchema(BaseAutoSchema):
    """An in-app message."""

    class Meta(BaseAutoSchema.Meta):
        model = Notification
        dump_only = ("notification_id", "user_id", "created_at", "title", "message", "type")


class NotificationCreateSchema(BaseSchema):
    """POST /api/notifications — admin only (an estate-wide announcement).

    Everyday notifications are not created through the API at all: the
    controllers raise them as a side effect of the thing that happened
    (a booking accepted, a payment succeeded). See controllers/utils.notify.
    """

    user_id = fields.String(required=True)
    title = fields.String(required=True, validate=validate.Length(min=2, max=160))
    message = fields.String(required=True, validate=validate.Length(min=2))
    type = fields.String(load_default="general", validate=validate.Length(max=40))


class NotificationReadSchema(BaseSchema):
    """PATCH /api/notifications/<id>."""

    is_read = fields.Boolean(load_default=True)
