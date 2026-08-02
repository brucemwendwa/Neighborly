"""
Notifications — the bell in the header.

Everything here is scoped to the signed-in user; there is no way to read
someone else's. New ones are normally raised as a side effect elsewhere
(controllers/utils.notify), so this file is mostly reads and marking read.
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import func, select, update

from extensions import db
from models import Notification, User
from schemas import (
    NotificationCreateSchema,
    NotificationReadSchema,
    NotificationSchema,
)
from controllers.utils import (
    body,
    bool_arg,
    delete,
    get_or_404,
    paginate,
    query_arg,
    role_required,
    save,
)

notification_bp = Blueprint("notifications", __name__)

notification_schema = NotificationSchema()


@notification_bp.get("")
@jwt_required()
def list_notifications():
    """GET /api/notifications?is_read=&type=&page=."""
    stmt = select(Notification).where(Notification.user_id == current_user.user_id)

    if (is_read := bool_arg("is_read")) is not None:
        stmt = stmt.where(Notification.is_read.is_(is_read))
    if type_ := query_arg("type"):
        stmt = stmt.where(Notification.type == type_)

    return jsonify(
        paginate(stmt.order_by(Notification.created_at.desc()), NotificationSchema)
    )


@notification_bp.get("/unread-count")
@jwt_required()
def unread_count():
    """GET /api/notifications/unread-count — just the badge number.

    A COUNT query, not a list. The header polls this on every page, so it
    must stay cheap; the composite index on (user_id, is_read) is there
    for exactly this call.
    """
    count = db.session.scalar(
        select(func.count(Notification.notification_id))
        .where(Notification.user_id == current_user.user_id)
        .where(Notification.is_read.is_(False))
    )
    return jsonify(unread=count or 0)


@notification_bp.patch("/<notification_id>")
@jwt_required()
def mark_read(notification_id):
    """PATCH /api/notifications/<id> — mark one read (or unread)."""
    note = get_or_404(Notification, notification_id, "Notification")
    if note.user_id != current_user.user_id:
        return jsonify(error="That notification is not yours."), 403

    note.is_read = body(NotificationReadSchema, partial=True).get("is_read", True)
    save(note)
    return jsonify(notification=notification_schema.dump(note))


@notification_bp.post("/read-all")
@jwt_required()
def mark_all_read():
    """POST /api/notifications/read-all.

    One UPDATE statement rather than loading every row and setting a flag
    in Python — the difference matters the first time somebody has 400
    unread notifications.
    """
    result = db.session.execute(
        update(Notification)
        .where(Notification.user_id == current_user.user_id)
        .where(Notification.is_read.is_(False))
        .values(is_read=True)
    )
    db.session.commit()
    return jsonify(message="All caught up.", updated=result.rowcount)


@notification_bp.delete("/<notification_id>")
@jwt_required()
def delete_notification(notification_id):
    """DELETE /api/notifications/<id>."""
    note = get_or_404(Notification, notification_id, "Notification")
    if note.user_id != current_user.user_id:
        return jsonify(error="That notification is not yours."), 403

    delete(note)
    return jsonify(message="Notification deleted.")


@notification_bp.post("")
@role_required("admin")
def create_notification():
    """POST /api/notifications — admin announcement to one resident."""
    data = body(NotificationCreateSchema)
    get_or_404(User, data["user_id"], "User")

    note = Notification(**data)
    save(note)
    return jsonify(notification=notification_schema.dump(note)), 201
