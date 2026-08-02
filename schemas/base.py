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

from marshmallow import EXCLUDE, Schema, fields
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema


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


def money(**kwargs):
    """A currency column.

    as_string=True is the important part. Python Decimal is not JSON
    serialisable, and float would reintroduce exactly the rounding drift
    that Numeric columns exist to avoid — so money crosses the wire as a
    string: "1500.00".
    """
    kwargs.setdefault("places", 2)
    return fields.Decimal(as_string=True, **kwargs)
