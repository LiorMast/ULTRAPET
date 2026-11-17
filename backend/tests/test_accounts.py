"""test_accounts.py — A business customer's profile (app/accounts.py): the customer's own (GET /api/account) and the
staff view of any customer (GET /api/staff/customers/<id>/profile): details, past orders, own discounts, activity.
"""
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from app.database.models.catalog import Category, Product
from app.database.models.orders import Order, OrderItem, PaymentMethod
from app.database.models.price_rules import PriceRule
from app.database.models.users import BusinessUser


@pytest.fixture
def history(database, customer):
    """Two orders of the customer (one line's product deleted later), another customer's order, and price rules: the
    customer's own (all products, a category, a product, a paused one) and a general one.

    Args:
        database: The test database session.
        customer: The signed-in customer of the fixtures.

    Returns:
        The customer.
    """
    customer.notes = "Pays late"
    customer.rivhit_customer_id = "R-17"
    dogs = Category(slug="dogs", name={"he": "כלבים", "en": "Dogs"})
    bone = Product(slug="bone", name={"he": "עצם", "en": "Bone"}, category=dogs)
    other = BusinessUser(email="other@example.com", full_name="Other", company_name="Other Shop", password="other-password")
    card = PaymentMethod(code="card", name={"he": "כרטיס", "en": "Card"})
    database.add_all([dogs, bone, other, card])
    database.flush()
    now = datetime.now(UTC)

    def order(user, created, total, items):
        """Adds one order.

        Args:
            user: Who ordered.
            created: When.
            total: Its total.
            items: Its lines.

        Returns:
            The order.
        """
        row = Order(business_user=user, payment_method=card, subtotal=total, vat_percent=Decimal(18), vat_amount=0,
                    total=total, created_at=created, items=items)
        database.add(row)
        return row

    order(customer, now - timedelta(days=30), Decimal("2400"), [
        OrderItem(product=bone, sku="B1", product_name=bone.name, quantity=10, unit_price=Decimal("240"), line_total=Decimal("2400")),
    ])
    order(customer, now - timedelta(days=2), Decimal("3000"), [
        OrderItem(product=None, product_name={"he": "מוצר שנמחק"}, quantity=3, unit_price=Decimal("1000"), line_total=Decimal("3000")),
    ])
    order(other, now, Decimal("5000"), [])
    database.add_all([
        PriceRule(business_user=customer, kind="percent", value=Decimal(5), starts_at=now - timedelta(days=10)),
        PriceRule(business_user=customer, category=dogs, kind="amount", value=Decimal(3), ends_at=now - timedelta(days=1)),
        PriceRule(business_user=customer, product=bone, kind="fixed_price", value=Decimal(200), starts_at=now - timedelta(days=60)),
        PriceRule(business_user=customer, category=dogs, kind="percent", value=Decimal(7), is_active=False),
        PriceRule(category=dogs, kind="percent", value=Decimal(10)),
    ])
    database.commit()
    return customer


def test_a_customer_reads_their_own_profile(customer_client, history):
    profile = customer_client.get("/api/account").get_json()
    customer = profile["customer"]
    assert (customer["companyName"], customer["email"], customer["isActive"]) == ("Pet Corner", "shop@example.com", True)
    assert customer["lastLoginAt"] and customer["lastSeenAt"]
    assert "notes" not in customer and "rivhitCustomerId" not in customer

    newest, oldest = profile["orders"]
    assert (newest["total"], newest["items"][0]["productSlug"], newest["items"][0]["productName"]) == (3000, None, {"he": "מוצר שנמחק"})
    assert (oldest["paymentMethod"], oldest["status"], oldest["paymentStatus"]) == ({"he": "כרטיס", "en": "Card"}, "submitted", "pending")
    assert oldest["items"] == [{"productName": {"he": "עצם", "en": "Bone"}, "sku": "B1", "quantity": 10, "unitPrice": 240,
                                "lineTotal": 2400, "productSlug": "bone"}]

    # Only the customer's own, switched-on rules (newest start first, open start last); never the general rule.
    discounts = profile["discounts"]
    assert [(d["kind"], d["value"], d["target"]["type"]) for d in discounts] == [
        ("percent", 5, "all"), ("fixed_price", 200, "product"), ("amount", 3, "category"),
    ]
    assert discounts[1]["target"]["name"] == {"he": "עצם", "en": "Bone"}
    assert discounts[2]["target"]["name"] == {"he": "כלבים", "en": "Dogs"} and discounts[2]["endsAt"]


def test_the_account_needs_a_sign_in(client):
    assert client.get("/api/account").status_code == 401


def test_the_account_is_for_customers_only(staff_client):
    assert staff_client.get("/api/account").status_code == 403


def test_staff_read_a_customers_full_profile(staff_client, history):
    profile = staff_client.get(f"/api/staff/customers/{history.id}/profile").get_json()
    assert (profile["customer"]["notes"], profile["customer"]["rivhitCustomerId"]) == ("Pays late", "R-17")
    assert profile["customer"]["lastLoginAt"] is None  # the customer never signed in here
    assert len(profile["orders"]) == 2
    assert [d["isActive"] for d in profile["discounts"]].count(False) == 1  # the paused rule too
    assert staff_client.get(f"/api/staff/customers/{uuid.uuid4()}/profile").status_code == 404


def test_a_customer_without_history_has_empty_lists(customer_client):
    profile = customer_client.get("/api/account").get_json()
    assert (profile["orders"], profile["discounts"]) == ([], [])
