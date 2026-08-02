"""
The service catalogue: categories and the services inside them.

Reads are public — the catalogue is the shop window, and the landing page
renders it before anyone signs in. Writes are admin-only, because the
catalogue is shared by every estate on the platform.

Two blueprints in one file because they are one feature: a category with no
services and a service with no category are both meaningless.
"""

from flask import Blueprint, jsonify
from sqlalchemy import or_, select

from extensions import db
from models import Service, ServiceCategory
from schemas import (
    ServiceCategoryInputSchema,
    ServiceCategorySchema,
    ServiceInputSchema,
    ServiceSchema,
)
from controllers.utils import body, delete, get_or_404, paginate, query_arg, role_required, save

category_bp = Blueprint("categories", __name__)
service_bp = Blueprint("services", __name__)

category_schema = ServiceCategorySchema()
service_schema = ServiceSchema()


# --- Categories -----------------------------------------------------------


@category_bp.get("")
def list_categories():
    """GET /api/categories — public. Powers the tiles on the home screen."""
    categories = db.session.scalars(
        select(ServiceCategory).order_by(ServiceCategory.name)
    ).all()
    return jsonify(
        items=ServiceCategorySchema(many=True).dump(categories), total=len(categories)
    )


@category_bp.get("/<category_id>")
def get_category(category_id):
    """GET /api/categories/<id>, with its services."""
    category = get_or_404(ServiceCategory, category_id, "Category")
    return jsonify(
        category=category_schema.dump(category),
        services=ServiceSchema(many=True).dump(category.services),
    )


@category_bp.post("")
@role_required("admin")
def create_category():
    """POST /api/categories — admin only."""
    category = ServiceCategory(**body(ServiceCategoryInputSchema))
    save(category)
    return jsonify(category=category_schema.dump(category)), 201


@category_bp.patch("/<category_id>")
@role_required("admin")
def update_category(category_id):
    """PATCH /api/categories/<id> — admin only."""
    category = get_or_404(ServiceCategory, category_id, "Category")
    for field, value in body(ServiceCategoryInputSchema, partial=True).items():
        setattr(category, field, value)
    save(category)
    return jsonify(category=category_schema.dump(category))


@category_bp.delete("/<category_id>")
@role_required("admin")
def delete_category(category_id):
    """DELETE /api/categories/<id> — admin only, and only when empty."""
    category = get_or_404(ServiceCategory, category_id, "Category")
    if category.services:
        return jsonify(
            error=f"Move or delete the {len(category.services)} service(s) in "
            f"{category.name} first."
        ), 409

    delete(category)
    return jsonify(message="Category deleted.")


# --- Services -------------------------------------------------------------


@service_bp.get("")
def list_services():
    """GET /api/services?q=&category_id=&max_price=&page= — public."""
    stmt = select(Service)

    if q := query_arg("q"):
        like = f"%{q}%"
        stmt = stmt.where(or_(Service.name.ilike(like), Service.description.ilike(like)))
    if category_id := query_arg("category_id"):
        stmt = stmt.where(Service.category_id == category_id)
    if max_price := query_arg("max_price"):
        stmt = stmt.where(Service.base_price <= max_price)

    return jsonify(paginate(stmt.order_by(Service.name), ServiceSchema, per_page=50))


@service_bp.get("/<service_id>")
def get_service(service_id):
    """GET /api/services/<id>."""
    return jsonify(service=service_schema.dump(get_or_404(Service, service_id, "Service")))


@service_bp.post("")
@role_required("admin")
def create_service():
    """POST /api/services — admin only."""
    data = body(ServiceInputSchema)
    get_or_404(ServiceCategory, data["category_id"], "Category")

    service = Service(**data)
    save(service)
    return jsonify(service=service_schema.dump(service)), 201


@service_bp.patch("/<service_id>")
@role_required("admin")
def update_service(service_id):
    """PATCH /api/services/<id> — admin only."""
    service = get_or_404(Service, service_id, "Service")
    data = body(ServiceInputSchema, partial=True)

    if data.get("category_id"):
        get_or_404(ServiceCategory, data["category_id"], "Category")

    for field, value in data.items():
        setattr(service, field, value)
    save(service)
    return jsonify(service=service_schema.dump(service))


@service_bp.delete("/<service_id>")
@role_required("admin")
def delete_service(service_id):
    """DELETE /api/services/<id> — admin only.

    Blocked once anyone has booked it: bookings.service_id is NOT NULL, so
    removing the service would orphan real history.
    """
    service = get_or_404(Service, service_id, "Service")
    if service.bookings:
        return jsonify(
            error=f"{service.name} has {len(service.bookings)} booking(s) and "
            "cannot be deleted."
        ), 409

    delete(service)
    return jsonify(message="Service deleted.")
