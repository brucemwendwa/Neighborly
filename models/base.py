"""
Shared building blocks for every model.

Two small mixins keep the 15 model files free of copy-pasted boilerplate.
"""

import uuid
from datetime import datetime, timezone

from extensions import db


def generate_uuid():
    """Primary keys are UUID strings rather than auto-incrementing integers.

    Reasons:
      - the client can generate an id before the row is inserted
      - the id does not leak how many rows the table holds
      - ids never collide if data from two environments is ever merged

    String(36) is used instead of a native UUID column so the same models
    run unchanged on both SQLite (local development) and Postgres.
    """
    return str(uuid.uuid4())


def utcnow():
    """Timezone-aware UTC timestamp.

    `datetime.utcnow()` is deprecated and returns a *naive* datetime, which
    silently compares wrong against aware ones. Always store UTC.
    """
    return datetime.now(timezone.utc)


class TimestampMixin:
    """Adds created_at / updated_at, maintained by the database layer."""

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class CreatedAtMixin:
    """For append-only tables where a row is never edited after insert."""

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
