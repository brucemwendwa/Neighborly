"""User — every human on the platform."""

from extensions import bcrypt, db
from models.base import TimestampMixin, generate_uuid

# Reused by the schemas and controllers so the allowed values are declared once.
USER_ROLES = ("resident", "provider", "admin", "security")


class User(TimestampMixin, db.Model):
    """A person, differentiated by `role`.

    A user with role='provider' additionally owns a ServiceProvider row
    holding their professional profile.
    """

    __tablename__ = "users"

    user_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20), unique=True, nullable=False, index=True)

    # Named _password_hash so the plaintext never gets assigned by accident.
    # Use the `password` property below to set it.
    _password_hash = db.Column("password_hash", db.String(255), nullable=False)

    role = db.Column(
        db.Enum(*USER_ROLES, name="user_role"), nullable=False, default="resident"
    )
    profile_picture = db.Column(db.String(255))

    # Nullable: platform admins do not belong to any single estate.
    estate_id = db.Column(db.String(36), db.ForeignKey("estates.estate_id"))

    # --- Relationships ---
    estate = db.relationship("Estate", back_populates="users")

    # One-to-one satellites. uselist=False is what makes them one-to-one;
    # without it SQLAlchemy would hand you a list.
    wallet = db.relationship(
        "UserWallet", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    provider_profile = db.relationship(
        "ServiceProvider",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # One-to-many
    bookings = db.relationship("Booking", back_populates="customer")
    payments = db.relationship("Payment", back_populates="payer")
    listings = db.relationship("HouseListing", back_populates="landlord")
    move_requests = db.relationship("MoveRequest", back_populates="requester")
    rides_offered = db.relationship("CommuteRide", back_populates="driver")
    rides_taken = db.relationship("RideBooking", back_populates="passenger")
    gate_passes = db.relationship("GatePass", back_populates="host")

    # Read-only shortcut straight through the join table, so you can ask
    # for a user's rides without stepping through RideBooking. viewonly
    # because joining a ride must go through RideBooking, which carries
    # seats_booked and amount.
    rides_joined = db.relationship(
        "CommuteRide",
        secondary="ride_bookings",
        viewonly=True,
        back_populates="passengers",
    )
    notifications = db.relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan"
    )

    # Reviews point at users TWICE, so each side must say which foreign key
    # it means. Without foreign_keys= SQLAlchemy cannot choose and raises
    # AmbiguousForeignKeysError at mapper configuration time.
    reviews_written = db.relationship(
        "Review", back_populates="reviewer", foreign_keys="Review.reviewer_id"
    )
    reviews_received = db.relationship(
        "Review", back_populates="reviewee", foreign_keys="Review.reviewee_id"
    )

    # --- Password handling ---
    @property
    def password(self):
        """Writing only. Reading a password back is never legitimate."""
        raise AttributeError("password is write-only")

    @password.setter
    def password(self, plaintext):
        self._password_hash = bcrypt.generate_password_hash(plaintext).decode("utf-8")

    def check_password(self, plaintext):
        """True if `plaintext` matches the stored hash."""
        return bcrypt.check_password_hash(self._password_hash, plaintext)

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
