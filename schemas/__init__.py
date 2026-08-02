"""
Schema registry.

Same idea as models/__init__.py: import everything in one place so the rest
of the app can write

    from schemas import BookingSchema, BookingCreateSchema

There is a second reason here. Nested schemas referenced by *name* —
`fields.Nested("ServiceProviderSchema")` — are resolved through
marshmallow's class registry, and a class only lands in that registry once
its module has been imported. Names are used instead of direct imports
wherever two schemas reference each other (a booking embeds its payments,
a payment could embed its booking), which would otherwise be a circular
import.

Naming convention
-----------------
    XxxSchema         what the API returns (dump)
    XxxInputSchema    what the API accepts to create (load)
    XxxUpdateSchema   the same fields, all optional, for PATCH
    XxxSummarySchema  the trimmed version safe to embed in other payloads
"""

from schemas.base import BaseAutoSchema, BaseSchema, money
from schemas.booking import BookingCreateSchema, BookingSchema, BookingUpdateSchema
from schemas.catalogue import (
    ServiceCategoryInputSchema,
    ServiceCategorySchema,
    ServiceInputSchema,
    ServiceSchema,
    ServiceSummarySchema,
)
from schemas.estate import EstateInputSchema, EstateSchema
from schemas.gate_pass import GatePassInputSchema, GatePassSchema, GatePassStatusSchema
from schemas.listing import (
    HouseListingInputSchema,
    HouseListingSchema,
    HouseListingUpdateSchema,
    ListingVerificationSchema,
)
from schemas.move import (
    MoveRequestInputSchema,
    MoveRequestSchema,
    MoveRequestUpdateSchema,
)
from schemas.notification import (
    NotificationCreateSchema,
    NotificationReadSchema,
    NotificationSchema,
)
from schemas.payment import (
    PaymentCreateSchema,
    PaymentSchema,
    PaymentStatusSchema,
    UserWalletSchema,
    WalletTopUpSchema,
)
from schemas.provider import (
    ProviderInputSchema,
    ProviderVerificationSchema,
    ServiceProviderSchema,
)
from schemas.review import ReviewInputSchema, ReviewSchema, ReviewUpdateSchema
from schemas.ride import (
    CommuteRideInputSchema,
    CommuteRideSchema,
    CommuteRideUpdateSchema,
    RideBookingInputSchema,
    RideBookingSchema,
)
from schemas.user import (
    AdminUserUpdateSchema,
    LoginSchema,
    PasswordChangeSchema,
    RegisterSchema,
    UserSchema,
    UserSummarySchema,
    UserUpdateSchema,
)

__all__ = [
    "BaseSchema",
    "BaseAutoSchema",
    "money",
    # Users and auth
    "UserSchema",
    "UserSummarySchema",
    "RegisterSchema",
    "LoginSchema",
    "UserUpdateSchema",
    "AdminUserUpdateSchema",
    "PasswordChangeSchema",
    # Estates
    "EstateSchema",
    "EstateInputSchema",
    # Catalogue
    "ServiceCategorySchema",
    "ServiceCategoryInputSchema",
    "ServiceSchema",
    "ServiceSummarySchema",
    "ServiceInputSchema",
    # Providers
    "ServiceProviderSchema",
    "ProviderInputSchema",
    "ProviderVerificationSchema",
    # Bookings
    "BookingSchema",
    "BookingCreateSchema",
    "BookingUpdateSchema",
    # Money
    "PaymentSchema",
    "PaymentCreateSchema",
    "PaymentStatusSchema",
    "UserWalletSchema",
    "WalletTopUpSchema",
    # Housing
    "HouseListingSchema",
    "HouseListingInputSchema",
    "HouseListingUpdateSchema",
    "ListingVerificationSchema",
    # Moving
    "MoveRequestSchema",
    "MoveRequestInputSchema",
    "MoveRequestUpdateSchema",
    # Commute
    "CommuteRideSchema",
    "CommuteRideInputSchema",
    "CommuteRideUpdateSchema",
    "RideBookingSchema",
    "RideBookingInputSchema",
    # Gate passes
    "GatePassSchema",
    "GatePassInputSchema",
    "GatePassStatusSchema",
    # Reviews
    "ReviewSchema",
    "ReviewInputSchema",
    "ReviewUpdateSchema",
    # Notifications
    "NotificationSchema",
    "NotificationCreateSchema",
    "NotificationReadSchema",
]
