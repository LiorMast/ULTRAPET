"""test_pricing.py — The price a customer pays (app.pricing): rule choice, stacking, periods and rounding.

Most tests call the pure functions with unsaved PriceRule objects; the last one prices a small catalog through
the database with customer_prices().
"""
from collections.abc import Iterable
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from app.database.models.catalog import Category, Product
from app.pricing import PriceRule, customer_prices, resolve_price
from app.database.models.users import BusinessUser

TODAY = date(2026, 11, 15)
PRODUCT = uuid.UUID(int=1)
CATEGORY = uuid.UUID(int=10)
LIST = Decimal("100.00")


def rule(kind: str, value: str, *, product: bool = False, created: int = 0, **fields) -> PriceRule:
    """Builds an unsaved rule on the test product or, by default, its category.

    Args:
        kind: 'percent', 'amount' or 'fixed_price'.
        value: Percent or shekels.
        product: True to target the product instead of the category.
        created: Days after 1 Oct 2026 the rule was created (decides ties between rules with the same start).
        **fields: Other PriceRule fields (starts_on, ends_on, is_active).

    Returns:
        The PriceRule.
    """
    target = {"product_id": PRODUCT} if product else {"category_id": CATEGORY}
    fields.setdefault("is_active", True)
    created_at = datetime(2026, 10, 1, tzinfo=UTC) + timedelta(days=created)
    return PriceRule(created_at=created_at, kind=kind, value=Decimal(value), **target, **fields)


def price(
    customer: Iterable[PriceRule] = (),
    general: Iterable[PriceRule] = (),
    list_price: Decimal | None = LIST,
    today: date = TODAY,
) -> Decimal | None:
    """Prices the test product.

    Args:
        customer: The customer's rules.
        general: The general rules.
        list_price: The product's list price.
        today: The date to price on.

    Returns:
        What resolve_price returns.
    """
    return resolve_price(list_price, customer, general, PRODUCT, CATEGORY, today)


def test_no_rules_gives_the_list_price():
    assert price() == Decimal("100.00")


def test_a_general_category_discount():
    assert price(general=[rule("percent", "10")]) == Decimal("90.00")


def test_a_product_rule_beats_a_category_rule_in_the_same_layer():
    assert price(general=[rule("percent", "10"), rule("percent", "5", product=True)]) == Decimal("95.00")
    assert price(customer=[rule("percent", "20"), rule("percent", "5", product=True)]) == Decimal("95.00")


def test_a_customer_discount_and_a_general_discount_multiply():
    assert price(customer=[rule("percent", "15")], general=[rule("percent", "10")]) == Decimal("76.50")


def test_amount_rules_take_shekels_off():
    assert price(general=[rule("amount", "12.50")]) == Decimal("87.50")
    # The customer's rule comes first: (100 - 10) x 0.9.
    assert price(customer=[rule("amount", "10")], general=[rule("percent", "10")]) == Decimal("81.00")


def test_a_price_never_goes_below_zero():
    assert price(general=[rule("amount", "150")]) == Decimal("0.00")
    assert price(customer=[rule("amount", "60")], general=[rule("amount", "50")]) == Decimal("0.00")


def test_a_customer_fixed_price_is_final():
    fixed = rule("fixed_price", "80", product=True)
    assert price(customer=[fixed, rule("percent", "50")], general=[rule("percent", "10")]) == Decimal("80.00")


def test_a_fixed_price_applies_without_a_list_price():
    assert price(customer=[rule("fixed_price", "80", product=True)], list_price=None) == Decimal("80.00")


def test_no_list_price_and_no_fixed_price_means_no_price():
    assert price(customer=[rule("percent", "10")], list_price=None) is None


def test_rules_apply_only_inside_their_period():
    day = timedelta(days=1)
    assert price(general=[rule("percent", "10", starts_on=TODAY + day)]) == LIST  # not started
    assert price(general=[rule("percent", "10", ends_on=TODAY - day)]) == LIST  # expired
    assert price(general=[rule("percent", "10", starts_on=TODAY, ends_on=TODAY)]) == Decimal("90.00")  # inclusive
    assert price(general=[rule("percent", "10", starts_on=TODAY - 365 * day)]) == Decimal("90.00")  # open-ended


def test_a_paused_rule_is_ignored():
    assert price(general=[rule("percent", "10", is_active=False)]) == LIST


def test_a_temporary_deal_overrides_permanent_terms_while_it_lasts():
    permanent = rule("percent", "5", created=1)
    november = rule("percent", "15", created=2, starts_on=date(2026, 11, 1), ends_on=date(2026, 11, 30))
    assert price(customer=[permanent, november]) == Decimal("85.00")
    assert price(customer=[permanent, november], today=date(2026, 12, 1)) == Decimal("95.00")


def test_between_rules_with_the_same_start_the_newest_wins():
    assert price(general=[rule("percent", "10", created=7), rule("percent", "20", created=3)]) == Decimal("90.00")


def test_prices_round_half_up_to_agorot():
    # 1.65 x 0.9 = 1.485: half-up gives 1.49 (banker's rounding would give 1.48).
    assert price(general=[rule("percent", "10")], list_price=Decimal("1.65")) == Decimal("1.49")


def test_customer_prices_uses_only_this_customer_and_the_general_rules(database):
    food = Category(slug="food", name={"he": "מזון"})
    toys = Category(slug="toys", name={"he": "צעצועים"})
    me, other = (
        BusinessUser(email=f"{name}@example.com", full_name=name, company_name=name, password_hash="x")
        for name in ("me", "other")
    )

    def product(number: int, category: Category, list_price: str | None, **fields) -> Product:
        """Builds a product.

        Args:
            number: A number that makes its slug and name unique.
            category: Its category.
            list_price: Its list price, or None.
            **fields: Other Product fields (is_active).

        Returns:
            The Product.
        """
        return Product(
            slug=f"p{number}",
            name={"he": f"מוצר {number}"},
            category=category,
            list_price=Decimal(list_price) if list_price else None,
            **fields,
        )

    p1, p2, p3 = product(1, food, "100.00"), product(2, food, "50.00"), product(3, toys, "20.00")
    database.add_all(
        [
            p1,
            p2,
            p3,
            product(4, toys, None),  # no price: left out
            product(5, toys, "10.00", is_active=False),  # hidden: left out
            PriceRule(business_user=me, category=food, kind="percent", value=Decimal(10)),
            PriceRule(business_user=me, product=p2, kind="fixed_price", value=Decimal("30.00")),
            PriceRule(business_user=other, category=toys, kind="percent", value=Decimal(50)),  # someone else's
            PriceRule(category=toys, kind="percent", value=Decimal(25), ends_on=TODAY - timedelta(days=1)),  # expired
            PriceRule(product=p1, kind="percent", value=Decimal(10)),
        ]
    )
    database.commit()

    assert customer_prices(me.id, TODAY) == {p1.id: Decimal("81.00"), p2.id: Decimal("30.00"), p3.id: Decimal("20.00")}
