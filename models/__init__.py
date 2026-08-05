"""
Model registry.

Importing every model here does two necessary jobs:

  1. It registers each class on SQLAlchemy's metadata. Alembic only sees
     tables that have been imported — a model nobody imports is invisible
     to `flask db migrate`, and it silently will not get a table.

  2. It lets the rest of the app write one flat import:
         from models import User, Booking, Payment

The relationships themselves are declared on the models, using
`back_populates` on BOTH sides. That is deliberate: `backref` would create
the reverse attribute invisibly, so you could not tell by reading
`booking.py` that `Booking` has a `payments` list. Writing both halves
means every relationship is greppable from either file.


HOW THE ERD MAPS ONTO THESE CLASSES
-----------------------------------

    Estate 1──∞ User 1──1 UserWallet
      │            1──1 ServiceProvider
      │            1──∞ Booking, Payment, HouseListing, MoveRequest,
      │                 CommuteRide (as driver), RideBooking (as passenger),
      │                 GatePass, Notification,
      │                 Review (as reviewer AND as reviewee)
      │
      ├──∞ ServiceRequest 1──∞ JobQuote ∞──1 ServiceProvider
      │            └──1 Booking          (created when a quote is accepted)
      │
      ├──∞ Booking ──1 Service ──1 ServiceCategory
      │       │      └──1 ServiceProvider
      │       ├──∞ Payment
      │       ├──∞ GatePass
      │       ├──∞ JobStatusEvent        (append-only history)
      │       └──∞ Review
      │
      ├──∞ HouseListing
      └──∞ CommuteRide 1──∞ RideBooking ∞──1 User (passenger)

Reading a SQLAlchemy relationship:

    db.relationship("Payment", back_populates="booking")
        -> "this booking has many payments"
        -> the payments table holds the booking_id column

    db.relationship("Booking", back_populates="payments")
        -> "this payment belongs to one booking"
        -> same foreign key, viewed from the other end

    uselist=False turns a one-to-many into a one-to-one.
    unique=True on the foreign key is what enforces that in the database.
"""

from models.base import CreatedAtMixin, TimestampMixin, generate_uuid, utcnow
from models.booking import BOOKING_STATUSES, BOOKING_TYPES, Booking
from models.commute_ride import RECURRENCE, RIDE_STATUSES, CommuteRide
from models.estate import Estate
from models.gate_pass import GATE_PASS_STATUSES, GatePass
from models.house_listing import LISTING_STATUSES, HouseListing
from models.job_quote import QUOTE_STATUSES, JobQuote
from models.job_status_event import JOB_EVENT_TYPES, JobStatusEvent
from models.move_request import MOVE_SERVICE_TYPES, MOVE_STATUSES, MoveRequest
from models.notification import Notification
from models.payment import PAYMENT_METHODS, PAYMENT_STATUSES, Payment
from models.review import Review
from models.ride_booking import RIDE_BOOKING_STATUSES, RideBooking
from models.service import Service
from models.service_category import ServiceCategory
from models.service_request import REQUEST_KINDS, REQUEST_STATUSES, ServiceRequest
from models.service_provider import ServiceProvider
from models.user import USER_ROLES, User
from models.user_wallet import UserWallet

__all__ = [
    # Models
    "Estate",
    "User",
    "UserWallet",
    "ServiceProvider",
    "ServiceCategory",
    "Service",
    "Booking",
    "ServiceRequest",
    "JobQuote",
    "JobStatusEvent",
    "Payment",
    "HouseListing",
    "MoveRequest",
    "CommuteRide",
    "RideBooking",
    "GatePass",
    "Review",
    "Notification",
    # Allowed enum values, so schemas and controllers reuse one definition
    "USER_ROLES",
    "BOOKING_TYPES",
    "BOOKING_STATUSES",
    "REQUEST_KINDS",
    "REQUEST_STATUSES",
    "QUOTE_STATUSES",
    "JOB_EVENT_TYPES",
    "PAYMENT_STATUSES",
    "PAYMENT_METHODS",
    "LISTING_STATUSES",
    "MOVE_SERVICE_TYPES",
    "MOVE_STATUSES",
    "RECURRENCE",
    "RIDE_STATUSES",
    "RIDE_BOOKING_STATUSES",
    "GATE_PASS_STATUSES",
    # Helpers
    "TimestampMixin",
    "CreatedAtMixin",
    "generate_uuid",
    "utcnow",
]
