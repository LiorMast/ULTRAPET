"""orders.py — Checkout: payment methods, orders and order lines (B2B portal, Phase 4).

An Order copies every amount at submission time (prices, VAT, the payment method's discount) and each OrderItem
copies the product's name, sku and prices, so later changes to products, rules or settings never alter a past order.
Orders are sent to Rivhit (accounting); the rivhit_* columns track that. Column meanings are documented in
create-tables.sql.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Localized, TimestampMixin, db, localized_check, uuid_pk

if TYPE_CHECKING:
    from app.database.models.catalog import Product
    from app.database.models.users import BusinessUser

PERCENT = Numeric(5, 2)
TOTAL = Numeric(12, 2)


class PaymentMethod(TimestampMixin, db.Model):
    """A way to pay at checkout (credit card, Bit, bank transfer), with an optional discount set by staff."""

    __tablename__ = "payment_methods"
    __table_args__ = (
        CheckConstraint("code ~ '^[a-z0-9_]+$'", name="code"),
        CheckConstraint(localized_check("name"), name="name"),
        CheckConstraint("discount_percent >= 0 AND discount_percent <= 100", name="discount_percent"),
    )

    code: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[Localized]
    discount_percent: Mapped[Decimal] = mapped_column(PERCENT, default=Decimal(0), server_default="0")
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class Order(TimestampMixin, db.Model):
    """A submitted order of a business customer: total = subtotal - payment_discount_amount + vat_amount."""

    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('submitted', 'confirmed', 'shipped', 'delivered', 'cancelled')", name="status"
        ),
        CheckConstraint("payment_status IN ('pending', 'paid', 'failed', 'refunded')", name="payment_status"),
        CheckConstraint("subtotal >= 0", name="subtotal"),
        CheckConstraint(
            "payment_discount_percent >= 0 AND payment_discount_percent <= 100", name="payment_discount_percent"
        ),
        CheckConstraint("payment_discount_amount >= 0", name="payment_discount_amount"),
        CheckConstraint("vat_percent >= 0", name="vat_percent"),
        CheckConstraint("vat_amount >= 0", name="vat_amount"),
        CheckConstraint("total >= 0", name="total"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    business_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("business_users.id", ondelete="RESTRICT"), index=True)
    status: Mapped[str] = mapped_column(default="submitted", server_default="submitted")
    payment_method_code: Mapped[str] = mapped_column(
        ForeignKey("payment_methods.code", ondelete="RESTRICT"), index=True
    )
    payment_status: Mapped[str] = mapped_column(default="pending", server_default="pending")
    subtotal: Mapped[Decimal] = mapped_column(TOTAL)
    payment_discount_percent: Mapped[Decimal] = mapped_column(PERCENT, default=Decimal(0), server_default="0")
    payment_discount_amount: Mapped[Decimal] = mapped_column(TOTAL, default=Decimal(0), server_default="0")
    vat_percent: Mapped[Decimal] = mapped_column(PERCENT)
    vat_amount: Mapped[Decimal] = mapped_column(TOTAL)
    total: Mapped[Decimal] = mapped_column(TOTAL)
    delivery_city: Mapped[str | None]
    delivery_address: Mapped[str | None]
    customer_notes: Mapped[str | None]
    staff_notes: Mapped[str | None]
    rivhit_document_id: Mapped[str | None] = mapped_column(unique=True)
    rivhit_synced_at: Mapped[datetime | None]
    rivhit_sync_error: Mapped[str | None]

    business_user: Mapped[BusinessUser] = relationship(back_populates="orders")
    payment_method: Mapped[PaymentMethod] = relationship()
    items: Mapped[list[OrderItem]] = relationship(
        back_populates="order", cascade="all, delete-orphan", passive_deletes=True
    )


class OrderItem(TimestampMixin, db.Model):
    """One line of an order, with the product's details copied at ordering time."""

    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint(localized_check("product_name"), name="product_name"),
        CheckConstraint("quantity > 0", name="quantity"),
        CheckConstraint("list_price >= 0", name="list_price"),
        CheckConstraint("unit_price >= 0", name="unit_price"),
        CheckConstraint("line_total >= 0", name="line_total"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"), index=True)
    sku: Mapped[str | None]
    product_name: Mapped[Localized]
    quantity: Mapped[int] = mapped_column(Integer)
    list_price: Mapped[Decimal | None]
    unit_price: Mapped[Decimal]
    line_total: Mapped[Decimal] = mapped_column(TOTAL)

    order: Mapped[Order] = relationship(back_populates="items")
    product: Mapped[Product | None] = relationship()
