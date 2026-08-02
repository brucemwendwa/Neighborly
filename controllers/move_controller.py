"""
Move requests — "I am moving house on Saturday, I need a truck and two
people to carry things."

Kept out of bookings for the reason move_request.py explains: a move has
two locations and its own lifecycle. That means its own status machine too:

    pending ──▶ assigned ──▶ in_progress ──▶ completed
       └────────────┴──────────────┴────────▶ cancelled
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import select

from models import MoveRequest
from schemas import MoveRequestInputSchema, MoveRequestSchema, MoveRequestUpdateSchema
from controllers.utils import (
    body,
    delete,
    get_or_404,
    is_admin,
    notify,
    paginate,
    query_arg,
    require_owner,
    save,
)

move_bp = Blueprint("moves", __name__)

move_schema = MoveRequestSchema()

TRANSITIONS = {
    "pending": {"assigned", "cancelled"},
    "assigned": {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


@move_bp.get("")
@jwt_required()
def list_moves():
    """GET /api/moves?status=&page= — my move requests.

    Providers and admins pass ?open=true to see unassigned work.
    """
    stmt = select(MoveRequest)

    if query_arg("open") == "true":
        if current_user.role not in ("provider", "admin"):
            return jsonify(error="Only providers can browse open moves."), 403
        stmt = stmt.where(MoveRequest.status == "pending")
    elif not (is_admin() and query_arg("all") == "true"):
        stmt = stmt.where(MoveRequest.user_id == current_user.user_id)

    if status := query_arg("status"):
        stmt = stmt.where(MoveRequest.status == status)

    return jsonify(
        paginate(stmt.order_by(MoveRequest.move_date.desc()), MoveRequestSchema)
    )


@move_bp.get("/<move_id>")
@jwt_required()
def get_move(move_id):
    """GET /api/moves/<id>."""
    move = get_or_404(MoveRequest, move_id, "Move request")
    if move.user_id != current_user.user_id and current_user.role not in (
        "admin",
        "provider",
    ):
        return jsonify(error="That move request is not yours."), 403
    return jsonify(move=move_schema.dump(move))


@move_bp.post("")
@jwt_required()
def create_move():
    """POST /api/moves."""
    move = MoveRequest(user_id=current_user.user_id, **body(MoveRequestInputSchema))
    save(move)
    return jsonify(move=move_schema.dump(move)), 201


@move_bp.patch("/<move_id>")
@jwt_required()
def update_move(move_id):
    """PATCH /api/moves/<id>.

    The requester edits the details; providers and admins drive the status.
    A resident may still cancel their own move at any point before it is
    finished.
    """
    move = get_or_404(MoveRequest, move_id, "Move request")
    data = body(MoveRequestUpdateSchema, partial=True)
    new_status = data.pop("status", None)
    is_requester = move.user_id == current_user.user_id

    if new_status and new_status != move.status:
        if new_status not in TRANSITIONS[move.status]:
            return jsonify(
                error=f"A {move.status} move cannot become {new_status}."
            ), 409
        if is_requester and new_status != "cancelled" and not is_admin():
            return jsonify(
                error="Only the assigned crew can move this request forward."
            ), 403
        if not is_requester and current_user.role not in ("provider", "admin"):
            return jsonify(error="That move request is not yours."), 403

        move.status = new_status
        if not is_requester:
            notify(
                move.user_id,
                f"Move {new_status.replace('_', ' ')}",
                f"Your move from {move.pickup_location} is now {new_status.replace('_', ' ')}.",
                type="move",
            )

    if data:
        require_owner(move.user_id, "You can only edit your own move request.")
        if move.status in ("completed", "cancelled"):
            return jsonify(error=f"This move is {move.status}."), 409
        for field, value in data.items():
            setattr(move, field, value)

    save(move)
    return jsonify(move=move_schema.dump(move))


@move_bp.delete("/<move_id>")
@jwt_required()
def delete_move(move_id):
    """DELETE /api/moves/<id> — the requester or an admin."""
    move = get_or_404(MoveRequest, move_id, "Move request")
    require_owner(move.user_id, "You can only delete your own move request.")

    delete(move)
    return jsonify(message="Move request deleted.")


@move_bp.get("/service-types")
def service_types():
    """GET /api/moves/service-types — what you can ask for."""
    from models import MOVE_SERVICE_TYPES

    return jsonify(service_types=list(MOVE_SERVICE_TYPES))
