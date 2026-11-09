"""pricing.py — The price a business customer pays, computed from list prices and price rules.

The PriceRule model (table price_rules, app/database/models/price_rules.py) holds every discount and special price staff
set. The functions below turn a product's list price and those rules into the customer's price:

1. A rule counts only while active: `is_active` and starts_at <= now < ends_at (a missing time = no limit; the end
   is exclusive, so a rule staff end "now" stops applying at once).
2. Four layers are picked separately: the customer's own regular rules, the general regular rules, then the
   customer's bulk rules and the general bulk rules (rules with `min_quantity`, which count only when the order line
   has at least that many units of the product). In each layer a product rule beats a category rule, which beats a
   customer's rule on every product (no category and no product); among bulk rules
   on the same target the highest threshold reached wins (tiers: 10 units -> 5%, 50 units -> 10%); then the rule
   that started last wins (no start = earliest), so a temporary deal overrides permanent terms while it lasts.
3. A customer fixed price is final. Otherwise the layers stack in that order: each discount is taken off the price so
   far, starting from the list price (a percent rule: x (1 - value / 100); an amount rule: - value), never going
   below 0, and the result is rounded half-up to agorot once.

The catalog's unit price (`customer_prices`) is the price of one unit, so bulk rules never change it; an order line
is priced with `resolve_price(..., quantity=<units>)`.

`pick_rule` and `resolve_price` are pure (no database), so they are unit-tested directly; `customer_prices` loads
the data for the catalog. Column meanings are documented in create-tables.sql.
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from collections.abc import Iterable
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select

from app.database.db import db
from app.database.models.price_rules import PriceRule

ISRAEL = ZoneInfo("Asia/Jerusalem")
AGORA = Decimal("0.01")
HUNDRED = Decimal(100)


def now() -> datetime:
    """Returns the current moment, the time price rule periods are checked against.

    Returns:
        The current time (timezone-aware, UTC).
    """
    return datetime.now(UTC)


def rule_age(rule: PriceRule) -> tuple[datetime, datetime, uuid.UUID]:
    """Sorts rules from oldest to newest: later start first, then later creation, then id as a stable last resort.

    Args:
        rule: The rule.

    Returns:
        The sort key; the largest key is the rule that wins.
    """
    earliest = datetime.min.replace(tzinfo=UTC)
    return (rule.starts_at or earliest, rule.created_at or datetime.min.replace(tzinfo=UTC), rule.id or uuid.UUID(int=0))


def pick_rule(
    rules: Iterable[PriceRule],
    product_id: uuid.UUID,
    category_id: uuid.UUID,
    at: datetime,
    bulk_quantity: int | None = None,
) -> PriceRule | None:
    """Chooses the one rule of a layer that applies to a product at a moment.

    A rule on the product beats a rule on its category, which beats a rule on every product (a customer's discount
    with neither a category nor a product). In the bulk layer, among rules on the same target the highest
    threshold reached wins. Then the one with the latest start wins (no start counts as the earliest), then the most
    recently created one (ids are random UUIDs, so they say nothing about age; they only break an exact tie, to keep
    the choice stable).

    Args:
        rules: Rules of one audience (one customer's rules, or the general rules); others are ignored.
        product_id: The product being priced.
        category_id: The product's category.
        at: The moment to price at.
        bulk_quantity: None = pick from the regular rules (no min_quantity); a number of units = pick from the bulk
            rules whose min_quantity is at most that number.

    Returns:
        The winning rule, or None when no active rule of the layer targets the product or its category.
    """
    active = [
        rule
        for rule in rules
        if rule.applies_at(at)
        and (
            rule.min_quantity is None
            if bulk_quantity is None
            else rule.min_quantity is not None and rule.min_quantity <= bulk_quantity
        )
    ]
    for matches in (
        lambda rule: rule.product_id == product_id,
        lambda rule: rule.product_id is None and rule.category_id == category_id,
        lambda rule: rule.product_id is None and rule.category_id is None,
    ):
        candidates = [rule for rule in active if matches(rule)]
        if candidates:
            return max(candidates, key=lambda rule: (rule.min_quantity or 0, *rule_age(rule)))
    return None


def apply_rule(price: Decimal, rule: PriceRule) -> Decimal:
    """Takes one percent or amount discount off a price.

    Args:
        price: The price so far, in shekels before VAT.
        rule: A 'percent' or 'amount' rule (its value is positive).

    Returns:
        The new price (unrounded), never below 0.
    """
    changed = price - rule.value if rule.kind == "amount" else price * (1 - rule.value / HUNDRED)
    return max(changed, Decimal(0))


def resolve_price(
    list_price: Decimal | None,
    customer_rules: Iterable[PriceRule],
    general_rules: Iterable[PriceRule],
    product_id: uuid.UUID,
    category_id: uuid.UUID,
    at: datetime,
    quantity: int = 1,
) -> Decimal | None:
    """Computes the unit price one customer pays for one product, bought in a given quantity.

    Args:
        list_price: The product's list price, or None when it has none.
        customer_rules: The customer's own rules (regular and bulk).
        general_rules: The rules for all customers (percent and amount rules, regular and bulk).
        product_id: The product being priced.
        category_id: The product's category.
        at: The moment to price at.
        quantity: Units of the product on the order line; bulk rules with a min_quantity above it are ignored.

    Returns:
        The unit price in shekels before VAT, rounded to agorot; None when the product has no price for this
        customer (no list price and no fixed price).
    """
    customer_rules, general_rules = list(customer_rules), list(general_rules)
    customer_rule = pick_rule(customer_rules, product_id, category_id, at)
    if customer_rule is not None and customer_rule.kind == "fixed_price":
        return customer_rule.value.quantize(AGORA, ROUND_HALF_UP)
    if list_price is None:
        return None

    layers = (
        customer_rule,
        pick_rule(general_rules, product_id, category_id, at),
        pick_rule(customer_rules, product_id, category_id, at, bulk_quantity=quantity),
        pick_rule(general_rules, product_id, category_id, at, bulk_quantity=quantity),
    )
    price = list_price
    for layer_rule in layers:
        if layer_rule is not None:
            price = apply_rule(price, layer_rule)
    return price.quantize(AGORA, ROUND_HALF_UP)


def customer_prices(business_user_id: uuid.UUID, at: datetime | None = None) -> dict[uuid.UUID, Decimal]:
    """Prices every active product for one customer (the B2B catalog).

    Loads the active products and the rules that can apply (the customer's and the general ones, within their
    period) in two queries, then resolves each product in memory.

    Args:
        business_user_id: The signed-in customer.
        at: The moment to price at; defaults to now.

    Returns:
        Product id -> unit price in shekels before VAT. Products without a price for this customer are left out.
    """
    from app.database.models.catalog import Product

    at = at or now()
    products = db.session.execute(
        select(Product.id, Product.category_id, Product.list_price).where(Product.is_active)
    ).all()
    rules = db.session.scalars(
        select(PriceRule).where(
            PriceRule.is_active,
            or_(PriceRule.business_user_id == business_user_id, PriceRule.business_user_id.is_(None)),
            or_(PriceRule.starts_at.is_(None), PriceRule.starts_at <= at),
            or_(PriceRule.ends_at.is_(None), PriceRule.ends_at > at),
        )
    ).all()

    # Index the rules by target and layer, so each product only looks at the rules that can apply to it.
    # A rule with neither target covers every product (key ("category", None), which no product's category matches).
    by_target: dict[tuple[bool, str, uuid.UUID | None], list[PriceRule]] = defaultdict(list)
    for rule in rules:
        target = ("product", rule.product_id) if rule.product_id is not None else ("category", rule.category_id)
        by_target[(rule.business_user_id is not None, *target)].append(rule)
    every_product = by_target[(True, "category", None)]

    prices: dict[uuid.UUID, Decimal] = {}
    for product_id, category_id, list_price in products:
        own = by_target[(True, "product", product_id)] + by_target[(True, "category", category_id)] + every_product
        general = by_target[(False, "product", product_id)] + by_target[(False, "category", category_id)]
        price = resolve_price(list_price, own, general, product_id, category_id, at)
        if price is not None:
            prices[product_id] = price
    return prices
