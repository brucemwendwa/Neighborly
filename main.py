"""
Application entry point.

Uses the application factory pattern: `create_app()` builds and returns a
configured Flask app rather than creating one at import time. That gives us
    - a separate app per environment (development, testing, production)
    - tests that can spin up a fresh app with an in-memory database
    - no import-time side effects

Run it:
    pipenv run flask --app main run --debug
    pipenv run python main.py
"""

import os

from flask import Flask, jsonify

from config import get_config
from extensions import bcrypt, cors, db, jwt, migrate

# Importing the package registers every model on SQLAlchemy's metadata.
# Alembic can only generate migrations for tables it has seen, so this
# import must happen before create_app() runs — remove it and
# `flask db migrate` will cheerfully produce an empty migration.
import models  # noqa: F401


def create_app(config_name=None):
    """Build and return a configured Flask application."""
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))

    register_extensions(app)
    register_blueprints(app)
    register_error_handlers(app)
    register_shell_context(app)

    @app.get("/api/health")
    def health():
        """Check this first when something breaks.

        If it answers, Flask is fine and the database is reachable, so the
        problem is further in.
        """
        try:
            db.session.execute(db.text("SELECT 1"))
            return jsonify(status="ok", database="connected")
        except Exception as exc:
            return jsonify(status="degraded", database=str(exc)), 503

    return app


def register_extensions(app):
    """Bind each extension instance from extensions.py to this app."""
    db.init_app(app)

    # render_as_batch lets Alembic emit ALTER TABLE steps that SQLite can
    # actually run (it rebuilds the table). Harmless on Postgres.
    migrate.init_app(app, db, render_as_batch=True)

    jwt.init_app(app)
    bcrypt.init_app(app)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": [app.config["CLIENT_URL"]]}},
        supports_credentials=True,
    )


def register_blueprints(app):
    """Mount one blueprint per resource.

    controllers/ is empty for now. As you build each feature, add it here:

        from controllers.auth_controller import auth_bp
        app.register_blueprint(auth_bp, url_prefix="/api/auth")
    """
    pass


def register_error_handlers(app):
    """Turn exceptions into consistent JSON.

    Handled centrally so no controller needs its own try/except for the
    common cases — a controller can just raise and let this translate.
    """
    from marshmallow import ValidationError
    from sqlalchemy.exc import IntegrityError
    from werkzeug.exceptions import HTTPException

    @app.errorhandler(ValidationError)
    def handle_validation_error(err):
        # Raised by schemas/ when a request body fails validation.
        return jsonify(error="Validation failed", details=err.messages), 400

    @app.errorhandler(IntegrityError)
    def handle_integrity_error(err):
        # A database constraint rejected the write: duplicate email,
        # missing foreign key, rating outside 1-5.
        db.session.rollback()
        return jsonify(error="Database constraint violated"), 409

    @app.errorhandler(HTTPException)
    def handle_http_exception(err):
        return jsonify(error=err.description), err.code

    @app.errorhandler(Exception)
    def handle_unexpected(err):
        db.session.rollback()
        app.logger.exception("Unhandled exception")
        if app.debug:
            raise err
        return jsonify(error="Internal server error"), 500


def register_shell_context(app):
    """Preload models into `flask shell` so you can poke at data quickly."""

    @app.shell_context_processor
    def shell_context():
        import models as m

        return {"db": db, **{name: getattr(m, name) for name in m.__all__}}


app = create_app()


if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "5000")),
        debug=app.config.get("DEBUG", False),
    )
