"""pricing.py — The price a business customer pays, computed from list prices and price rules.

The PriceRule model (table price_rules, app/models/price_rules.py) holds every discount, price increase and special
price staff set. The functions below turn a product's list price and those rules into the customer's price:

1. A rule counts only while active: `is_active` and starts_on <= today <= ends_on (a missing date = no limit),
   where today is the date in Israel.
2. Two layers are picked separately: the customer's own rules and the general rules. In each layer a product rule
   beats a category rule; among rules on the same target the one that started last wins (no start = earliest),
   so a temporary deal overrides permanent terms while it lasts.
3. A customer fixed price is final. Otherwise the layers stack:
   list price x (1 - or + the customer's percent) x (1 - the general discount), rounded half-up to agorot once.

`pick_rule` and `resolve_price` are pure (no database), so they are unit-tested directly; `customer_prices` loads
the data for the catalog. Column meanings are documented in create-tables.sql.
"""
from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select

from app.db import db
from app.models.price_rules import PriceRule

ISRAEL = ZoneInfo("Asia/Jerusalem")
AGORA = Decimal("0.01")
HUNDRED = Decimal(100)


def israel_today() -> date:
    """Returns today's date in Israel, the day price rule periods are counted in.

    Returns:
        The current date in Asia/Jerusalem.
    """
    return datetime.now(ISRAEL).date()


def pick_rule(rules: Iterable[PriceRule], product_id: int, category_id: int, today: date) -> PriceRule | None:
    """Chooses the one rule of a layer that applies to a product today.

    A rule on the product beats a rule on its category. Among rules on the same target, the one with the latest
    start wins (no start counts as the earliest), then the highest id (the newest rule).

    Args:
        rules: Rules of one layer (one customer's rules, or the general rules); others are ignored.
        product_id: The product being priced.
        category_id: The product's category.
        today: The Israel date to price on.

    Returns:
        The winning rule, or None when no active rule targets the product or its category.
    """
    active = [rule for rule in rules if rule.applies_on(today)]
    for matches in (
        lambda rule: rule.product_id == product_id,
        lambda rule: rule.product_id is None and rule.category_id == category_id,
    ):
        candidates = [rule for rule in active if matches(rule)]
        if candidates:
            return max(candidates, key=lambda rule: (rule.starts_on or date.min, rule.id or 0))
    return None


def resolve_price(
    list_price: Decimal | None,
    customer_rules: Iterable[PriceRule],
    general_rules: Iterable[PriceRule],
    product_id: int,
    category_id: int,
    today: date,
) -> Decimal | None:
    """Computes the price one customer pays for one product.

    Args:
        list_price: The product's list price, or None when it has none.
        customer_rules: The customer's own rules.
        general_rules: The rules for all customers (discounts only).
        product_id: The product being priced.
        category_id: The product's category.
        today: The Israel date to price on.

    Returns:
        The unit price in shekels before VAT, rounded to agorot; None when the product has no price for this
        customer (no list price and no fixed price).
    """
    customer_rule = pick_rule(customer_rules, product_id, category_id, today)
    if customer_rule is not None and customer_rule.kind == "fixed_price":
        return customer_rule.value.quantize(AGORA, ROUND_HALF_UP)
    if list_price is None:
        return None

    price = list_price
    if customer_rule is not None:
        sign = -1 if customer_rule.kind == "discount" else 1
        price *= 1 + sign * customer_rule.value / HUNDRED
    general_rule = pick_rule(general_rules, product_id, category_id, today)
    if general_rule is not None:
        price *= 1 - general_rule.value / HUNDRED
    return price.quantize(AGORA, ROUND_HALF_UP)


def customer_prices(business_user_id: int, today: date | None = None) -> dict[int, Decimal]:
    """Prices every active product for one customer (the B2B catalog).

    Loads the active products and the rules that can apply (the customer's and the general ones, within their
    period) in two queries, then resolves each product in memory.

    Args:
        business_user_id: The signed-in customer.
        today: The Israel date to price on; defaults to today.

    Returns:
        Product id -> unit price in shekels before VAT. Products without a price for this customer are left out.
    """
    from app.models.catalog import Product

    today = today or israel_today()
    products = db.session.execute(
        select(Product.id, Product.category_id, Product.list_price).where(Product.is_active)
    ).all()
    rules = db.session.scalars(
        select(PriceRule).where(
            PriceRule.is_active,
            or_(PriceRule.business_user_id == business_user_id, PriceRule.business_user_id.is_(None)),
            or_(PriceRule.starts_on.is_(None), PriceRule.starts_on <= today),
            or_(PriceRule.ends_on.is_(None), PriceRule.ends_on >= today),
        )
    ).all()

    # Index the rules by target and layer, so each product only looks at the rules that can apply to it.
    by_target: dict[tuple[bool, str, int], list[PriceRule]] = defaultdict(list)
    for rule in rules:
        target = ("product", rule.product_id) if rule.product_id is not None else ("category", rule.category_id)
        by_target[(rule.business_user_id is not None, *target)].append(rule)

    prices: dict[int, Decimal] = {}
    for product_id, category_id, list_price in products:
        own = by_target[(True, "product", product_id)] + by_target[(True, "category", category_id)]
        general = by_target[(False, "product", product_id)] + by_target[(False, "category", category_id)]
        price = resolve_price(list_price, own, general, product_id, category_id, today)
        if price is not None:
            prices[product_id] = price
    return prices
