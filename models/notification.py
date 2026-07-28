"""Notification — an in-app message for one user."""

from extensions import db
from models.base import CreatedAtMixin, generate_uuid


class Notification(CreatedAtMixin, db.Model):
    """`type` is a free-form tag ('booking', 'payment', 'ride', 'gate_pass')
    the client uses to pick an icon and a deep link.
    """

    __tablename__ = "notifications"

    notification_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.user_id"), nullable=False)

    title = db.Column(db.String(160), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(40), nullable=False, default="general")
    is_read = db.Column(db.Boolean, nullable=False, default=False)

    # The unread badge is fetched on every screen, so index the exact
    # columns that query filters on.
    __table_args__ = (db.Index("ix_notifications_user_unread", "user_id", "is_read"),)

    user = db.relationship("User", back_populates="notifications")

    def __repr__(self):
        return f"<Notification {self.title} read={self.is_read}>"
