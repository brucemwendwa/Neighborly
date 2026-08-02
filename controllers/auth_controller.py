"""
Authentication: register, sign in, refresh, and manage your own account.

The flow in one paragraph. Register or log in and you get back two tokens.
The *access* token is short-lived (24h here) and is sent on every request
in the `Authorization: Bearer ...` header. The *refresh* token is long-lived
(30 days), is only ever sent to /refresh, and buys a new access token
without asking for the password again. Nothing about the session is stored
server-side — the signature on the token is the proof.
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    current_user,
    jwt_required,
)
from sqlalchemy import select

from extensions import db
from models import Estate, ServiceProvider, User, UserWallet
from schemas import (
    LoginSchema,
    PasswordChangeSchema,
    RegisterSchema,
    UserSchema,
    UserUpdateSchema,
)
from controllers.utils import body, get_or_404, save

auth_bp = Blueprint("auth", __name__)

user_schema = UserSchema()


def issue_tokens(user):
    """Mint an access + refresh pair for `user`.

    The extra claims are a convenience, not a security boundary: the client
    can render the right nav without another request, but the server always
    re-reads the user from the database (see the user_lookup_loader in
    utils.py) rather than trusting a claim.
    """
    claims = {"role": user.role, "estate_id": user.estate_id}
    return {
        "token": create_access_token(identity=user, additional_claims=claims),
        "refresh_token": create_refresh_token(identity=user, additional_claims=claims),
    }


def auth_response(user, status=200):
    return jsonify(user=user_schema.dump(user), **issue_tokens(user)), status


@auth_bp.post("/register")
def register():
    """POST /api/auth/register — create an account and sign straight in."""
    data = body(RegisterSchema)

    # Checked up front so the client gets "that email is taken" on the
    # right field. The unique constraints in the database are still the
    # real guarantee — two simultaneous signups would both pass this check.
    if db.session.scalar(select(User).where(User.email == data["email"])):
        return jsonify(
            error="Validation failed",
            details={"email": ["That email is already registered."]},
        ), 409
    if db.session.scalar(select(User).where(User.phone == data["phone"])):
        return jsonify(
            error="Validation failed",
            details={"phone": ["That phone number is already registered."]},
        ), 409

    if data.get("estate_id"):
        get_or_404(Estate, data["estate_id"], "Estate")

    user = User(
        full_name=data["full_name"],
        email=data["email"].lower(),
        phone=data["phone"],
        role=data["role"],
        estate_id=data.get("estate_id"),
        profile_picture=data.get("profile_picture"),
    )
    # Goes through the property setter on the model, which bcrypts it.
    # The plaintext is never assigned to a column.
    user.password = data["password"]

    # Every user gets a wallet at signup rather than lazily on first use,
    # so no other code path has to handle "wallet might not exist yet".
    user.wallet = UserWallet()

    if user.role == "provider":
        user.provider_profile = ServiceProvider(bio=data.get("bio"))

    save(user)
    return auth_response(user, 201)


@auth_bp.post("/login")
def login():
    """POST /api/auth/login."""
    data = body(LoginSchema)
    user = db.session.scalar(select(User).where(User.email == data["email"].lower()))

    # One message for both "no such email" and "wrong password". Telling
    # them apart hands an attacker a list of which emails are registered.
    if user is None or not user.check_password(data["password"]):
        return jsonify(error="Incorrect email or password."), 401

    return auth_response(user)


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    """POST /api/auth/refresh — trade a refresh token for a new access token."""
    claims = {"role": current_user.role, "estate_id": current_user.estate_id}
    return jsonify(
        token=create_access_token(identity=current_user, additional_claims=claims),
        user=user_schema.dump(current_user),
    )


@auth_bp.get("/me")
@jwt_required()
def me():
    """GET /api/auth/me — who am I, according to the token I just sent?

    The client calls this on boot to confirm a stored token is still good
    and to pick up any profile change made elsewhere.
    """
    return jsonify(user=user_schema.dump(current_user))


@auth_bp.patch("/me")
@jwt_required()
def update_me():
    """PATCH /api/auth/me — edit your own profile.

    Note what UserUpdateSchema does not accept: role, email and password.
    A profile form must not be a privilege-escalation route.
    """
    data = body(UserUpdateSchema, partial=True)

    if data.get("estate_id"):
        get_or_404(Estate, data["estate_id"], "Estate")

    for field, value in data.items():
        setattr(current_user, field, value)

    save(current_user)
    return jsonify(user=user_schema.dump(current_user))


@auth_bp.post("/change-password")
@jwt_required()
def change_password():
    """POST /api/auth/change-password.

    The current password is required even though the caller is already
    authenticated — it is what stops someone with a borrowed unlocked
    laptop from locking the real owner out.
    """
    data = body(PasswordChangeSchema)

    if not current_user.check_password(data["current_password"]):
        return jsonify(
            error="Validation failed",
            details={"current_password": ["That is not your current password."]},
        ), 400

    current_user.password = data["new_password"]
    save(current_user)
    return jsonify(message="Password updated.")


@auth_bp.post("/logout")
@jwt_required(optional=True)
def logout():
    """POST /api/auth/logout.

    With stateless JWTs there is nothing to invalidate server-side: the
    client drops the token and it is gone. The endpoint exists so the
    client has one place to call, and so a token denylist can be added
    later without changing the frontend.
    """
    return jsonify(message="Signed out.")
