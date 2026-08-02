"""
Estates — the gated communities everything else is scoped to.

The list is public and unpaginated on purpose: the signup form needs it
before anyone has a token, and a resident picking their estate wants the
whole dropdown, not page 1 of 3.
"""

from flask import Blueprint, jsonify
from sqlalchemy import select

from extensions import db
from models import Estate
from schemas import EstateInputSchema, EstateSchema
from controllers.utils import body, delete, get_or_404, query_arg, role_required, save

estate_bp = Blueprint("estates", __name__)

estate_schema = EstateSchema()


@estate_bp.get("")
def list_estates():
    """GET /api/estates?q= — public."""
    stmt = select(Estate).order_by(Estate.estate_name)
    if q := query_arg("q"):
        stmt = stmt.where(Estate.estate_name.ilike(f"%{q}%"))

    estates = db.session.scalars(stmt).all()
    return jsonify(items=EstateSchema(many=True).dump(estates), total=len(estates))


@estate_bp.get("/<estate_id>")
def get_estate(estate_id):
    """GET /api/estates/<id>."""
    return jsonify(estate=estate_schema.dump(get_or_404(Estate, estate_id, "Estate")))


@estate_bp.post("")
@role_required("admin")
def create_estate():
    """POST /api/estates — admin only."""
    estate = Estate(**body(EstateInputSchema))
    save(estate)
    return jsonify(estate=estate_schema.dump(estate)), 201


@estate_bp.patch("/<estate_id>")
@role_required("admin")
def update_estate(estate_id):
    """PATCH /api/estates/<id> — admin only."""
    estate = get_or_404(Estate, estate_id, "Estate")
    for field, value in body(EstateInputSchema, partial=True).items():
        setattr(estate, field, value)
    save(estate)
    return jsonify(estate=estate_schema.dump(estate))


@estate_bp.delete("/<estate_id>")
@role_required("admin")
def delete_estate(estate_id):
    """DELETE /api/estates/<id> — admin only.

    Refused while anyone still lives there. The foreign keys would refuse
    it anyway; checking first turns a 409 "constraint violated" into a
    sentence the admin can act on.
    """
    estate = get_or_404(Estate, estate_id, "Estate")
    if estate.users:
        return jsonify(
            error=f"{estate.estate_name} still has {len(estate.users)} member(s). "
            "Move them before deleting it."
        ), 409

    delete(estate)
    return jsonify(message="Estate deleted.")
