"""Estate — a gated community."""

from extensions import db
from models.base import CreatedAtMixin, generate_uuid


class Estate(CreatedAtMixin, db.Model):
    """The top-level tenant boundary.

    Users, bookings, listings and rides all belong to exactly one estate,
    which is what keeps one community's data out of another's.
    """

    __tablename__ = "estates"

    estate_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    estate_name = db.Column(db.String(120), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(80), nullable=False)
    country = db.Column(db.String(80), nullable=False, default="Kenya")

    # --- Relationships (the "one" side of one-to-many) ---
    users = db.relationship("User", back_populates="estate", lazy="select")
    bookings = db.relationship("Booking", back_populates="estate", lazy="select")
    service_requests = db.relationship(
        "ServiceRequest", back_populates="estate", lazy="select"
    )
    listings = db.relationship("HouseListing", back_populates="estate", lazy="select")
    rides = db.relationship("CommuteRide", back_populates="estate", lazy="select")

    def __repr__(self):
        return f"<Estate {self.estate_name} ({self.city})>"
