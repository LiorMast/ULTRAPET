"""inventory.py — The StockMovement model: the stock ledger, one row per change of a product's units on hand.

Staff record movements in the staff panel's Stock dialog; app/inventory.py writes each one together with the
product's new `stock_quantity`, so the product always holds the last movement's `quantity_after`. Movements are never
edited or deleted. Column meanings are documented in create-tables.sql.
"""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import TimestampMixin, db, uuid_pk

if TYPE_CHECKING:
    from app.database.models.catalog import Product
    from app.database.models.users import StaffUser


class StockMovement(TimestampMixin, db.Model):
    """One change of a product's stock: received, returned, removed, or a stock count."""

    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint("kind IN ('received', 'returned', 'removed', 'count')", name="kind"),
        CheckConstraint("quantity_after >= 0", name="quantity_after"),
        CheckConstraint(
            "kind = 'count' OR (kind = 'removed' AND quantity_change < 0)"
            " OR (kind IN ('received', 'returned') AND quantity_change > 0)",
            name="direction",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str]
    quantity_change: Mapped[int] = mapped_column(Integer)
    quantity_after: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None]
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id", ondelete="SET NULL"), index=True)

    product: Mapped[Product] = relationship(back_populates="stock_movements")
    created_by: Mapped[StaffUser | None] = relationship()
