"""ServiceProvider — the professional profile attached to a User."""

from extensions import db
from models.base import TimestampMixin, generate_uuid


class ServiceProvider(TimestampMixin, db.Model):
    """One-to-one with User.

    Two distinct flags, deliberately not merged:
      is_verified — identity and documents have been checked
      is_approved — cleared by an admin to accept jobs

    A provider can be verified but suspended, so both are needed.
    """

    __tablename__ = "service_providers"

    provider_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    user_id = db.Column(
        db.String(36), db.ForeignKey("users.user_id"), nullable=False, unique=True
    )
    bio = db.Column(db.Text)
    is_verified = db.Column(db.Boolean, nullable=False, default=False)
    is_approved = db.Column(db.Boolean, nullable=False, default=False)

    user = db.relationship("User", back_populates="provider_profile")
    jobs = db.relationship("Booking", back_populates="provider")
    quotes = db.relationship(
        "JobQuote", back_populates="provider", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<ServiceProvider {self.provider_id} approved={self.is_approved}>"
