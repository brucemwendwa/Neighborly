"""Payment — money movement against a booking."""

from extensions import db
from models.base import CreatedAtMixin, generate_uuid

PAYMENT_STATUSES = ("pending", "success", "failed", "refunded")
PAYMENT_METHODS = ("mpesa", "card", "wallet", "cash")


class Payment(CreatedAtMixin, db.Model):
    """Many payments per booking, not one.

    A deposit plus a balance, a retry after a failed card, a refund — each
    is its own immutable row. Collapsing them into a single record would
    destroy the audit trail, which is exactly what you need when a user
    disputes a charge.
    """

    __tablename__ = "payments"

    payment_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    booking_id = db.Column(
        db.String(36), db.ForeignKey("bookings.booking_id"), nullable=False
    )

    # Denormalised from booking.user_id so "every payment I ever made" is a
    # single-table query with no join.
    user_id = db.Column(db.String(36), db.ForeignKey("users.user_id"), nullable=False)

    amount = db.Column(db.Numeric(12, 2), nullable=False)
    payment_method = db.Column(
        db.Enum(*PAYMENT_METHODS, name="payment_method"),
        nullable=False,
        default="mpesa",
    )
    status = db.Column(
        db.Enum(*PAYMENT_STATUSES, name="payment_status"),
        nullable=False,
        default="pending",
    )

    # The gateway's own reference. Unique, so replaying a webhook cannot
    # credit the same transaction twice.
    transaction_ref = db.Column(db.String(120), unique=True, index=True)
    paid_at = db.Column(db.DateTime(timezone=True))

    booking = db.relationship("Booking", back_populates="payments")
    payer = db.relationship("User", back_populates="payments")

    def __repr__(self):
        return f"<Payment {self.amount} {self.status}>"
