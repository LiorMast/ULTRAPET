"""price_rules.py — The PriceRule model: every discount, price increase and fixed price staff set.

One row of `price_rules` is a rule for all customers or one customer, on a category or a product, for a set period
or open-ended. The logic that turns rules into a customer's price lives in app/pricing.py. Column meanings are
documented in create-tables.sql.
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import TimestampMixin, db, uuid_pk

if TYPE_CHECKING:
    from app.database.models.catalog import Category, Product
    from app.database.models.users import BusinessUser, StaffUser


class PriceRule(TimestampMixin, db.Model):
    """A discount, price increase or fixed price, for everyone or for one customer, on a category or a product."""

    __tablename__ = "price_rules"
    __table_args__ = (
        CheckConstraint("kind IN ('discount', 'increase', 'fixed_price')", name="kind"),
        CheckConstraint("value > 0", name="value"),
        CheckConstraint("num_nonnulls(category_id, product_id) = 1", name="one_target"),
        CheckConstraint("kind <> 'discount' OR value <= 100", name="discount_max"),
        CheckConstraint(
            "kind <> 'fixed_price' OR (product_id IS NOT NULL AND business_user_id IS NOT NULL)",
            name="fixed_price_target",
        ),
        CheckConstraint("business_user_id IS NOT NULL OR kind = 'discount'", name="general_discount_only"),
        CheckConstraint("starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on", name="dates"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    business_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("business_users.id", ondelete="CASCADE"), index=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str]
    value: Mapped[Decimal]
    starts_on: Mapped[date | None]
    ends_on: Mapped[date | None]
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    note: Mapped[str | None]
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id", ondelete="SET NULL"), index=True)

    business_user: Mapped[BusinessUser | None] = relationship(back_populates="price_rules")
    category: Mapped[Category | None] = relationship(back_populates="price_rules")
    product: Mapped[Product | None] = relationship(back_populates="price_rules")
    created_by: Mapped[StaffUser | None] = relationship()

    def applies_on(self, day: date) -> bool:
        """Tells whether the rule is in effect on a day.

        Args:
            day: The (Israel) date to check.

        Returns:
            True when the rule is active and the day is inside its period (both ends inclusive).
        """
        return (
            self.is_active
            and (self.starts_on is None or self.starts_on <= day)
            and (self.ends_on is None or day <= self.ends_on)
        )
