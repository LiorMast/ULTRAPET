"""test_models.py — The models and the database constraints behave as documented in create-tables.sql.

Covers the joined-table user inheritance, the cascades and restrictions on delete, and that the CHECK constraints
reject invalid rows.
"""
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.database.models.catalog import Category, Product, Supplier
from app.database.models.orders import Order, PaymentMethod
from app.pricing import PriceRule
from app.database.models.users import AppUser, BusinessUser, StaffUser


def make_customer(email: str = "shop@example.com") -> BusinessUser:
    """Builds a business user with the required fields.

    Args:
        email: The sign-in email (lowercase).

    Returns:
        The unsaved BusinessUser.
    """
    customer = BusinessUser(email=email, full_name="Dana Cohen", company_name="Pet Shop Ltd")
    customer.set_password("secret-password")
    return customer


def make_product(category: Category, number: int = 1) -> Product:
    """Builds a product in a category.

    Args:
        category: Its category.
        number: A number that makes the slug unique.

    Returns:
        The unsaved Product.
    """
    return Product(
        slug=f"product-{number}",
        name={"he": "מזון", "en": "Food"},
        category=category,
        list_price=Decimal("100.00"),
    )


@pytest.fixture
def category(database) -> Category:
    """A saved category.

    Args:
        database: The test database session.

    Returns:
        The Category.
    """
    category = Category(slug="dry-dog-food", name={"he": "מזון יבש לכלבים", "en": "Dry Dog Food"})
    database.add(category)
    database.commit()
    return category


def test_users_are_stored_in_the_base_and_subtype_tables(database):
    staff = StaffUser(email="admin@ultrapet.co.il", full_name="Admin")
    staff.set_password("secret-password")
    database.add_all([staff, make_customer()])
    database.commit()

    rows = database.execute(text("SELECT email, user_type FROM app_users ORDER BY email")).all()
    assert rows == [("admin@ultrapet.co.il", "staff"), ("shop@example.com", "business")]
    assert database.execute(text("SELECT role FROM staff_users")).scalar_one() == "admin"
    assert database.execute(text("SELECT company_name FROM business_users")).scalar_one() == "Pet Shop Ltd"

    database.expunge_all()
    users = database.scalars(select(AppUser).order_by(AppUser.email)).all()
    assert [type(user) for user in users] == [StaffUser, BusinessUser]
    assert users[0].check_password("secret-password")
    assert not users[0].check_password("wrong")


def test_deleting_an_app_user_deletes_the_subtype_row(database):
    database.add(make_customer())
    database.commit()
    database.execute(text("DELETE FROM app_users"))
    database.commit()
    assert database.execute(text("SELECT count(*) FROM business_users")).scalar_one() == 0


def test_deleting_a_customer_deletes_their_price_rules_and_never_makes_them_general(database, category):
    customer = make_customer()
    database.add(customer)
    database.add(PriceRule(business_user=customer, category=category, kind="percent", value=Decimal(10)))
    database.commit()
    assert len(customer.price_rules) == 1  # loaded, so the ORM (not only the database) handles them

    database.delete(customer)
    database.commit()
    assert database.execute(text("SELECT count(*) FROM price_rules")).scalar_one() == 0


def test_a_category_with_products_cannot_be_deleted(database, category):
    database.add(make_product(category))
    database.commit()
    database.delete(category)
    with pytest.raises(IntegrityError, match="products_category_id_fkey"):
        database.commit()


def test_a_customer_with_orders_cannot_be_deleted(database):
    customer = make_customer()
    database.add(PaymentMethod(code="bit", name={"he": "ביט", "en": "Bit"}))
    database.add(
        Order(
            business_user=customer,
            payment_method_code="bit",
            subtotal=Decimal(2000),
            vat_percent=Decimal(18),
            vat_amount=Decimal(360),
            total=Decimal(2360),
        )
    )
    database.commit()
    database.delete(customer)
    with pytest.raises(IntegrityError, match="orders_business_user_id_fkey"):
        database.commit()


