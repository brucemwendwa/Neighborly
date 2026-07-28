"""Booking — the central transaction record."""

from extensions import db
from models.base import TimestampMixin, generate_uuid

BOOKING_TYPES = ("instant", "quotation", "scheduled")
BOOKING_STATUSES = ("pending", "accepted", "in_progress", "completed", "cancelled")


class Booking(TimestampMixin, db.Model):
    """The hub of the whole system.

    A booking answers four questions at once: who ordered it (customer),
    who fulfils it (provider), what was ordered (service), and where
    (estate). Payments, gate passes and reviews all hang off it.
    """

    __tablename__ = "bookings"

    booking_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)

    user_id = db.Column(db.String(36), db.ForeignKey("users.user_id"), nullable=False)

    # Nullable on purpose: a booking exists from the moment the resident
    # submits it, which is before any provider has accepted the job.
    provider_id = db.Column(
        db.String(36), db.ForeignKey("service_providers.provider_id")
    )

    service_id = db.Column(
        db.String(36), db.ForeignKey("services.service_id"), nullable=False
    )
    estate_id = db.Column(
        db.String(36), db.ForeignKey("estates.estate_id"), nullable=False
    )

    booking_type = db.Column(
        db.Enum(*BOOKING_TYPES, name="booking_type"), nullable=False, default="instant"
    )
    status = db.Column(
        db.Enum(*BOOKING_STATUSES, name="booking_status"),
        nullable=False,
        default="pending",
        index=True,
    )

    # Required only when booking_type == 'scheduled'.
    scheduled_date = db.Column(db.DateTime(timezone=True))
    total_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)

    # --- Relationships ---
    customer = db.relationship("User", back_populates="bookings")
    provider = db.relationship("ServiceProvider", back_populates="jobs")
    service = db.relationship("Service", back_populates="bookings")
    estate = db.relationship("Estate", back_populates="bookings")

    payments = db.relationship("Payment", back_populates="booking")
    gate_passes = db.relationship("GatePass", back_populates="booking")
    reviews = db.relationship("Review", back_populates="booking")

    def __repr__(self):
        return f"<Booking {self.booking_id} {self.status}>"
