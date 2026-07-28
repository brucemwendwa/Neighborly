"""CommuteRide — a carpool trip offered by a resident."""

from extensions import db
from models.base import TimestampMixin, generate_uuid

RECURRENCE = ("none", "daily", "weekly")
RIDE_STATUSES = ("active", "completed", "cancelled")


class CommuteRide(TimestampMixin, db.Model):
    """Offered by a driver; seats are claimed through RideBooking."""

    __tablename__ = "commute_rides"

    ride_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    driver_id = db.Column(db.String(36), db.ForeignKey("users.user_id"), nullable=False)
    estate_id = db.Column(
        db.String(36), db.ForeignKey("estates.estate_id"), nullable=False
    )

    from_location = db.Column(db.String(255), nullable=False)
    to_location = db.Column(db.String(255), nullable=False)
    departure_time = db.Column(db.DateTime(timezone=True), nullable=False)
    return_time = db.Column(db.DateTime(timezone=True))

    available_seats = db.Column(db.Integer, nullable=False, default=1)
    price_per_seat = db.Column(db.Numeric(12, 2), nullable=False, default=0)

    recurrence = db.Column(
        db.Enum(*RECURRENCE, name="ride_recurrence"), nullable=False, default="none"
    )
    status = db.Column(
        db.Enum(*RIDE_STATUSES, name="ride_status"),
        nullable=False,
        default="active",
        index=True,
    )

    driver = db.relationship("User", back_populates="rides_offered")
    estate = db.relationship("Estate", back_populates="rides")

    seat_bookings = db.relationship(
        "RideBooking", back_populates="ride", cascade="all, delete-orphan"
    )

    # Convenience view straight through the join table: ride.passengers
    # gives User objects. viewonly=True because seats must be claimed by
    # creating a RideBooking (which carries seats_booked and amount),
    # never by appending to this list.
    passengers = db.relationship(
        "User", secondary="ride_bookings", viewonly=True, back_populates="rides_joined"
    )

    def __repr__(self):
        return f"<CommuteRide {self.from_location} -> {self.to_location}>"
