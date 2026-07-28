"""Service — a concrete bookable offering."""

from extensions import db
from models.base import CreatedAtMixin, generate_uuid


class Service(CreatedAtMixin, db.Model):
    """Sits inside a category: "Plumbing" inside "Home Repair".

    `base_price` is the indicative starting price shown in the catalogue.
    The agreed figure for a specific job lives on Booking.total_amount.
    """

    __tablename__ = "services"

    service_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(120), nullable=False)
    category_id = db.Column(
        db.String(36),
        db.ForeignKey("service_categories.category_id"),
        nullable=False,
    )
    description = db.Column(db.Text)
    base_price = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    icon = db.Column(db.String(255))

    category = db.relationship("ServiceCategory", back_populates="services")
    bookings = db.relationship("Booking", back_populates="service")

    def __repr__(self):
        return f"<Service {self.name}>"
