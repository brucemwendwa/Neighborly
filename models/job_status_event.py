"""JobStatusEvent — the append-only trail of what happened to a job."""

from extensions import db
from models.base import CreatedAtMixin, generate_uuid

JOB_EVENT_TYPES = (
    "created",  # request posted
    "quoted",  # a provider bid
    "accepted",  # a quote was accepted; booking created
    "started",  # provider began the work
    "completed",  # provider marked it done
    "confirmed",  # resident confirmed and released payment
    "cancelled",
)


class JobStatusEvent(CreatedAtMixin, db.Model):
    """One line in a job's history.

    `Booking.status` answers "where is this now"; it cannot answer "who
    cancelled it, and when". Statuses are overwritten on every transition, so
    the previous value is gone the moment it changes. This table keeps each
    transition as its own row instead — which is what makes a dispute
    arguable, and what the resident sees as the timeline on the booking page.

    Append-only by design: CreatedAtMixin gives it no updated_at, and nothing
    in the API edits or deletes a row once written.
    """

    __tablename__ = "job_status_events"

    event_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)

    # A job can be traced from either end. Events before a quote is accepted
    # only have a request; events after it also have the booking, so both
    # columns are nullable and at least one is always set.
    request_id = db.Column(
        db.String(36), db.ForeignKey("service_requests.request_id"), index=True
    )
    booking_id = db.Column(
        db.String(36), db.ForeignKey("bookings.booking_id"), index=True
    )

    event_type = db.Column(
        db.Enum(*JOB_EVENT_TYPES, name="job_event_type"), nullable=False
    )

    # Nullable: some transitions are the system's doing, not a person's.
    actor_id = db.Column(db.String(36), db.ForeignKey("users.user_id"))
    note = db.Column(db.Text)

    # --- Relationships ---
    request = db.relationship("ServiceRequest", back_populates="events")
    booking = db.relationship("Booking", back_populates="events")
    actor = db.relationship("User")

    def __repr__(self):
        return f"<JobStatusEvent {self.event_type}>"
