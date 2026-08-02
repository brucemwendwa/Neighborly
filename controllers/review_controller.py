"""
Reviews — feedback after a completed booking.

Three rules keep ratings meaningful, and all three are enforced here
because none of them is expressible in a schema:

  1. you must have been part of the booking
  2. the booking must be completed
  3. one review per person per booking (the database backs this up with a
     unique constraint, so a double-submit races into a 409, not a
     duplicate)
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import func, select

from extensions import db
from models import Booking, Review
from schemas import ReviewInputSchema, ReviewSchema, ReviewUpdateSchema
from controllers.utils import (
    body,
    delete,
    get_or_404,
    notify,
    paginate,
    query_arg,
    require_owner,
    save,
)

review_bp = Blueprint("reviews", __name__)

review_schema = ReviewSchema()


@review_bp.get("")
def list_reviews():
    """GET /api/reviews?reviewee_id=&booking_id=&page= — public.

    Reviews are public by design: their whole purpose is helping the next
    resident decide.
    """
    stmt = select(Review)

    if reviewee_id := query_arg("reviewee_id"):
        stmt = stmt.where(Review.reviewee_id == reviewee_id)
    if booking_id := query_arg("booking_id"):
        stmt = stmt.where(Review.booking_id == booking_id)
    if reviewer_id := query_arg("reviewer_id"):
        stmt = stmt.where(Review.reviewer_id == reviewer_id)

    return jsonify(paginate(stmt.order_by(Review.created_at.desc()), ReviewSchema))


@review_bp.get("/summary/<user_id>")
def rating_summary(user_id):
    """GET /api/reviews/summary/<user_id> — average and star breakdown.

    Aggregated in SQL rather than by loading every review: the provider
    card only needs five numbers and an average.
    """
    rows = db.session.execute(
        select(Review.rating, func.count(Review.review_id))
        .where(Review.reviewee_id == user_id)
        .group_by(Review.rating)
    ).all()

    breakdown = {str(star): 0 for star in range(1, 6)}
    total = 0
    weighted = 0
    for rating, count in rows:
        breakdown[str(rating)] = count
        total += count
        weighted += rating * count

    return jsonify(
        user_id=user_id,
        total=total,
        average=round(weighted / total, 1) if total else None,
        breakdown=breakdown,
    )


@review_bp.post("")
@jwt_required()
def create_review():
    """POST /api/reviews.

    `reviewee_id` may be omitted: for a normal booking the other party is
    unambiguous, so the server works it out. It is accepted explicitly only
    to let a provider review the customer.
    """
    data = body(ReviewInputSchema)
    booking = get_or_404(Booking, data["booking_id"], "Booking")

    is_customer = booking.user_id == current_user.user_id
    is_provider = booking.provider and booking.provider.user_id == current_user.user_id

    if not (is_customer or is_provider):
        return jsonify(error="You were not part of this booking."), 403
    if booking.status != "completed":
        return jsonify(error="You can review a booking once it is completed."), 409

    reviewee_id = data.get("reviewee_id")
    if not reviewee_id:
        if is_customer and booking.provider:
            reviewee_id = booking.provider.user_id
        elif is_provider:
            reviewee_id = booking.user_id
        else:
            return jsonify(error="This booking had no provider to review."), 409

    if reviewee_id == current_user.user_id:
        return jsonify(error="You cannot review yourself."), 400

    existing = db.session.scalar(
        select(Review)
        .where(Review.booking_id == booking.booking_id)
        .where(Review.reviewer_id == current_user.user_id)
    )
    if existing:
        return jsonify(error="You have already reviewed this booking."), 409

    review = Review(
        booking_id=booking.booking_id,
        reviewer_id=current_user.user_id,
        reviewee_id=reviewee_id,
        rating=data["rating"],
        comment=data.get("comment"),
    )

    notify(
        reviewee_id,
        f"New {data['rating']}-star review",
        f"{current_user.full_name} reviewed your work on {booking.service.name}.",
        type="review",
    )
    save(review)
    return jsonify(review=review_schema.dump(review)), 201


@review_bp.patch("/<review_id>")
@jwt_required()
def update_review(review_id):
    """PATCH /api/reviews/<id> — the author may revise their own words."""
    review = get_or_404(Review, review_id, "Review")
    require_owner(review.reviewer_id, "You can only edit your own review.")

    for field, value in body(ReviewUpdateSchema, partial=True).items():
        setattr(review, field, value)

    save(review)
    return jsonify(review=review_schema.dump(review))


@review_bp.delete("/<review_id>")
@jwt_required()
def delete_review(review_id):
    """DELETE /api/reviews/<id> — the author or an admin."""
    review = get_or_404(Review, review_id, "Review")
    require_owner(review.reviewer_id, "You can only delete your own review.")

    delete(review)
    return jsonify(message="Review deleted.")
