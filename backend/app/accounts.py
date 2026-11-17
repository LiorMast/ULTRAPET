"""accounts.py — A business customer's profile: their details, purchase history, own discounts and activity.

One shape for both readers: the customer reads their own (GET /api/account, customers blueprint) and staff read any
customer's (GET /api/staff/customers/<id>/profile, staff blueprint). Staff also get the internal fields (notes, the
Rivhit id) and the paused discounts; the customer never does. The frontend draws it with CustomerProfile.tsx.
"""
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database.db import db
from app.database.models.orders import Order, OrderItem
from app.database.models.price_rules import PriceRule
from app.database.models.users import BusinessUser


def customer_json(user: BusinessUser, staff: bool) -> dict[str, Any]:
    """The customer's details.

    Args:
        user: The customer.
        staff: True adds the internal fields (notes, rivhitCustomerId).

    Returns:
        {id, companyName, fullName, email, phone, businessNumber, city, address, isActive, createdAt, lastLoginAt,
        lastSeenAt} (+ notes, rivhitCustomerId for staff).
    """
    data: dict[str, Any] = {
        "id": user.id,
        "companyName": user.company_name,
        "fullName": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "businessNumber": user.business_number,
        "city": user.city,
        "address": user.address,
        "isActive": user.is_active,
        "createdAt": user.created_at,
        "lastLoginAt": user.last_login_at,
        "lastSeenAt": user.last_seen_at,
    }
    if staff:
        data |= {"notes": user.notes, "rivhitCustomerId": user.rivhit_customer_id}
    return data


def order_json(order: Order) -> dict[str, Any]:
    """One past order, with the amounts and lines copied when it was placed.

    Args:
        order: The order (its items, their products and the payment method loaded).

    Returns:
        {id, createdAt, status, paymentStatus, paymentMethod (translated name), subtotal, total, items: [{productName,
        sku, quantity, unitPrice, lineTotal, productSlug (null when the product was deleted)}]}.
    """
    return {
        "id": order.id,
        "createdAt": order.created_at,
        "status": order.status,
        "paymentStatus": order.payment_status,
        "paymentMethod": order.payment_method.name,
        "subtotal": order.subtotal,
        "total": order.total,
        "items": [
            {
                "productName": item.product_name,
                "sku": item.sku,
                "quantity": item.quantity,
                "unitPrice": item.unit_price,
                "lineTotal": item.line_total,
                "productSlug": item.product.slug if item.product else None,
            }
            for item in order.items
        ],
    }


def discount_json(rule: PriceRule) -> dict[str, Any]:
    """One of the customer's own price rules, with what it applies to.

    Args:
        rule: The rule (its category and product loaded).

    Returns:
        {id, kind, value, minQuantity, startsAt, endsAt, isActive, target: {type: "all" | "category" | "product",
        name (translated; null for "all")}}.
    """
    if rule.product is not None:
        target = {"type": "product", "name": rule.product.name}
    elif rule.category is not None:
        target = {"type": "category", "name": rule.category.name}
    else:
        target = {"type": "all", "name": None}
    return {
        "id": rule.id,
        "kind": rule.kind,
        "value": rule.value,
        "minQuantity": rule.min_quantity,
        "startsAt": rule.starts_at,
        "endsAt": rule.ends_at,
        "isActive": rule.is_active,
        "target": target,
    }


def profile_json(user: BusinessUser, staff: bool) -> dict[str, Any]:
    """The whole profile of a customer.

    Args:
        user: The customer.
        staff: True = the staff view (internal fields, paused discounts too); False = the customer's own view.

    Returns:
        {customer (customer_json), orders (newest first, order_json), discounts (the customer's own rules, newest
        start first, discount_json; the customer's view leaves out the paused ones)}.
    """
    orders = db.session.scalars(
        select(Order)
        .where(Order.business_user_id == user.id)
        .options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.payment_method))
        .order_by(Order.created_at.desc(), Order.id)
    ).all()
    rules = select(PriceRule).where(PriceRule.business_user_id == user.id)
    if not staff:
        rules = rules.where(PriceRule.is_active)
    discounts = db.session.scalars(
        rules.options(selectinload(PriceRule.category), selectinload(PriceRule.product))
        .order_by(PriceRule.starts_at.desc().nulls_last(), PriceRule.created_at.desc())
    ).all()
    return {
        "customer": customer_json(user, staff),
        "orders": [order_json(order) for order in orders],
        "discounts": [discount_json(rule) for rule in discounts],
    }
