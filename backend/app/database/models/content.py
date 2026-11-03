"""content.py — Content of the public site that staff maintain: the blog articles and the reseller list.

Article is a blog post (table articles); the public site shows it from `published_at` on. Reseller is a pet store
that sells Ultra Pet products (table resellers), listed on the "Where to Buy" page and its map. Staff edit both
through the staff API (app/staff/routes.py); the public API (app/customers/routes.py) reads them. Column meanings
are documented in create-tables.sql.
"""
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ARRAY, CheckConstraint, Double, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.db import Localized, TimestampMixin, db, localized_check, uuid_pk
from app.database.models.catalog import SLUG_CHECK


class Article(TimestampMixin, db.Model):
    """A blog post; `published_at` NULL = a draft."""

    __tablename__ = "articles"
    __table_args__ = (
        CheckConstraint(SLUG_CHECK, name="slug"),
        CheckConstraint("topic IN ('cats', 'dogs')", name="topic"),
        CheckConstraint(localized_check("title"), name="title"),
        CheckConstraint(localized_check("description"), name="description"),
        CheckConstraint(localized_check("image_alt", nullable=True), name="image_alt"),
        CheckConstraint("coalesce(jsonb_typeof(body -> 'he'), '') = 'array'", name="body"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    slug: Mapped[str] = mapped_column(unique=True)
    topic: Mapped[str]
    title: Mapped[Localized]
    description: Mapped[Localized]
    image_alt: Mapped[Localized | None]
    # Per language, a list of blocks: {"type": "p", "text": ...} or {"type": "ol", "items": [...]}.
    body: Mapped[dict[str, Any]] = mapped_column(JSONB)
    related_categories: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list, server_default="{}")
    legacy_path: Mapped[str | None]
    published_at: Mapped[datetime | None]


class Reseller(TimestampMixin, db.Model):
    """A pet store that sells Ultra Pet products, with its map position."""

    __tablename__ = "resellers"
    __table_args__ = (
        CheckConstraint("latitude BETWEEN -90 AND 90", name="latitude"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="longitude"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str]
    address: Mapped[str]
    city: Mapped[str]
    phone: Mapped[str | None]
    website: Mapped[str | None]
    latitude: Mapped[float] = mapped_column(Double)
    longitude: Mapped[float] = mapped_column(Double)
    approximate_location: Mapped[bool] = mapped_column(default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
