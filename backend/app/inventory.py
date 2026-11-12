"""inventory.py — Product stock: the stock ledger (table stock_movements) and the stock status customers see.

A product's units on hand live in `products.stock_quantity` (NULL = stock not tracked: the product is always
orderable and shows no status). Every change is one StockMovement (app/database/models/inventory.py), written here
together with the product's new quantity, so the product always holds the last movement's `quantity_after`:

- `received` (goods in from a supplier) and `returned` (a customer return back on the shelf) add units;
- `removed` (damaged, expired or lost) takes units out, never more than are on hand;
- `count` (a stock count) sets the units on hand. An untracked product starts with a count, which starts tracking it.

Rows are never edited or deleted: staff fix a mistake with a new count. Later kinds: `order` (checkout, Phase 4) and
`sync` (Rivhit), added to the kind CHECK in create-tables.sql.

The status a signed-in business customer sees is `in`, `low` (0 < units <= the product's `low_stock_threshold`) or
`out` (0 units); never the count itself. Used by the staff routes (the Stock dialog of the staff panel) and by the
customers' /api/prices (customer_stock).
"""
from __future__ import annotations

import uuid
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.database.db import db
from app.database.models.catalog import Product
from app.database.models.inventory import StockMovement

# The movement kinds staff record (the kind CHECK of stock_movements).
MOVEMENT_KINDS = ("received", "returned", "removed", "count")

# How many of a product's latest movements the Stock dialog shows.
HISTORY_LIMIT = 50

StockStatus = Literal["in", "low", "out"]


class StockError(ValueError):
    """A movement the product's stock cannot take.

    `code` is "invalid_quantity" (below the kind's minimum: 0 for a count, else 1), "untracked" (only a count can
    start tracking a product) or "insufficient_stock" (removing more units than are on hand).
    """

    def __init__(self, code: str) -> None:
        """Keeps the error's code.

        Args:
            code: "invalid_quantity", "untracked" or "insufficient_stock".
        """
        super().__init__(code)
        self.code = code


def stock_status(quantity: int | None, threshold: int | None) -> StockStatus | None:
    """The stock status of a product.

    Args:
        quantity: Its units on hand; None = not tracked.
        threshold: Its low-stock threshold; None = no low-stock warning.

    Returns:
        None when not tracked, "out" at 0 units, "low" while units <= the threshold, else "in".
    """
    if quantity is None:
        return None
    if quantity <= 0:
        return "out"
    if threshold is not None and quantity <= threshold:
        return "low"
    return "in"


def apply_movement(current: int | None, kind: str, quantity: int) -> tuple[int, int]:
    """Computes what a movement does to a product's stock (pure: no database).

    Args:
        current: The units on hand now; None = not tracked.
        kind: One of MOVEMENT_KINDS.
        quantity: The units the staff member entered: the units in or out, or the counted units for a count.

    Returns:
        (quantity_change, quantity_after): the signed change and the units on hand afterwards.

    Raises:
        StockError: "invalid_quantity", "untracked" or "insufficient_stock" (see StockError).
    """
    if quantity < (0 if kind == "count" else 1):
        raise StockError("invalid_quantity")
    if kind == "count":
        return quantity - (current or 0), quantity
    if current is None:
        raise StockError("untracked")
    change = -quantity if kind == "removed" else quantity
    if current + change < 0:
        raise StockError("insufficient_stock")
    return change, current + change


def record_movement(
    product_id: uuid.UUID, kind: str, quantity: int, note: str | None, staff_id: uuid.UUID | None
) -> Product | None:
    """Records one movement and the product's new units on hand, in the current transaction (the caller commits).

    The product row is locked (SELECT ... FOR UPDATE) first, so two staff members recording at once never lose a change.

    Args:
        product_id: The product.
        kind: One of MOVEMENT_KINDS.
        quantity: The units entered (see apply_movement).
        note: Why, e.g. the supplier's invoice number; None = none.
        staff_id: The staff member recording it.

    Returns:
        The updated product, or None when it does not exist.

    Raises:
        StockError: The stock cannot take the movement (see apply_movement); nothing is changed.
    """
    product = db.session.get(Product, product_id, with_for_update=True, populate_existing=True)
    if product is None:
        return None
    change, after = apply_movement(product.stock_quantity, kind, quantity)
    product.stock_quantity = after
    db.session.add(
        StockMovement(
            product_id=product.id,
            kind=kind,
            quantity_change=change,
            quantity_after=after,
            note=note,
            created_by_id=staff_id,
        )
    )
    return product


def product_stock_json(product: Product) -> dict[str, Any]:
    """Shapes a product's stock for the staff panel's Stock dialog.

    Args:
        product: The product.

    Returns:
        {stockQuantity, lowStockThreshold, status, movementCount, movements}: `movements` are the latest
        HISTORY_LIMIT, newest first, each {id, kind, quantityChange, quantityAfter, note, createdBy (the staff
        member's name, or None), createdAt}; `movementCount` counts them all.
    """
    db.session.flush()
    movements = db.session.scalars(
        select(StockMovement)
        .where(StockMovement.product_id == product.id)
        .options(selectinload(StockMovement.created_by))
        .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
        .limit(HISTORY_LIMIT)
    ).all()
    count = db.session.scalar(
        select(func.count()).select_from(StockMovement).where(StockMovement.product_id == product.id)
    )
    return {
        "stockQuantity": product.stock_quantity,
        "lowStockThreshold": product.low_stock_threshold,
        "status": stock_status(product.stock_quantity, product.low_stock_threshold),
        "movementCount": count,
        "movements": [
            {
                "id": movement.id,
                "kind": movement.kind,
                "quantityChange": movement.quantity_change,
                "quantityAfter": movement.quantity_after,
                "note": movement.note,
                "createdBy": movement.created_by.full_name if movement.created_by else None,
                "createdAt": movement.created_at,
            }
            for movement in movements
        ],
    }


def customer_stock() -> dict[uuid.UUID, StockStatus]:
    """The stock status of every active product whose stock is tracked (the B2B catalog; untracked ones are left out).

    Returns:
        Product id -> "in", "low" or "out".
    """
    rows = db.session.execute(
        select(Product.id, Product.stock_quantity, Product.low_stock_threshold).where(
            Product.is_active, Product.stock_quantity.is_not(None)
        )
    ).all()
    return {product_id: stock_status(quantity, threshold) for product_id, quantity, threshold in rows}
