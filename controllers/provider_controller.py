"""
Service providers — the professional profile hanging off a user.

Three audiences, three groups of endpoints:
  residents   browse approved providers before booking
  providers   create and edit their own profile
  admins      verify and approve (or suspend) them
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import select

from extensions import db
from models import Review, ServiceProvider, User
from schemas import (
    BookingSchema,
    ProviderInputSchema,
    ProviderVerificationSchema,
    ReviewSchema,
    ServiceProviderSchema,
)
from controllers.utils import (
    body,
    bool_arg,
    get_or_404,
    notify,
    paginate,
    query_arg,
    role_required,
    save,
)

provider_bp = Blueprint("providers", __name__)

provider_schema = ServiceProviderSchema()


@provider_bp.get("")
def list_providers():
    """GET /api/providers?q=&estate_id=&approved=&page= — public.

    Defaults to approved providers only. An admin reviewing the queue
    passes ?approved=false to see who is still waiting.
    """
    stmt = select(ServiceProvider).join(User, ServiceProvider.user_id == User.user_id)

    approved = bool_arg("approved")
    stmt = stmt.where(ServiceProvider.is_approved.is_(True if approved is None else approved))

    if q := query_arg("q"):
        stmt = stmt.where(User.full_name.ilike(f"%{q}%"))
    if estate_id := query_arg("estate_id"):
        stmt = stmt.where(User.estate_id == estate_id)

    return jsonify(paginate(stmt.order_by(User.full_name), ServiceProviderSchema))


@provider_bp.get("/me")
@jwt_required()
def my_profile():
    """GET /api/providers/me — the signed-in provider's own profile."""
    if current_user.provider_profile is None:
        return jsonify(error="You do not have a provider profile yet."), 404
    return jsonify(provider=provider_schema.dump(current_user.provider_profile))


@provider_bp.post("/me")
@jwt_required()
def create_my_profile():
    """POST /api/providers/me — become a provider.

    A resident who decides to start taking jobs gets both a profile and a
    role change in one call. The profile starts unverified and unapproved:
    creating it is a request to be listed, not the listing itself.
    """
    if current_user.provider_profile is not None:
        return jsonify(error="You already have a provider profile."), 409

    data = body(ProviderInputSchema)
    profile = ServiceProvider(user_id=current_user.user_id, bio=data.get("bio"))

    if current_user.role == "resident":
        current_user.role = "provider"

    save(profile, current_user)
    return jsonify(provider=provider_schema.dump(profile)), 201


@provider_bp.patch("/me")
@role_required("provider", "admin")
def update_my_profile():
    """PATCH /api/providers/me — edit your own bio."""
    profile = current_user.provider_profile
    if profile is None:
        return jsonify(error="You do not have a provider profile yet."), 404

    for field, value in body(ProviderInputSchema, partial=True).items():
        setattr(profile, field, value)
    save(profile)
    return jsonify(provider=provider_schema.dump(profile))


@provider_bp.get("/<provider_id>")
def get_provider(provider_id):
    """GET /api/providers/<id> — profile plus the reviews of that person."""
    profile = get_or_404(ServiceProvider, provider_id, "Provider")
    reviews = db.session.scalars(
        select(Review)
        .where(Review.reviewee_id == profile.user_id)
        .order_by(Review.created_at.desc())
    ).all()

    return jsonify(
        provider=provider_schema.dump(profile),
        reviews=ReviewSchema(many=True).dump(reviews),
    )


@provider_bp.get("/<provider_id>/jobs")
@jwt_required()
def provider_jobs(provider_id):
    """GET /api/providers/<id>/jobs — the work assigned to this provider."""
    profile = get_or_404(ServiceProvider, provider_id, "Provider")

    if current_user.user_id != profile.user_id and current_user.role != "admin":
        return jsonify(error="You can only view your own jobs."), 403

    return jsonify(jobs=BookingSchema(many=True).dump(profile.jobs))


@provider_bp.patch("/<provider_id>/verification")
@role_required("admin")
def set_verification(provider_id):
    """PATCH /api/providers/<id>/verification — admin only.

    Kept apart from the general profile PATCH so that "edit my bio" and
    "approve this provider" can never be the same request. Two flags,
    two meanings: verified = documents checked, approved = allowed to work.
    """
    profile = get_or_404(ServiceProvider, provider_id, "Provider")
    data = body(ProviderVerificationSchema, partial=True)

    for field, value in data.items():
        setattr(profile, field, value)

    if data.get("is_approved") is True:
        notify(
            profile.user_id,
            "You are approved",
            "Your provider profile has been approved. You can now accept jobs.",
            type="provider",
        )
    elif data.get("is_approved") is False:
        notify(
            profile.user_id,
            "Profile suspended",
            "An administrator has paused your ability to accept new jobs.",
            type="provider",
        )

    save(profile)
    return jsonify(provider=provider_schema.dump(profile))
