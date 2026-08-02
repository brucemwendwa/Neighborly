"""
Users — the admin-facing directory.

A user manages their own account through /api/auth/me. Everything here is
about *other* people's accounts, so it is admin-only apart from the public
profile read.
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import or_, select

from models import USER_ROLES, User
from schemas import AdminUserUpdateSchema, UserSchema, UserSummarySchema
from controllers.utils import (
    body,
    delete,
    get_or_404,
    paginate,
    query_arg,
    role_required,
    save,
)

user_bp = Blueprint("users", __name__)


@user_bp.get("")
@role_required("admin")
def list_users():
    """GET /api/users?q=&role=&estate_id=&page= — admin only."""
    stmt = select(User)

    if q := query_arg("q"):
        like = f"%{q}%"
        stmt = stmt.where(
            or_(User.full_name.ilike(like), User.email.ilike(like), User.phone.ilike(like))
        )
    if role := query_arg("role"):
        stmt = stmt.where(User.role == role)
    if estate_id := query_arg("estate_id"):
        stmt = stmt.where(User.estate_id == estate_id)

    return jsonify(paginate(stmt.order_by(User.created_at.desc()), UserSchema))


@user_bp.get("/<user_id>")
@jwt_required()
def get_user(user_id):
    """GET /api/users/<id> — a public profile card.

    Returns the summary, not the full record: any signed-in neighbour can
    look up whoever is driving them to work, but not their email address.
    """
    user = get_or_404(User, user_id, "User")
    return jsonify(user=UserSummarySchema().dump(user))


@user_bp.patch("/<user_id>")
@role_required("admin")
def update_user(user_id):
    """PATCH /api/users/<id> — admin only, and the only way to change a role."""
    user = get_or_404(User, user_id, "User")
    data = body(AdminUserUpdateSchema, partial=True)

    for field, value in data.items():
        setattr(user, field, value)

    save(user)
    return jsonify(user=UserSchema().dump(user))


@user_bp.delete("/<user_id>")
@role_required("admin")
def delete_user(user_id):
    """DELETE /api/users/<id> — admin only.

    Their wallet, provider profile and notifications go with them
    (cascade="all, delete-orphan" on those relationships). Bookings and
    payments deliberately do not cascade: deleting an account must not
    erase the financial record attached to it, so this fails with a 409
    if the user has any. Suspend rather than delete an active member.
    """
    user = get_or_404(User, user_id, "User")
    delete(user)
    return jsonify(message="User deleted.")


@user_bp.get("/roles")
def list_roles():
    """GET /api/users/roles — the values `role` accepts.

    Lets the signup form build its dropdown from the server rather than
    hardcoding a list that will drift.
    """
    return jsonify(roles=list(USER_ROLES))
