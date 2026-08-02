"""
Payments and the wallet.

There is no real payment gateway here, and the code says so plainly rather
than pretending. `settle()` is the one function that would be replaced by
an M-Pesa STK push in production; everything around it — the ledger, the
balance arithmetic, the audit trail — is real and would not change.

Ledger rules worth keeping:
  * a payment row is never edited except to record what the gateway said
  * many payments per booking (deposit, balance, retry, refund)
  * the wallet balance moves only inside these endpoints
"""

from decimal import Decimal

from flask import Blueprint, jsonify
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import select

from extensions import db
from models import Booking, Payment, UserWallet
from models.base import utcnow
from schemas import (
    PaymentCreateSchema,
    PaymentSchema,
    PaymentStatusSchema,
    UserWalletSchema,
    WalletTopUpSchema,
)
from controllers.utils import (
    body,
    get_or_404,
    is_admin,
    new_token,
    notify,
    paginate,
    query_arg,
    role_required,
    save,
)

payment_bp = Blueprint("payments", __name__)
wallet_bp = Blueprint("wallet", __name__)

payment_schema = PaymentSchema()
wallet_schema = UserWalletSchema()


def amount_paid(booking):
    """What has actually cleared against this booking."""
    return sum(
        (p.amount for p in booking.payments if p.status == "success"), Decimal("0")
    )


def settle(payment, wallet):
    """Stand-in for the payment gateway.

    Wallet payments settle immediately because the money is already on the
    platform — we just move it. Card and M-Pesa are marked successful here
    for demonstration; a real integration would leave them 'pending' and
    let the gateway's webhook call PATCH /api/payments/<id>. Cash stays
    pending until the provider confirms they were handed the notes.
    """
    if payment.payment_method == "wallet":
        if wallet.balance < payment.amount:
            return False, "Not enough in your wallet. Top up and try again."
        wallet.balance = wallet.balance - payment.amount
        payment.status = "success"
    elif payment.payment_method == "cash":
        payment.status = "pending"
    else:
        payment.status = "success"

    if payment.status == "success":
        payment.paid_at = utcnow()
        payment.transaction_ref = new_token(payment.payment_method.upper())

    return True, None


# --- Payments -------------------------------------------------------------


@payment_bp.get("")
@jwt_required()
def list_payments():
    """GET /api/payments?booking_id=&status=&page= — my payment history."""
    stmt = select(Payment)

    if not (is_admin() and query_arg("all") == "true"):
        stmt = stmt.where(Payment.user_id == current_user.user_id)
    if booking_id := query_arg("booking_id"):
        stmt = stmt.where(Payment.booking_id == booking_id)
    if status := query_arg("status"):
        stmt = stmt.where(Payment.status == status)

    return jsonify(paginate(stmt.order_by(Payment.created_at.desc()), PaymentSchema))


@payment_bp.get("/<payment_id>")
@jwt_required()
def get_payment(payment_id):
    """GET /api/payments/<id>."""
    payment = get_or_404(Payment, payment_id, "Payment")
    if payment.user_id != current_user.user_id and not is_admin():
        return jsonify(error="That payment is not yours."), 403
    return jsonify(payment=payment_schema.dump(payment))


@payment_bp.post("")
@jwt_required()
def create_payment():
    """POST /api/payments — pay for a booking.

    Omit `amount` to pay whatever is still owing, which is what the
    "Pay now" button does. Overpaying is rejected rather than quietly
    accepted, because a refund is a much worse conversation than an error
    message.
    """
    data = body(PaymentCreateSchema)
    booking = get_or_404(Booking, data["booking_id"], "Booking")

    if booking.user_id != current_user.user_id and not is_admin():
        return jsonify(error="You can only pay for your own bookings."), 403
    if booking.status == "cancelled":
        return jsonify(error="This booking was cancelled."), 409

    outstanding = Decimal(booking.total_amount or 0) - amount_paid(booking)
    if outstanding <= 0:
        return jsonify(error="This booking is already paid in full."), 409

    amount = Decimal(data["amount"]) if data.get("amount") is not None else outstanding
    if amount > outstanding:
        return jsonify(
            error=f"That is more than the KES {outstanding} still owing."
        ), 400

    wallet = current_user.wallet or UserWallet(user_id=current_user.user_id)
    payment = Payment(
        booking_id=booking.booking_id,
        user_id=current_user.user_id,
        amount=amount,
        payment_method=data["payment_method"],
    )

    ok, problem = settle(payment, wallet)
    if not ok:
        return jsonify(error=problem), 402

    if payment.status == "success" and amount >= outstanding and booking.provider:
        notify(
            booking.provider.user_id,
            "Payment received",
            f"{current_user.full_name} paid KES {amount} for "
            f"{booking.service.name}.",
            type="payment",
        )

    save(payment, wallet)
    return jsonify(payment=payment_schema.dump(payment)), 201


@payment_bp.patch("/<payment_id>")
@role_required("admin")
def update_payment_status(payment_id):
    """PATCH /api/payments/<id> — record what the gateway decided.

    Admin-only stand-in for a signed webhook. A refund credits the payer's
    wallet, which is the only place outside the wallet endpoints where a
    balance moves.
    """
    payment = get_or_404(Payment, payment_id, "Payment")
    data = body(PaymentStatusSchema)
    previous = payment.status

    payment.status = data["status"]
    if data.get("transaction_ref"):
        payment.transaction_ref = data["transaction_ref"]

    if payment.status == "success" and previous != "success":
        payment.paid_at = utcnow()
    elif payment.status == "refunded" and previous == "success":
        wallet = payment.payer.wallet or UserWallet(user_id=payment.user_id)
        wallet.balance = wallet.balance + payment.amount
        db.session.add(wallet)
        notify(
            payment.user_id,
            "Payment refunded",
            f"KES {payment.amount} has been returned to your wallet.",
            type="payment",
        )

    save(payment)
    return jsonify(payment=payment_schema.dump(payment))


# --- Wallet ---------------------------------------------------------------


@wallet_bp.get("")
@jwt_required()
def get_wallet():
    """GET /api/wallet — balance plus recent activity."""
    wallet = current_user.wallet
    if wallet is None:
        # Only reachable for accounts created before wallets existed.
        wallet = UserWallet(user_id=current_user.user_id)
        save(wallet)

    recent = db.session.scalars(
        select(Payment)
        .where(Payment.user_id == current_user.user_id)
        .order_by(Payment.created_at.desc())
        .limit(10)
    ).all()

    return jsonify(
        wallet=wallet_schema.dump(wallet),
        recent_payments=PaymentSchema(many=True).dump(recent),
    )


@wallet_bp.post("/top-up")
@jwt_required()
def top_up():
    """POST /api/wallet/top-up — add funds.

    No Payment row is written: payments.booking_id is NOT NULL, and a
    top-up belongs to no booking. If topping up ever needs its own audit
    trail (it would, in production), that wants a `wallet_transactions`
    table rather than a nullable column on payments.
    """
    data = body(WalletTopUpSchema)
    wallet = current_user.wallet or UserWallet(user_id=current_user.user_id)

    wallet.balance = wallet.balance + Decimal(data["amount"])
    notify(
        current_user.user_id,
        "Wallet topped up",
        f"KES {data['amount']} added. New balance: KES {wallet.balance}.",
        type="payment",
    )

    save(wallet)
    return jsonify(wallet=wallet_schema.dump(wallet))
