"""
Blueprint registry — the API's table of contents.

One tuple, one line per resource. main.py calls register_blueprints(app)
and this decides what the API surface is, so there is exactly one place to
look to answer "what endpoints exist?".

    /api/auth            register, login, refresh, me, change-password
    /api/users           admin directory + public profile cards
    /api/estates         the communities
    /api/categories      catalogue groupings
    /api/services        bookable offerings
    /api/providers       professional profiles, verification
    /api/bookings        the hub: order, accept, progress, complete
    /api/payments        the money ledger
    /api/wallet          stored balance and top-ups
    /api/listings        housing
    /api/moves           house moves
    /api/rides           carpooling, and the seats on each ride
    /api/gate-passes     visitor QR codes, and the gate scanner lookup
    /api/reviews         post-booking feedback
    /api/notifications   the bell
    /api/dashboard       one-call summary for the home screen
"""

from controllers.auth_controller import auth_bp
from controllers.booking_controller import booking_bp
from controllers.catalogue_controller import category_bp, service_bp
from controllers.dashboard_controller import dashboard_bp
from controllers.estate_controller import estate_bp
from controllers.gate_pass_controller import gate_pass_bp
from controllers.listing_controller import listing_bp
from controllers.move_controller import move_bp
from controllers.notification_controller import notification_bp
from controllers.payment_controller import payment_bp, wallet_bp
from controllers.provider_controller import provider_bp
from controllers.review_controller import review_bp
from controllers.job_controller import job_bp
from controllers.ride_controller import ride_bp
from controllers.user_controller import user_bp

# (blueprint, url_prefix)
BLUEPRINTS = (
    (auth_bp, "/api/auth"),
    (user_bp, "/api/users"),
    (estate_bp, "/api/estates"),
    (category_bp, "/api/categories"),
    (service_bp, "/api/services"),
    (provider_bp, "/api/providers"),
    (job_bp, "/api/requests"),
    (booking_bp, "/api/bookings"),
    (payment_bp, "/api/payments"),
    (wallet_bp, "/api/wallet"),
    (listing_bp, "/api/listings"),
    (move_bp, "/api/moves"),
    (ride_bp, "/api/rides"),
    (gate_pass_bp, "/api/gate-passes"),
    (review_bp, "/api/reviews"),
    (notification_bp, "/api/notifications"),
    (dashboard_bp, "/api/dashboard"),
)


def register_blueprints(app):
    """Mount every blueprint on the app."""
    for blueprint, prefix in BLUEPRINTS:
        app.register_blueprint(blueprint, url_prefix=prefix)


__all__ = ["BLUEPRINTS", "register_blueprints"]
