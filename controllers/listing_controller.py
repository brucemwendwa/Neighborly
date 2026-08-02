"""
House listings — vacant units advertised inside an estate.

The browse endpoint carries the filters the housing page actually offers:
bedrooms, price range, verified-only. They are applied in SQL rather than
in Python so the database does the work and pagination stays correct.
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import or_, select

from models import HouseListing
from schemas import (
    HouseListingInputSchema,
    HouseListingSchema,
    HouseListingUpdateSchema,
    ListingVerificationSchema,
)
from controllers.utils import (
    body,
    bool_arg,
    delete,
    get_or_404,
    notify,
    paginate,
    query_arg,
    require_owner,
    role_required,
    save,
)

listing_bp = Blueprint("listings", __name__)

listing_schema = HouseListingSchema()


@listing_bp.get("")
def list_listings():
    """GET /api/listings?estate_id=&status=&bedrooms=&min_price=&max_price=
             &verified=&q=&page= — public.
    """
    stmt = select(HouseListing)

    if estate_id := query_arg("estate_id"):
        stmt = stmt.where(HouseListing.estate_id == estate_id)
    if status := query_arg("status"):
        stmt = stmt.where(HouseListing.status == status)
    if bedrooms := query_arg("bedrooms"):
        # "3" means "3 or more", which is how people actually search.
        stmt = stmt.where(HouseListing.bedrooms >= bedrooms)
    if min_price := query_arg("min_price"):
        stmt = stmt.where(HouseListing.rent_price >= min_price)
    if max_price := query_arg("max_price"):
        stmt = stmt.where(HouseListing.rent_price <= max_price)
    if (verified := bool_arg("verified")) is not None:
        stmt = stmt.where(HouseListing.is_verified.is_(verified))
    if q := query_arg("q"):
        like = f"%{q}%"
        stmt = stmt.where(
            or_(HouseListing.title.ilike(like), HouseListing.description.ilike(like))
        )

    return jsonify(
        paginate(stmt.order_by(HouseListing.created_at.desc()), HouseListingSchema)
    )


@listing_bp.get("/mine")
@jwt_required()
def my_listings():
    """GET /api/listings/mine — what I have advertised."""
    stmt = (
        select(HouseListing)
        .where(HouseListing.user_id == current_user.user_id)
        .order_by(HouseListing.created_at.desc())
    )
    return jsonify(paginate(stmt, HouseListingSchema))


@listing_bp.get("/<listing_id>")
def get_listing(listing_id):
    """GET /api/listings/<id> — public."""
    return jsonify(
        listing=listing_schema.dump(get_or_404(HouseListing, listing_id, "Listing"))
    )


@listing_bp.post("")
@jwt_required()
def create_listing():
    """POST /api/listings — advertise a unit in your own estate.

    New listings are unverified. They are still visible (an estate admin
    cannot be the bottleneck on every post) but the client shows the badge,
    so a renter knows which ones somebody has actually checked.
    """
    if not current_user.estate_id:
        return jsonify(error="Set your estate on your profile before listing."), 400

    listing = HouseListing(
        user_id=current_user.user_id,
        estate_id=current_user.estate_id,
        **body(HouseListingInputSchema),
    )
    save(listing)
    return jsonify(listing=listing_schema.dump(listing)), 201


@listing_bp.patch("/<listing_id>")
@jwt_required()
def update_listing(listing_id):
    """PATCH /api/listings/<id> — the landlord (or an admin) only."""
    listing = get_or_404(HouseListing, listing_id, "Listing")
    require_owner(listing.user_id, "You can only edit your own listings.")

    for field, value in body(HouseListingUpdateSchema, partial=True).items():
        setattr(listing, field, value)

    save(listing)
    return jsonify(listing=listing_schema.dump(listing))


@listing_bp.patch("/<listing_id>/verification")
@role_required("admin")
def verify_listing(listing_id):
    """PATCH /api/listings/<id>/verification — admin only.

    Verification is the whole reason a resident trusts this over a broker
    site, so it is deliberately not something the poster can set.
    """
    listing = get_or_404(HouseListing, listing_id, "Listing")
    listing.is_verified = body(ListingVerificationSchema)["is_verified"]

    notify(
        listing.user_id,
        "Listing verified" if listing.is_verified else "Verification removed",
        f'"{listing.title}" '
        + ("is now marked verified." if listing.is_verified else "is no longer verified."),
        type="listing",
    )
    save(listing)
    return jsonify(listing=listing_schema.dump(listing))


@listing_bp.delete("/<listing_id>")
@jwt_required()
def delete_listing(listing_id):
    """DELETE /api/listings/<id> — the landlord or an admin."""
    listing = get_or_404(HouseListing, listing_id, "Listing")
    require_owner(listing.user_id, "You can only delete your own listings.")

    delete(listing)
    return jsonify(message="Listing deleted.")
