"""UserWallet — a stored balance, one per user."""

from extensions import db
from models.base import TimestampMixin, generate_uuid


class UserWallet(TimestampMixin, db.Model):
    """One-to-one with User.

    `balance` is Numeric, never Float. Floating point cannot represent 0.1
    exactly, so money stored as a float drifts by fractions of a cent and
    those errors compound over thousands of transactions.
    """

    __tablename__ = "user_wallets"

    wallet_id = db.Column(db.String(36), primary_key=True, default=generate_uuid)

    # unique=True is what enforces "one wallet per user" at the database
    # level. The relationship's uselist=False only affects Python.
    user_id = db.Column(
        db.String(36), db.ForeignKey("users.user_id"), nullable=False, unique=True
    )

    balance = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    currency = db.Column(db.String(3), nullable=False, default="KES")

    user = db.relationship("User", back_populates="wallet")

    def __repr__(self):
        return f"<UserWallet {self.currency} {self.balance}>"
