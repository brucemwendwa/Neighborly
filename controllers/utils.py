"""
Helpers every controller uses.

The point of this module is that a controller function should read as the
business rule and nothing else. Parsing, permission checks, pagination and
"not found" handling all happen here so they are written once and behave
identically on every endpoint.
"""

import functools
import secrets

from flask import request
from flask_jwt_extended import current_user, get_jwt_identity, verify_jwt_in_request
from werkzeug.exceptions import Forbidden, NotFound

from extensions import db, jwt
from models import JobStatusEvent, Notification, User

# --- JWT plumbing ---------------------------------------------------------
#
# These callbacks are registered on the JWTManager instance the moment this
# module is imported (which create_app does when it registers blueprints).
# They are what makes `current_user` inside a controller be a real User
# object rather than a bare id string.


@jwt.user_identity_loader
def user_identity(user):
    """Decide what goes in the token's `sub` claim.

    Accepts either a User or an id, and always stores a *string* — the JWT
    spec requires `sub` to be a string, and flask-jwt-extended 4.7 rejects
    anything else at token creation time.
    """
    return user.user_id if isinstance(user, User) else str(user)


@jwt.user_lookup_loader
def load_user(_jwt_header, jwt_data):
    """Turn the token's identity back into a User on every request.

    Returning None here makes flask-jwt-extended answer 401, which is the
    behaviour we want for a token belonging to a deleted account.
    """
    return db.session.get(User, jwt_data["sub"])


@jwt.unauthorized_loader
def missing_token(reason):
    return {"error": "Authentication required", "details": reason}, 401


@jwt.invalid_token_loader
def invalid_token(reason):
    return {"error": "Invalid token", "details": reason}, 401


@jwt.expired_token_loader
def expired_token(_header, _payload):
    return {"error": "Your session has expired. Please sign in again."}, 401


@jwt.revoked_token_loader
def revoked_token(_header, _payload):
    return {"error": "Token has been revoked"}, 401


# --- Permissions ----------------------------------------------------------


def role_required(*roles):
    """Require a signed-in user holding one of `roles`.

    Wraps verify_jwt_in_request(), so it replaces @jwt_required rather than
    stacking on top of it:

        @bp.post("/")
        @role_required("admin")
        def create(): ...
    """

    def decorator(view):
        @functools.wraps(view)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            if current_user.role not in roles:
                raise Forbidden(
                    f"This action is limited to: {', '.join(roles)}."
                )
            return view(*args, **kwargs)

        return wrapper

    return decorator


def is_admin(user=None):
    user = user or current_user
    return bool(user) and user.role == "admin"


def require_owner(owner_id, message="You can only change your own records."):
    """Allow the owner of a row, or any admin. Everyone else gets 403.

    Called *inside* a view rather than as a decorator because ownership is
    a property of the row being edited, which the view has to load first.
    """
    if current_user.user_id != owner_id and not is_admin():
        raise Forbidden(message)


def current_user_id():
    return get_jwt_identity()


# --- Request parsing ------------------------------------------------------


def body(schema, partial=False):
    """Validate the JSON body against `schema` and return a plain dict.

    A ValidationError raised here is caught by the handler in main.py and
    turned into a 400 with per-field messages, so no controller needs a
    try/except around this call.
    """
    payload = request.get_json(silent=True)
    if payload is None:
        payload = {}
    return schema(partial=partial).load(payload)


def query_arg(name, default=None):
    value = request.args.get(name, default)
    return value.strip() if isinstance(value, str) else value


def bool_arg(name):
    """Read a tri-state flag: True, False, or None when it was not sent."""
    raw = request.args.get(name)
    if raw is None:
        return None
    return raw.lower() in ("1", "true", "yes")


# --- Fetching -------------------------------------------------------------


def get_or_404(model, pk, label=None):
    """Load a row by primary key or raise 404 with a readable message."""
    instance = db.session.get(model, pk)
    if instance is None:
        raise NotFound(f"{label or model.__name__} not found.")
    return instance


def paginate(select_stmt, schema, per_page=20, max_per_page=100, **dump_kwargs):
    """Run a paginated query and return the standard list envelope.

    Every list endpoint answers the same shape, so the client can write one
    generic list hook:

        {"items": [...], "page": 1, "per_page": 20, "total": 57,
         "pages": 3, "total_pages": 3}

    `pages` and `total_pages` are the same number under two names: `pages`
    is what the existing screens read, `total_pages` is the conventional
    key. Cheaper to send twice than to break every caller renaming it.
    """
    page = request.args.get("page", 1, type=int)
    size = request.args.get("per_page", per_page, type=int)

    result = db.paginate(
        select_stmt,
        page=max(page, 1),
        per_page=min(max(size, 1), max_per_page),
        error_out=False,
    )
    return {
        "items": schema(many=True, **dump_kwargs).dump(result.items),
        "page": result.page,
        "per_page": result.per_page,
        "total": result.total,
        "pages": result.pages,
        "total_pages": result.pages,
    }


# --- Writing --------------------------------------------------------------


def save(*instances):
    """Add the given rows and commit.

    Any IntegrityError propagates to the handler in main.py, which rolls
    the session back and answers 409 — so a duplicate email is a clean
    error response rather than a 500 plus a poisoned session.
    """
    for instance in instances:
        db.session.add(instance)
    db.session.commit()
    return instances[0] if len(instances) == 1 else instances


def delete(instance):
    db.session.delete(instance)
    db.session.commit()


def notify(user_id, title, message, type="general"):
    """Queue an in-app notification.

    Added to the session but NOT committed: the caller commits it together
    with whatever caused it, so you can never end up telling someone their
    booking was accepted when the acceptance itself failed to save.
    """
    note = Notification(user_id=user_id, title=title, message=message, type=type)
    db.session.add(note)
    return note


def record_event(event_type, *, request=None, booking=None, note=None):
    """Append one line to a job's history.

    Uncommitted for the same reason as notify(): the trail and the transition
    it describes have to land together, or a job could show a "completed"
    event it never actually reached.

    This lives here rather than in a controller because both halves of the
    lifecycle write to it — job_controller for everything up to the accepted
    quote, booking_controller for the work itself. A booking that came from a
    request passes both, so the resident reads one continuous timeline
    instead of two that stop halfway.
    """
    event = JobStatusEvent(
        request_id=request.request_id if request else None,
        booking_id=booking.booking_id if booking else None,
        event_type=event_type,
        actor_id=current_user.user_id,
        note=note,
    )
    db.session.add(event)
    return event


def new_token(prefix):
    """A short unguessable reference — gate pass QR codes, payment refs."""
    return f"{prefix}-{secrets.token_hex(6).upper()}"
