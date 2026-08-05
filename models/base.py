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


def as_utc(value):
    """Return `value` as an aware UTC datetime, or None.

    SQLite has no timezone type, so a `DateTime(timezone=True)` column hands
    its value back *naive* even though what was stored is UTC. Postgres hands
    the same column back aware. Comparing a naive value against `utcnow()`
    raises TypeError — which is a 500 on whichever endpoint does the
    comparing — so any timestamp read off a model has to come through here
    before it is compared in Python.

    Adding the offset only when it is missing keeps one code path correct on
    both backends: a no-op on Postgres, the missing UTC label on SQLite.
    (`UTCDateTime` in schemas/base.py does the same thing on the way out.)
    """
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


class TimestampMixin:
    """Adds created_at / updated_at, maintained by the database layer."""

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class CreatedAtMixin:
    """For append-only tables where a row is never edited after insert."""

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
