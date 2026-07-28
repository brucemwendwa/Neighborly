"""HouseListing — a rental unit advertised inside an estate."""

from extensions import db
from models.base import TimestampMixin, generate_uuid

LISTING_STATUSES = ("vacant", "occupied")


class HouseListing(TimestampMixin, db.Model):
    """Listed by a resident or agent, verified by an estate admin."""

    __tablename__ = "house_listings"

    listing_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.user_id"), nullable=False)
    estate_id = db.Column(
        db.String(36), db.ForeignKey("estates.estate_id"), nullable=False
    )

    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text)
    rent_price = db.Column(db.Numeric(12, 2), nullable=False)
    bedrooms = db.Column(db.Integer, nullable=False, default=1)
    bathrooms = db.Column(db.Integer, nullable=False, default=1)

    # JSON list of image URLs. Chosen over a Postgres ARRAY so the same
    # model runs on SQLite locally; the alternative is a separate
    # listing_images table, which is worth doing if images ever need
    # their own metadata (caption, ordering, uploader).
    images = db.Column(db.JSON, nullable=False, default=list)

    status = db.Column(
        db.Enum(*LISTING_STATUSES, name="listing_status"),
        nullable=False,
        default="vacant",
        index=True,
    )
    is_verified = db.Column(db.Boolean, nullable=False, default=False)

    landlord = db.relationship("User", back_populates="listings")
    estate = db.relationship("Estate", back_populates="listings")

    def __repr__(self):
        return f"<HouseListing {self.title} ({self.status})>"
