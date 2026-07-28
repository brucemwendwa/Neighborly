"""MoveRequest — a house-moving job."""

from extensions import db
from models.base import TimestampMixin, generate_uuid

MOVE_SERVICE_TYPES = ("vehicle", "loaders", "packers", "all")
MOVE_STATUSES = ("pending", "assigned", "in_progress", "completed", "cancelled")


class MoveRequest(TimestampMixin, db.Model):
    """Kept separate from Booking rather than folded into it.

    A move has its own shape — two locations, a move date, and a status
    that runs pending -> assigned -> in_progress. Forcing it into the
    generic booking table would mean a pile of nullable columns that are
    meaningless for every other service type.
    """

    __tablename__ = "move_requests"

    move_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.user_id"), nullable=False)

    pickup_location = db.Column(db.String(255), nullable=False)
    dropoff_location = db.Column(db.String(255), nullable=False)
    move_date = db.Column(db.DateTime(timezone=True), nullable=False)

    service_type = db.Column(
        db.Enum(*MOVE_SERVICE_TYPES, name="move_service_type"),
        nullable=False,
        default="all",
    )
    status = db.Column(
        db.Enum(*MOVE_STATUSES, name="move_status"), nullable=False, default="pending"
    )
    total_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)

    requester = db.relationship("User", back_populates="move_requests")

    def __repr__(self):
        return f"<MoveRequest {self.pickup_location} -> {self.dropoff_location}>"
