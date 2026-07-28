"""GatePass — a QR code admitting a visitor."""

from extensions import db
from models.base import CreatedAtMixin, generate_uuid

GATE_PASS_STATUSES = ("active", "expired", "used")


class GatePass(CreatedAtMixin, db.Model):
    """Issued by a resident, scanned by security at the gate."""

    __tablename__ = "gate_passes"

    gate_pass_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)

    # The resident issuing the pass.
    user_id = db.Column(db.String(36), db.ForeignKey("users.user_id"), nullable=False)

    # Optional link to the booking that explains the visit, so the guard
    # sees "plumber, booking #123" rather than an unexplained name.
    booking_id = db.Column(db.String(36), db.ForeignKey("bookings.booking_id"))

    visitor_name = db.Column(db.String(120), nullable=False)
    visitor_phone = db.Column(db.String(20), nullable=False)
    purpose = db.Column(db.String(255))

    entry_date = db.Column(db.DateTime(timezone=True), nullable=False)
    exit_date = db.Column(db.DateTime(timezone=True))

    # The scannable token. Unique and indexed because the gate scanner
    # looks passes up by this column and nothing else.
    qr_code = db.Column(db.String(120), unique=True, nullable=False, index=True)

    status = db.Column(
        db.Enum(*GATE_PASS_STATUSES, name="gate_pass_status"),
        nullable=False,
        default="active",
    )

    host = db.relationship("User", back_populates="gate_passes")
    booking = db.relationship("Booking", back_populates="gate_passes")

    def __repr__(self):
        return f"<GatePass {self.visitor_name} ({self.status})>"