@pytest.mark.parametrize(
    ("fields", "constraint"),
    [
        ({"kind": "percent", "value": 10}, "price_rules_one_target_check"),  # no target
        ({"kind": "percent", "value": 10, "with_product": True, "with_category": True}, "price_rules_one_target_check"),
        ({"kind": "percent", "value": 120, "with_category": True}, "price_rules_percent_max_check"),
        ({"kind": "amount", "value": 0, "with_category": True}, "price_rules_value_check"),
        ({"kind": "percent", "value": -5, "with_category": True}, "price_rules_value_check"),  # no surcharges
        ({"kind": "fixed_price", "value": 50, "with_product": True}, "price_rules_fixed_price_target_check"),
        ({"kind": "fixed_price", "value": -5, "with_product": True, "with_customer": True}, "price_rules_value_check"),
        ({"kind": "rebate", "value": 5, "with_category": True, "with_customer": True}, "price_rules_kind_check"),
        (
            {"kind": "percent", "value": 5, "with_category": True, "starts_on": date(2026, 12, 1), "ends_on": date(2026, 11, 1)},
            "price_rules_dates_check",
        ),
    ],
)
def test_price_rule_checks_reject_invalid_rules(database, category, fields, constraint):
    product = make_product(category)
    customer = make_customer()
    database.add_all([product, customer])
    database.commit()
    fields = dict(fields)
    rule = PriceRule(
        kind=fields.pop("kind"),
        value=Decimal(fields.pop("value")),
        product_id=product.id if fields.pop("with_product", False) else None,
        category_id=category.id if fields.pop("with_category", False) else None,
        business_user_id=customer.id if fields.pop("with_customer", False) else None,
        **fields,
    )
    database.add(rule)
    with pytest.raises(IntegrityError, match=constraint):
        database.commit()


def test_general_percent_and_amount_discounts_are_valid(database, category):
    database.add_all(
        [
            PriceRule(category=category, kind="percent", value=Decimal("100")),
            PriceRule(category=category, kind="amount", value=Decimal("12.50")),
        ]
    )
    database.commit()


def test_a_customer_fixed_price_on_a_product_is_valid(database, category):
    product = make_product(category)
    customer = make_customer()
    database.add_all([product, customer])
    database.add(PriceRule(business_user=customer, product=product, kind="fixed_price", value=Decimal("79.90")))
    database.commit()


@pytest.mark.parametrize(
    ("model", "constraint"),
    [
        (lambda: make_customer("Shop@Example.com"), "app_users_email_check"),
        (lambda: Category(slug="birds", name={"en": "Birds"}), "categories_name_check"),
        (lambda: Category(slug="Birds Food", name={"he": "ציפורים"}), "categories_slug_check"),
    ],
)
def test_checks_reject_invalid_rows(database, model, constraint):
    database.add(model())
    with pytest.raises(IntegrityError, match=constraint):
        database.commit()


@pytest.mark.parametrize(
    ("coordinates", "constraint"),
    [
        ({"latitude": 91.0, "longitude": 10.0}, "suppliers_latitude_check"),
        ({"latitude": 10.0, "longitude": -181.0}, "suppliers_longitude_check"),
        ({"latitude": 10.0}, "suppliers_coordinates_check"),
        ({"longitude": 10.0}, "suppliers_coordinates_check"),
    ],
)
def test_supplier_coordinates_are_checked(database, coordinates, constraint):
    database.add(Supplier(name="Bad Location Ltd", **coordinates))
    with pytest.raises(IntegrityError, match=constraint):
        database.commit()


def test_a_supplier_location_is_stored_with_both_coordinates_or_none(database):
    database.add_all([Supplier(name="Madrid Feeds", latitude=40.4168, longitude=-3.7038), Supplier(name="No Location")])
    database.commit()
    located = database.scalar(select(Supplier).where(Supplier.name == "Madrid Feeds"))
    assert (located.latitude, located.longitude) == (40.4168, -3.7038)
    assert database.scalar(select(Supplier.latitude).where(Supplier.name == "No Location")) is None
