"""JobQuote — one provider's bid on a ServiceRequest."""

from extensions import db
from models.base import TimestampMixin, generate_uuid

QUOTE_STATUSES = (
    "pending",  # submitted, resident has not answered
    "accepted",  # won the job; a Booking was created from it
    "rejected",  # another quote won, or the resident declined this one
    "withdrawn",  # the provider pulled out before a decision
)


class JobQuote(TimestampMixin, db.Model):
    """A price and an ETA, offered against an open request.

    Accepting a quote is what creates the Booking, so the amount here becomes
    the booking total. Everything else on the row is the pitch: how long until
    they arrive, and whatever the provider wants to say about it.
    """

    __tablename__ = "job_quotes"

    quote_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)

    request_id = db.Column(
        db.String(36),
        db.ForeignKey("service_requests.request_id"),
        nullable=False,
        index=True,
    )
    provider_id = db.Column(
        db.String(36),
        db.ForeignKey("service_providers.provider_id"),
        nullable=False,
        index=True,
    )

    amount = db.Column(db.Numeric(12, 2), nullable=False)
    message = db.Column(db.Text)
    eta_minutes = db.Column(db.Integer)

    status = db.Column(
        db.Enum(*QUOTE_STATUSES, name="quote_status"), nullable=False, default="pending"
    )

    # --- Relationships ---
    request = db.relationship("ServiceRequest", back_populates="quotes")
    provider = db.relationship("ServiceProvider", back_populates="quotes")

    __table_args__ = (
        # One bid per provider per request. Without this a provider could
        # undercut themselves by quoting twice, and the resident would see the
        # same name at two prices with no way to tell which is current.
        db.UniqueConstraint("request_id", "provider_id", name="uq_quote_request_provider"),
    )

    def __repr__(self):
        return f"<JobQuote {self.quote_id} {self.status} {self.amount}>"
