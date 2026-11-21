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

`price_detail` also says which kinds of discount made the price lower than the list price ("customer": the customer's
own rule, "general": a rule for all customers), so the catalog can show a ribbon per kind, the list price struck out
and the total percentage; `bulk_tiers` gives the unit price at each bulk threshold (a footnote under the price) (`customer_price_details`, answered by GET /api/prices). Each kind's ribbon color is the
setting `discount_ribbon_colors` (`ribbon_colors`, defaults RIBBON_COLOR_DEFAULTS), chosen by staff in /admin/discounts.

`pick_rule`, `price_detail` and `resolve_price` are pure (no database), so they are unit-tested directly;
`customer_price_details` / `customer_prices` load the data for the catalog. Column meanings are documented in
create-tables.sql.
"""
from __future__ import annotations

import uuid
import re
from collections import defaultdict
from collections.abc import Iterable
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import NamedTuple
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select

from app.database.db import db
from app.database.models.price_rules import PriceRule
from app.database.models.settings import get_setting

ISRAEL = ZoneInfo("Asia/Jerusalem")
AGORA = Decimal("0.01")
HUNDRED = Decimal(100)

# The kinds of discount the catalog shows a ribbon for, in display order, and each one's default ribbon color
# (brand red, brand charcoal) until staff choose their own (setting "discount_ribbon_colors").
DISCOUNT_TYPES = ("general", "customer")
RIBBON_COLOR_DEFAULTS = {"general": "#BE1E24", "customer": "#1A1A1A"}
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class PriceDetail(NamedTuple):
    """A customer's unit price of one product, with what it came from.

    Attributes:
        price: The unit price in shekels before VAT, rounded to agorot.
        list_price: The product's list price; None when it has none (a fixed price only).
        discounts: The kinds of discount that lowered the price below the list price, in DISCOUNT_TYPES order
            ("general", "customer"); empty when the price is not below the list price.
        bulk: The bulk tiers (BulkTier) that lower the unit price further, by threshold; empty when there are none.
    """

    price: Decimal
    list_price: Decimal | None
    discounts: tuple[str, ...]
    bulk: tuple[BulkTier, ...] = ()


class BulkTier(NamedTuple):
    """A bulk price of one product: the unit price when one order line has at least `min_quantity` units.

    Attributes:
        min_quantity: The threshold, in units.
        price: The unit price from that many units on, in shekels before VAT (every layer applied, bulk included).
    """

    min_quantity: int
    price: Decimal


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


def price_detail(
    list_price: Decimal | None,
    customer_rules: Iterable[PriceRule],
    general_rules: Iterable[PriceRule],
    product_id: uuid.UUID,
    category_id: uuid.UUID,
    at: datetime,
    quantity: int = 1,
) -> PriceDetail | None:
    """Computes the unit price one customer pays for one product, bought in a given quantity, and which kinds of
    discount lowered it.

    Args:
        list_price: The product's list price, or None when it has none.
        customer_rules: The customer's own rules (regular and bulk).
        general_rules: The rules for all customers (percent and amount rules, regular and bulk).
        product_id: The product being priced.
        category_id: The product's category.
        at: The moment to price at.
        quantity: Units of the product on the order line; bulk rules with a min_quantity above it are ignored.

    Returns:
        The PriceDetail (price rounded to agorot; `discounts` lists "general" / "customer" when a rule of that audience
        applied and the price ends below the list price); None when the product has no price for this customer (no
        list price and no fixed price).
    """
    customer_rules, general_rules = list(customer_rules), list(general_rules)
    customer_rule = pick_rule(customer_rules, product_id, category_id, at)
    if customer_rule is not None and customer_rule.kind == "fixed_price":
        fixed = customer_rule.value.quantize(AGORA, ROUND_HALF_UP)
        lower = list_price is not None and fixed < list_price
        return PriceDetail(fixed, list_price, ("customer",) if lower else ())
    if list_price is None:
        return None

    layers = (
        ("customer", customer_rule),
        ("general", pick_rule(general_rules, product_id, category_id, at)),
        ("customer", pick_rule(customer_rules, product_id, category_id, at, bulk_quantity=quantity)),
        ("general", pick_rule(general_rules, product_id, category_id, at, bulk_quantity=quantity)),
    )
    price = list_price
    applied: set[str] = set()
    for audience, layer_rule in layers:
        if layer_rule is not None:
            price = apply_rule(price, layer_rule)
            applied.add(audience)
    price = price.quantize(AGORA, ROUND_HALF_UP)
    discounts = tuple(kind for kind in DISCOUNT_TYPES if kind in applied) if price < list_price else ()
    return PriceDetail(price, list_price, discounts)


def bulk_tiers(
    list_price: Decimal | None,
    customer_rules: Iterable[PriceRule],
    general_rules: Iterable[PriceRule],
    product_id: uuid.UUID,
    category_id: uuid.UUID,
    at: datetime,
) -> tuple[BulkTier, ...]:
    """The bulk tiers of one product for one customer: the unit price at each bulk threshold that lowers it.

    Every active bulk rule that could apply (product, category or store-wide, of both audiences) gives a threshold; the
    product is priced at each one with price_detail (so the tiers follow the same layering and target precedence as
    the cart), and a threshold is kept only when its price is below the previous tier's (or the one-unit price).

    Args:
        list_price: The product's list price, or None when it has none.
        customer_rules: The customer's own rules (regular and bulk).
        general_rules: The rules for all customers.
        product_id: The product.
        category_id: The product's category.
        at: The moment to price at.

    Returns:
        The tiers, lowest threshold first; empty when no bulk rule lowers the price (or under a fixed price).
    """
    customer_rules, general_rules = list(customer_rules), list(general_rules)
    unit = price_detail(list_price, customer_rules, general_rules, product_id, category_id, at)
    if unit is None:
        return ()
    thresholds = sorted(
        {
            rule.min_quantity
            for rule in (*customer_rules, *general_rules)
            if rule.min_quantity is not None
            and rule.applies_at(at)
            and rule.product_id in (product_id, None)
            and (rule.product_id is not None or rule.category_id in (category_id, None))
        }
    )
    tiers: list[BulkTier] = []
    best = unit.price
    for quantity in thresholds:
        detail = price_detail(list_price, customer_rules, general_rules, product_id, category_id, at, quantity)
        if detail is not None and detail.price < best:
            tiers.append(BulkTier(quantity, detail.price))
            best = detail.price
    return tuple(tiers)


def resolve_price(
    list_price: Decimal | None,
    customer_rules: Iterable[PriceRule],
    general_rules: Iterable[PriceRule],
    product_id: uuid.UUID,
    category_id: uuid.UUID,
    at: datetime,
    quantity: int = 1,
) -> Decimal | None:
    """Computes the unit price one customer pays for one product, bought in a given quantity (price_detail's price).

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
    detail = price_detail(list_price, customer_rules, general_rules, product_id, category_id, at, quantity)
    return None if detail is None else detail.price


def customer_price_details(business_user_id: uuid.UUID, at: datetime | None = None) -> dict[uuid.UUID, PriceDetail]:
    """Prices every active product for one customer (the B2B catalog).

    Loads the active products and the rules that can apply (the customer's and the general ones, within their
    period) in two queries, then resolves each product in memory.

    Args:
        business_user_id: The signed-in customer.
        at: The moment to price at; defaults to now.

    Returns:
        Product id -> PriceDetail (unit price in shekels before VAT, list price, the kinds of discount that lowered
        it, the bulk tiers). Products without a price for this customer are left out.
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

    details: dict[uuid.UUID, PriceDetail] = {}
    for product_id, category_id, list_price in products:
        own = by_target[(True, "product", product_id)] + by_target[(True, "category", category_id)] + every_product
        general = by_target[(False, "product", product_id)] + by_target[(False, "category", category_id)]
        detail = price_detail(list_price, own, general, product_id, category_id, at)
        if detail is not None:
            bulk = bulk_tiers(list_price, own, general, product_id, category_id, at)
            details[product_id] = detail._replace(bulk=bulk) if bulk else detail
    return details


def customer_prices(business_user_id: uuid.UUID, at: datetime | None = None) -> dict[uuid.UUID, Decimal]:
    """Prices every active product for one customer (the catalog's price sorts and price range).

    Args:
        business_user_id: The signed-in customer.
        at: The moment to price at; defaults to now.

    Returns:
        Product id -> unit price in shekels before VAT. Products without a price for this customer are left out.
    """
    return {product_id: detail.price for product_id, detail in customer_price_details(business_user_id, at).items()}


def ribbon_colors() -> dict[str, str]:
    """The background color of each kind of discount ribbon, as staff set it (setting "discount_ribbon_colors").

    Returns:
        {"general": "#rrggbb", "customer": "#rrggbb"}: the stored color of each kind when it is a valid "#rrggbb",
        else its default (RIBBON_COLOR_DEFAULTS).
    """
    stored = get_setting("discount_ribbon_colors", {})
    stored = stored if isinstance(stored, dict) else {}
    return {
        kind: value if isinstance(value := stored.get(kind), str) and HEX_COLOR.match(value) else default
        for kind, default in RIBBON_COLOR_DEFAULTS.items()
    }
