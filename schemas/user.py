"""User, registration and login schemas."""

from marshmallow import fields, validate, validates_schema, ValidationError

from models import USER_ROLES, User
from schemas.base import BaseAutoSchema, BaseSchema

# Reused by every schema that accepts a password.
PASSWORD_RULES = validate.Length(
    min=8, max=128, error="Password must be at least 8 characters."
)

# Kenyan-ish but permissive: digits, spaces, +, -, 9-15 characters.
PHONE_RULES = validate.Regexp(
    r"^\+?[0-9][0-9\s\-]{8,14}$", error="Enter a valid phone number."
)


class UserSummarySchema(BaseAutoSchema):
    """The slice of a user that is safe to embed anywhere.

    Bookings, reviews and rides all show "who", and none of them need the
    full record. Nesting this instead of UserSchema means an email address
    is never leaked as a side effect of listing rides.
    """

    class Meta(BaseAutoSchema.Meta):
        model = User
        fields = ("user_id", "full_name", "profile_picture", "role")


class UserSchema(BaseAutoSchema):
    """A full user, as returned to that user or to an admin.

    `_password_hash` is excluded rather than merely undeclared — with an
    auto-generated schema, forgetting to exclude a column means publishing
    it, so sensitive columns are named explicitly.
    """

    class Meta(BaseAutoSchema.Meta):
        model = User
        exclude = ("_password_hash",)
        dump_only = ("user_id", "created_at", "updated_at", "role")

    role = fields.String(dump_only=True)
    estate = fields.Nested("EstateSchema", dump_only=True)
    wallet = fields.Nested("UserWalletSchema", dump_only=True)
    provider_profile = fields.Nested("ServiceProviderSchema", dump_only=True)


class RegisterSchema(BaseSchema):
    """POST /api/auth/register."""

    full_name = fields.String(required=True, validate=validate.Length(min=2, max=120))
    email = fields.Email(required=True, validate=validate.Length(max=120))
    phone = fields.String(required=True, validate=PHONE_RULES)
    password = fields.String(required=True, load_only=True, validate=PASSWORD_RULES)

    # Self-registration cannot mint an admin. Promoting someone is an
    # admin-only action through PATCH /api/users/<id>.
    role = fields.String(
        load_default="resident",
        validate=validate.OneOf([r for r in USER_ROLES if r != "admin"]),
    )
    estate_id = fields.String(load_default=None)
    profile_picture = fields.String(load_default=None, validate=validate.Length(max=255))

    # Only read when role == 'provider'.
    bio = fields.String(load_default=None)

    @validates_schema
    def estate_required_for_residents(self, data, **kwargs):
        """Residents and providers must pick an estate; admins need not.

        This is a cross-field rule, so it cannot live on a single field —
        that is exactly what @validates_schema is for.
        """
        if data.get("role") in ("resident", "provider", "security") and not data.get(
            "estate_id"
        ):
            raise ValidationError({"estate_id": ["Choose the estate you live in."]})


class LoginSchema(BaseSchema):
    """POST /api/auth/login."""

    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True)


class UserUpdateSchema(BaseSchema):
    """PATCH /api/auth/me — the fields a user may change about themselves.

    Deliberately excludes `role` and `_password_hash`: privilege and
    credentials change through their own endpoints, never through a
    general profile update.
    """

    full_name = fields.String(validate=validate.Length(min=2, max=120))
    phone = fields.String(validate=PHONE_RULES)
    profile_picture = fields.String(allow_none=True, validate=validate.Length(max=255))
    estate_id = fields.String(allow_none=True)


class AdminUserUpdateSchema(UserUpdateSchema):
    """PATCH /api/users/<id> — everything above, plus role changes."""

    email = fields.Email(validate=validate.Length(max=120))
    role = fields.String(validate=validate.OneOf(USER_ROLES))


class PasswordChangeSchema(BaseSchema):
    """POST /api/auth/change-password."""

    current_password = fields.String(required=True, load_only=True)
    new_password = fields.String(required=True, load_only=True, validate=PASSWORD_RULES)

    @validates_schema
    def must_actually_change(self, data, **kwargs):
        if data.get("current_password") == data.get("new_password"):
            raise ValidationError(
                {"new_password": ["Choose a password you have not used here before."]}
            )
