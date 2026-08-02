"""Payment and wallet schemas."""

from marshmallow import fields, validate

from models import PAYMENT_METHODS, PAYMENT_STATUSES, Payment, UserWallet
from schemas.base import BaseAutoSchema, BaseSchema, money


class PaymentSchema(BaseAutoSchema):
    """A single money movement.

    Everything except the amount and method is dump_only: status and
    transaction_ref are set by the server when the gateway answers, never
    by the client — otherwise anyone could POST status='success'.
    """

    class Meta(BaseAutoSchema.Meta):
        model = Payment
        dump_only = (
            "payment_id",
            "user_id",
            "created_at",
            "status",
            "transaction_ref",
            "paid_at",
        )

    amount = money(required=True, validate=validate.Range(min=0.01))
    status = fields.String(dump_only=True)
    payment_method = fields.String(validate=validate.OneOf(PAYMENT_METHODS))


class PaymentCreateSchema(BaseSchema):
    """POST /api/payments — pay for a booking.

    `amount` is optional: leave it out to pay the balance still owing,
    which is what the "Pay now" button does.
    """

    booking_id = fields.String(required=True)
    amount = money(load_default=None, validate=validate.Range(min=0.01))
    payment_method = fields.String(
        load_default="mpesa", validate=validate.OneOf(PAYMENT_METHODS)
    )


class PaymentStatusSchema(BaseSchema):
    """PATCH /api/payments/<id> — the gateway callback, simulated.

    A real integration would verify a signature here before trusting the
    status. This project stands in for that with an admin-only endpoint.
    """

    status = fields.String(required=True, validate=validate.OneOf(PAYMENT_STATUSES))
    transaction_ref = fields.String(load_default=None)


class UserWalletSchema(BaseAutoSchema):
    """A stored balance."""

    class Meta(BaseAutoSchema.Meta):
        model = UserWallet
        dump_only = ("wallet_id", "user_id", "created_at", "updated_at", "balance")

    balance = money(dump_only=True)


class WalletTopUpSchema(BaseSchema):
    """POST /api/wallet/top-up."""

    amount = money(required=True, validate=validate.Range(min=1))
    payment_method = fields.String(
        load_default="mpesa",
        validate=validate.OneOf([m for m in PAYMENT_METHODS if m != "wallet"]),
    )
