"""ServiceRequest — a job a resident has put out to the estate for quotes."""

from extensions import db
from models.base import TimestampMixin, generate_uuid

# 'instant' is matched to the first available provider at the listed price.
# 'skilled' goes out for quotes, because the price depends on the job.
REQUEST_KINDS = ("instant", "skilled")

REQUEST_STATUSES = (
    "open",  # posted, nobody has quoted yet
    "quoting",  # at least one provider has bid
    "assigned",  # a quote was accepted and a Booking now exists
    "completed",  # that booking finished
    "cancelled",  # withdrawn by the resident
)


class ServiceRequest(TimestampMixin, db.Model):
    """The resident's side of the marketplace.

    A Booking records work that *is* happening — who, what, how much. It
    cannot describe work nobody has priced yet, which is what a resident has
    at the moment they ask for a plumber. That gap is this table: a request
    is open, collects JobQuotes, and only becomes a Booking once the resident
    accepts one. Requests and bookings therefore both exist, and the FK on
    Booking.request_id is what ties an accepted quote to the job it created.

    Direct booking is untouched — a resident who already knows the provider
    they want still books them without going through a request at all.
    """

    __tablename__ = "service_requests"

    request_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)

    resident_id = db.Column(
        db.String(36), db.ForeignKey("users.user_id"), nullable=False, index=True
    )
    estate_id = db.Column(
        db.String(36), db.ForeignKey("estates.estate_id"), nullable=False
    )

    # Either is enough to describe what is wanted: a specific catalogue entry,
    # or just the category when the resident does not know what they need.
    service_id = db.Column(db.String(36), db.ForeignKey("services.service_id"))
    category_id = db.Column(
        db.String(36), db.ForeignKey("service_categories.category_id")
    )

    kind = db.Column(
        db.Enum(*REQUEST_KINDS, name="request_kind"), nullable=False, default="skilled"
    )
    title = db.Column(db.String(140), nullable=False)
    description = db.Column(db.Text)

    # A range, not a price. The resident says what they expect to spend and
    # providers quote against it; the accepted quote sets the actual amount.
    budget_min = db.Column(db.Numeric(12, 2))
    budget_max = db.Column(db.Numeric(12, 2))

    scheduled_for = db.Column(db.DateTime(timezone=True))

    status = db.Column(
        db.Enum(*REQUEST_STATUSES, name="request_status"),
        nullable=False,
        default="open",
        index=True,
    )

    # --- Relationships ---
    resident = db.relationship("User", back_populates="service_requests")
    estate = db.relationship("Estate", back_populates="service_requests")
    service = db.relationship("Service", back_populates="service_requests")
    category = db.relationship("ServiceCategory", back_populates="service_requests")

    # Deleting a request takes its quotes with it — a bid on a job that no
    # longer exists is not worth keeping.
    quotes = db.relationship(
        "JobQuote",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="JobQuote.amount",
    )
    events = db.relationship(
        "JobStatusEvent",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="JobStatusEvent.created_at",
    )
    booking = db.relationship("Booking", back_populates="request", uselist=False)

    __table_args__ = (
        # The estate feed a provider opens: "open work near me", newest first.
        db.Index("idx_service_requests_estate_status", "estate_id", "status"),
    )

    def __repr__(self):
        return f"<ServiceRequest {self.request_id} {self.status}>"
