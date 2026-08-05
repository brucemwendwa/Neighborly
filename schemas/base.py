"""
Shared schema building blocks.

Marshmallow does two jobs here, and it helps to keep them apart:

  LOAD  (request  -> Python)  validate what the client sent, reject bad data
                              *before* it reaches the database.
  DUMP  (Python -> response)  turn model objects into JSON, deciding exactly
                              which columns are allowed out.

Two base classes, because those jobs want different defaults:

  BaseSchema      hand-written input schemas. Explicit fields only.
  BaseAutoSchema  response schemas generated from the SQLAlchemy model, so a
                  new column shows up in the API without editing two files.

Both set `unknown = EXCLUDE`: a client that sends extra keys gets them
ignored rather than a 400. The alternative (RAISE) turns every harmless
extra field into a failed request.
"""

from datetime import timezone

import sqlalchemy as sa
from marshmallow import EXCLUDE, Schema, fields
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema
from marshmallow_sqlalchemy.convert import ModelConverter


class UTCDateTime(fields.DateTime):
    """A datetime that always leaves with its timezone attached.

    Every timestamp is stored in UTC, but SQLite has no timezone type and
    hands the value back naive. Marshmallow then serialises it as
    "2026-08-05T13:44:40" — no offset — and `new Date(...)` in the browser
    reads an offset-less string as *local* time. In Nairobi that shifted
    every timestamp three hours into the past, so a request posted a moment
    ago rendered as "3 hours ago".

    Marking the value UTC before it is formatted makes the wire format
    unambiguous, which fixes it for every client rather than asking each one
    to know the convention.
    """

    def _serialize(self, value, attr, obj, **kwargs):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return super()._serialize(value, attr, obj, **kwargs)


class UTCModelConverter(ModelConverter):
    """Makes the auto-schemas reach for UTCDateTime.

    Response schemas derive their fields from the SQLAlchemy column types, so
    swapping the mapping here is what applies the fix across every model at
    once — no schema has to remember to declare its own timestamp fields.
    """

    SQLA_TYPE_MAPPING = {
        **ModelConverter.SQLA_TYPE_MAPPING,
        sa.DateTime: UTCDateTime,
    }


class BaseSchema(Schema):
    """Base for hand-written request schemas."""

    class Meta:
        unknown = EXCLUDE


class BaseAutoSchema(SQLAlchemyAutoSchema):
    """Base for response schemas derived from a model.

    Subclasses inherit this Meta so the shared options are declared once:

        class EstateSchema(BaseAutoSchema):
            class Meta(BaseAutoSchema.Meta):
                model = Estate
    """

    class Meta:
        unknown = EXCLUDE

        # Return plain dicts, not model instances. Controllers build model
        # objects themselves, which keeps the "what gets written" decision
        # in the controller where you can read it.
        load_instance = False

        # Expose foreign keys (user_id, estate_id...). The client needs them
        # to link records without a second round trip.
        include_fk = True

        # Timestamps leave with an explicit UTC offset — see UTCDateTime.
        model_converter = UTCModelConverter


def money(**kwargs):
    """A currency column.

    as_string=True is the important part. Python Decimal is not JSON
    serialisable, and float would reintroduce exactly the rounding drift
    that Numeric columns exist to avoid — so money crosses the wire as a
    string: "1500.00".
    """
    kwargs.setdefault("places", 2)
    return fields.Decimal(as_string=True, **kwargs)
