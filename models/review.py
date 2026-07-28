"""Review — feedback left after a booking."""

from extensions import db
from models.base import CreatedAtMixin, generate_uuid


class Review(CreatedAtMixin, db.Model):
    """Two foreign keys into the same table.

    reviewer_id — who wrote it
    reviewee_id — who it is about

    Because both point at `users`, SQLAlchemy cannot infer which column
    belongs to which relationship. Every relationship on BOTH sides must
    name its column via foreign_keys=, or mapper configuration fails with
    AmbiguousForeignKeysError. This is the single most common mistake when
    wiring these models — see the matching declarations on User.
    """

    __tablename__ = "reviews"

    review_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    booking_id = db.Column(
        db.String(36), db.ForeignKey("bookings.booking_id"), nullable=False
    )
    reviewer_id = db.Column(
        db.String(36), db.ForeignKey("users.user_id"), nullable=False
    )
    reviewee_id = db.Column(
        db.String(36), db.ForeignKey("users.user_id"), nullable=False, index=True
    )

    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text)

    __table_args__ = (
        # One review per person per booking.
        db.UniqueConstraint("booking_id", "reviewer_id", name="uq_booking_reviewer"),
        # Enforced by the database, so a bad rating cannot be written even
        # if a controller forgets to validate it.
        db.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_rating_range"),
    )

    booking = db.relationship("Booking", back_populates="reviews")
    reviewer = db.relationship(
        "User", back_populates="reviews_written", foreign_keys=[reviewer_id]
    )
    reviewee = db.relationship(
        "User", back_populates="reviews_received", foreign_keys=[reviewee_id]
    )

    def __repr__(self):
        return f"<Review {self.rating}/5>"
