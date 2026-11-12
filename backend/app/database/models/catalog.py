"""catalog.py — The product catalog: suppliers, brands, categories, products, their images and supplier links.

Staff create, edit and delete all of these in the staff panel; the public site and the B2B portal read them.
Products never carry a customer's price: that is computed by app.pricing from `list_price` and the price rules.
A product's `stock_quantity` is written only by app.inventory, together with a StockMovement (models/inventory.py).
ProductSupplier is the junction table between products and suppliers. Column meanings are documented in
create-tables.sql.
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Double, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Localized, TimestampMixin, db, localized_check, uuid_pk

if TYPE_CHECKING:
    from app.database.models.inventory import StockMovement
    from app.database.models.price_rules import PriceRule

# URL slugs of brands and categories: lowercase words joined by single hyphens.
SLUG_CHECK = "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'"


class Supplier(TimestampMixin, db.Model):
    """A manufacturer or exporter Ultra Pet buys from. Staff only, never shown on the public site."""

    __tablename__ = "suppliers"
    __table_args__ = (
        CheckConstraint("country ~ '^[A-Z]{2}$'", name="country"),
        CheckConstraint("latitude BETWEEN -90 AND 90", name="latitude"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="longitude"),
        CheckConstraint("(latitude IS NULL) = (longitude IS NULL)", name="coordinates"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(unique=True)
    country: Mapped[str | None]
    latitude: Mapped[float | None] = mapped_column(Double)
    longitude: Mapped[float | None] = mapped_column(Double)
    contact_name: Mapped[str | None]
    email: Mapped[str | None]
    phone: Mapped[str | None]
    website: Mapped[str | None]
    notes: Mapped[str | None]
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")

    product_links: Mapped[list[ProductSupplier]] = relationship(
        back_populates="supplier", cascade="all, delete-orphan", passive_deletes=True
    )


class Brand(TimestampMixin, db.Model):
    """A brand Ultra Pet distributes; each has a page on the public site."""

    __tablename__ = "brands"
    __table_args__ = (
        CheckConstraint(SLUG_CHECK, name="slug"),
        CheckConstraint(localized_check("tagline", nullable=True), name="tagline"),
        CheckConstraint(localized_check("description", nullable=True), name="description"),
        CheckConstraint("accent_color ~ '^#[0-9A-Fa-f]{6}$'", name="accent_color"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    slug: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    tagline: Mapped[Localized | None]
    description: Mapped[Localized | None]
    accent_color: Mapped[str | None]
    logo_url: Mapped[str | None]
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")

    # Deleting a brand leaves its products unbranded (ON DELETE SET NULL).
    products: Mapped[list[Product]] = relationship(back_populates="brand", passive_deletes=True)


class Category(TimestampMixin, db.Model):
    """A catalog category (one of the store's 15); a price rule can target all of its products."""

    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint(SLUG_CHECK, name="slug"),
        CheckConstraint(localized_check("name"), name="name"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    slug: Mapped[str] = mapped_column(unique=True)
    name: Mapped[Localized]
    image_url: Mapped[str | None]
    legacy_path: Mapped[str | None]
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")

    # A category with products cannot be deleted (ON DELETE RESTRICT): the ORM leaves the products alone and lets
    # the database refuse.
    products: Mapped[list[Product]] = relationship(back_populates="category", passive_deletes="all")
    price_rules: Mapped[list[PriceRule]] = relationship(
        back_populates="category", cascade="all, delete-orphan", passive_deletes=True
    )


class Product(TimestampMixin, db.Model):
    """An item Ultra Pet sells. Seeded products keep their old WooCommerce id in `woocommerce_id`."""

    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint(localized_check("name"), name="name"),
        CheckConstraint(localized_check("description", nullable=True), name="description"),
        CheckConstraint("list_price >= 0", name="list_price"),
        CheckConstraint("stock_quantity >= 0", name="stock_quantity"),
        CheckConstraint("low_stock_threshold >= 0", name="low_stock_threshold"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    woocommerce_id: Mapped[int | None] = mapped_column(unique=True)
    slug: Mapped[str] = mapped_column(unique=True)
    sku: Mapped[str | None] = mapped_column(unique=True)
    barcode: Mapped[str | None]
    name: Mapped[Localized]
    description: Mapped[Localized | None]
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"), index=True)
    brand_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("brands.id", ondelete="SET NULL"), index=True)
    list_price: Mapped[Decimal | None]
    stock_quantity: Mapped[int | None] = mapped_column(Integer)
    low_stock_threshold: Mapped[int | None] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    legacy_path: Mapped[str | None]

    category: Mapped[Category] = relationship(back_populates="products")
    brand: Mapped[Brand | None] = relationship(back_populates="products")
    images: Mapped[list[ProductImage]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ProductImage.sort_order",
    )
    supplier_links: Mapped[list[ProductSupplier]] = relationship(
        back_populates="product", cascade="all, delete-orphan", passive_deletes=True
    )
    price_rules: Mapped[list[PriceRule]] = relationship(
        back_populates="product", cascade="all, delete-orphan", passive_deletes=True
    )
    stock_movements: Mapped[list[StockMovement]] = relationship(
        back_populates="product", cascade="all, delete-orphan", passive_deletes=True
    )


class ProductImage(TimestampMixin, db.Model):
    """A photo of a product; the lowest sort_order is the main photo."""

    __tablename__ = "product_images"
    __table_args__ = (CheckConstraint(localized_check("alt", nullable=True), name="alt"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    url: Mapped[str]
    thumbnail_url: Mapped[str | None]
    srcset: Mapped[str | None]
    alt: Mapped[Localized | None]
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    product: Mapped[Product] = relationship(back_populates="images")


class ProductSupplier(TimestampMixin, db.Model):
    """Junction of products and suppliers: who a product is bought from, at what code and cost."""

    __tablename__ = "product_suppliers"
    __table_args__ = (
        CheckConstraint("cost_price >= 0", name="cost_price"),
        CheckConstraint("cost_currency ~ '^[A-Z]{3}$'", name="cost_currency"),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("suppliers.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    supplier_sku: Mapped[str | None]
    cost_price: Mapped[Decimal | None]
    cost_currency: Mapped[str] = mapped_column(default="ILS", server_default="ILS")

    product: Mapped[Product] = relationship(back_populates="supplier_links")
    supplier: Mapped[Supplier] = relationship(back_populates="product_links")
