"""ServiceCategory — the top-level grouping in the service catalogue."""

from extensions import db
from models.base import CreatedAtMixin, generate_uuid


class ServiceCategory(CreatedAtMixin, db.Model):
    """The tiles on the home screen: "Home Repair", "Cleaning", "Moving"."""

    __tablename__ = "service_categories"

    category_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(80), unique=True, nullable=False)
    description = db.Column(db.Text)
    icon = db.Column(db.String(255))

    services = db.relationship("Service", back_populates="category")
    service_requests = db.relationship("ServiceRequest", back_populates="category")

    def __repr__(self):
        return f"<ServiceCategory {self.name}>"
