"""RideBooking — a passenger's claim on seats in a ride."""

from extensions import db
from models.base import CreatedAtMixin, generate_uuid

RIDE_BOOKING_STATUSES = ("booked", "completed", "cancelled")


class RideBooking(CreatedAtMixin, db.Model):
    """The join between CommuteRide and User (as passenger).

    This is a full model rather than a bare association table because the
    join carries its own data: how many seats, how much was charged, and
    what state the claim is in. Once a join table has columns of its own,
    it has become an entity.
    """

    __tablename__ = "ride_bookings"

    ride_booking_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    ride_id = db.Column(
        db.String(36), db.ForeignKey("commute_rides.ride_id"), nullable=False
    )
    passenger_id = db.Column(
        db.String(36), db.ForeignKey("users.user_id"), nullable=False
    )

    seats_booked = db.Column(db.Integer, nullable=False, default=1)
    amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    status = db.Column(
        db.Enum(*RIDE_BOOKING_STATUSES, name="ride_booking_status"),
        nullable=False,
        default="booked",
    )

    # One claim per passenger per ride. To take more seats, update
    # seats_booked rather than inserting a second row.
    __table_args__ = (
        db.UniqueConstraint("ride_id", "passenger_id", name="uq_ride_passenger"),
    )

    ride = db.relationship("CommuteRide", back_populates="seat_bookings")
    passenger = db.relationship("User", back_populates="rides_taken")

    def __repr__(self):
        return f"<RideBooking {self.seats_booked} seat(s) {self.status}>"
