"""price_rules.py — The PriceRule model: every discount and fixed price staff set.

One row of `price_rules` is a rule for all customers or one customer, on a category or a product (or, for one
customer, on every product), for a set period or open-ended; a rule with `min_quantity` is a bulk discount (it applies from that many units on one order line). The logic that turns rules into a customer's price lives in app/pricing.py. Column meanings are
documented in create-tables.sql.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import TimestampMixin, db, uuid_pk

if TYPE_CHECKING:
    from app.database.models.catalog import Category, Product
    from app.database.models.users import BusinessUser, StaffUser


class PriceRule(TimestampMixin, db.Model):
    """A discount (percent or amount, regular or bulk), or a customer's fixed price, on a category or a product (a
    customer's discount may also cover every product)."""

    __tablename__ = "price_rules"
    __table_args__ = (
        CheckConstraint("kind IN ('percent', 'amount', 'fixed_price')", name="kind"),
        CheckConstraint("value > 0", name="value"),
        CheckConstraint(
            "num_nonnulls(category_id, product_id) = 1"
            " OR (num_nonnulls(category_id, product_id) = 0 AND business_user_id IS NOT NULL)",
            name="target",
        ),
        CheckConstraint("kind <> 'percent' OR value <= 100", name="percent_max"),
        CheckConstraint(
            "kind <> 'fixed_price' OR (product_id IS NOT NULL AND business_user_id IS NOT NULL)",
            name="fixed_price_target",
        ),
        CheckConstraint("starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at", name="dates"),
        CheckConstraint("min_quantity IS NULL OR min_quantity >= 2", name="min_quantity"),
        CheckConstraint("kind <> 'fixed_price' OR min_quantity IS NULL", name="fixed_price_bulk"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    business_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("business_users.id", ondelete="CASCADE"), index=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str]
    value: Mapped[Decimal]
    starts_at: Mapped[datetime | None]
    ends_at: Mapped[datetime | None]
    min_quantity: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    note: Mapped[str | None]
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id", ondelete="SET NULL"), index=True)

    business_user: Mapped[BusinessUser | None] = relationship(back_populates="price_rules")
    category: Mapped[Category | None] = relationship(back_populates="price_rules")
    product: Mapped[Product | None] = relationship(back_populates="price_rules")
    created_by: Mapped[StaffUser | None] = relationship()

    def applies_at(self, moment: datetime) -> bool:
        """Tells whether the rule is in effect at a moment.

        Args:
            moment: The (timezone-aware) time to check.

        Returns:
            True when the rule is active and the moment is inside its period (start inclusive, end exclusive).
        """
        return (
            self.is_active
            and (self.starts_at is None or self.starts_at <= moment)
            and (self.ends_at is None or moment < self.ends_at)
        )
