"""
Configuration objects, selected by the FLASK_ENV environment variable.

Nothing secret is hardcoded here — values come from the environment, with
development-only fallbacks so a fresh clone runs without setup.
"""

import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    """Settings shared by every environment."""

    # The fallbacks are long enough (>= 32 bytes) to satisfy PyJWT's HMAC
    # key-length check, so development runs without a warning on every
    # token. They are still development-only — ProductionConfig refuses to
    # start without real values.
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me-before-you-deploy-anything")

    # SQLite by default so the project runs with zero database setup.
    # Point DATABASE_URL at Postgres when you are ready:
    #   postgresql://user:password@localhost:5432/neighborly
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'neighborly.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT
    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY", "jwt-dev-secret-change-me-before-you-deploy-anything"
    )
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        hours=int(os.getenv("JWT_ACCESS_TOKEN_HOURS", "24"))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=int(os.getenv("JWT_REFRESH_TOKEN_DAYS", "30"))
    )

    # Where the React client runs, for CORS.
    CLIENT_URL = os.getenv("CLIENT_URL", "http://localhost:5173")

    JSON_SORT_KEYS = False


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = os.getenv("SQL_ECHO", "false").lower() == "true"


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


class ProductionConfig(Config):
    DEBUG = False

    def __init__(self):
        # Fail loudly rather than shipping the development fallbacks.
        for key in ("SECRET_KEY", "JWT_SECRET_KEY", "DATABASE_URL"):
            if not os.getenv(key):
                raise RuntimeError(f"{key} must be set in production")


config_map = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(name=None):
    """Return the config class for `name`, defaulting to FLASK_ENV."""
    name = name or os.getenv("FLASK_ENV", "development")
    return config_map.get(name, DevelopmentConfig)
