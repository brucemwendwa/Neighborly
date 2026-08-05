"""
Gate passes — the QR code a resident sends to an expected visitor.

Two very different callers:
  the resident  issues passes and sees their own
  security      looks one up by the code on the phone at the gate, and
                marks it used

The lookup endpoint is the interesting one: it is keyed on the token, not
on an id the guard would have to be told, and it is restricted to security
and admins so a leaked code alone reveals nothing.
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import select

from extensions import db
from models import Booking, GatePass
from models.base import as_utc, utcnow
from schemas import GatePassInputSchema, GatePassSchema, GatePassStatusSchema
from controllers.utils import (
    body,
    delete,
    get_or_404,
    is_admin,
    new_token,
    notify,
    paginate,
    query_arg,
    require_owner,
    role_required,
    save,
)

gate_pass_bp = Blueprint("gate_passes", __name__)

gate_pass_schema = GatePassSchema()


@gate_pass_bp.get("")
@jwt_required()
def list_gate_passes():
    """GET /api/gate-passes?status=&page=

    Residents see their own. Security sees every pass in their estate,
    which is what the guard house screen needs.
    """
    stmt = select(GatePass)

    if current_user.role == "security" or is_admin():
        if estate_id := (query_arg("estate_id") or current_user.estate_id):
            # .has() builds an EXISTS subquery against users — no join to
            # manage, and it composes with the other filters below.
            stmt = stmt.where(GatePass.host.has(estate_id=estate_id))
    else:
        stmt = stmt.where(GatePass.user_id == current_user.user_id)

    if status := query_arg("status"):
        stmt = stmt.where(GatePass.status == status)

    return jsonify(paginate(stmt.order_by(GatePass.entry_date.desc()), GatePassSchema))


@gate_pass_bp.get("/lookup/<qr_code>")
@role_required("security", "admin")
def lookup(qr_code):
    """GET /api/gate-passes/lookup/<code> — the gate scanner.

    Reports expiry as part of the answer rather than hiding it: the guard
    needs to see "this pass was for yesterday", not a bare 404.
    """
    gate_pass = db.session.scalar(select(GatePass).where(GatePass.qr_code == qr_code))
    if gate_pass is None:
        return jsonify(error="No pass matches that code."), 404

    # as_utc, because SQLite returns this column naive and comparing it
    # against an aware utcnow() raises — a 500 on the one screen a guard uses.
    expired = gate_pass.exit_date is not None and as_utc(gate_pass.exit_date) < utcnow()
    if expired and gate_pass.status == "active":
        gate_pass.status = "expired"
        save(gate_pass)

    return jsonify(
        gate_pass=gate_pass_schema.dump(gate_pass),
        admit=gate_pass.status == "active",
    )


@gate_pass_bp.get("/<gate_pass_id>")
@jwt_required()
def get_gate_pass(gate_pass_id):
    """GET /api/gate-passes/<id>."""
    gate_pass = get_or_404(GatePass, gate_pass_id, "Gate pass")
    if gate_pass.user_id != current_user.user_id and current_user.role not in (
        "security",
        "admin",
    ):
        return jsonify(error="That gate pass is not yours."), 403
    return jsonify(gate_pass=gate_pass_schema.dump(gate_pass))


@gate_pass_bp.post("")
@jwt_required()
def create_gate_pass():
    """POST /api/gate-passes — issue a pass.

    The QR token is minted server-side from secrets.token_hex. Sequential
    or guessable codes would let anyone walk in by trying numbers.
    """
    data = body(GatePassInputSchema)

    if data.get("booking_id"):
        booking = get_or_404(Booking, data["booking_id"], "Booking")
        if booking.user_id != current_user.user_id:
            return jsonify(error="That booking is not yours."), 403

    gate_pass = GatePass(
        user_id=current_user.user_id, qr_code=new_token("GP"), **data
    )
    save(gate_pass)
    return jsonify(gate_pass=gate_pass_schema.dump(gate_pass)), 201


@gate_pass_bp.patch("/<gate_pass_id>")
@jwt_required()
def update_gate_pass(gate_pass_id):
    """PATCH /api/gate-passes/<id> — mark a pass used or expired.

    Marking one 'used' is what the guard does on admitting the visitor, so
    only security and admins may do it. The host can expire their own pass
    if plans change.
    """
    gate_pass = get_or_404(GatePass, gate_pass_id, "Gate pass")
    data = body(GatePassStatusSchema)
    new_status = data["status"]

    is_host = gate_pass.user_id == current_user.user_id
    is_guard = current_user.role in ("security", "admin")

    if new_status == "used" and not is_guard:
        return jsonify(error="Only security can admit a visitor."), 403
    if not is_host and not is_guard:
        return jsonify(error="That gate pass is not yours."), 403

    gate_pass.status = new_status
    if data.get("exit_date"):
        gate_pass.exit_date = data["exit_date"]

    if new_status == "used" and not is_host:
        notify(
            gate_pass.user_id,
            "Visitor arrived",
            f"{gate_pass.visitor_name} was admitted at the gate.",
            type="gate_pass",
        )

    save(gate_pass)
    return jsonify(gate_pass=gate_pass_schema.dump(gate_pass))


@gate_pass_bp.delete("/<gate_pass_id>")
@jwt_required()
def delete_gate_pass(gate_pass_id):
    """DELETE /api/gate-passes/<id> — the host or an admin."""
    gate_pass = get_or_404(GatePass, gate_pass_id, "Gate pass")
    require_owner(gate_pass.user_id, "You can only delete your own gate passes.")

    delete(gate_pass)
    return jsonify(message="Gate pass deleted.")
