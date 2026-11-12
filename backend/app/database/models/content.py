"""content.py — Content of the public site that staff maintain: the blog articles, the reseller list and the
editable home page sections.

Article is a blog post (table articles); the public site shows it from `published_at` on. Reseller is a pet store
that sells Ultra Pet products (table resellers), listed on the "Where to Buy" page and its map. Staff edit both
through the staff API (app/staff/routes.py); the public API (app/customers/routes.py) reads them. PageSection is the
JSON content of one home page section (table page_sections). FaqItem is one question of the home page FAQ section
(table faq_items), as many as staff add. Column meanings are documented in create-tables.sql.
"""
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ARRAY, CheckConstraint, Double, ForeignKey, Integer, Text
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


class PageSection(TimestampMixin, db.Model):
    """The editable content of one home page section, plus who made the last change (`updated_at` says when)."""

    __tablename__ = "page_sections"
    __table_args__ = (
        CheckConstraint("key ~ '^[a-z0-9_]+$'", name="key"),
        CheckConstraint("jsonb_typeof(content) = 'object'", name="content"),
    )

    key: Mapped[str] = mapped_column(primary_key=True)
    # An object whose shape depends on the section; translated texts are {"he": ..., "en": ...}.
    content: Mapped[dict[str, Any]] = mapped_column(JSONB)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id", ondelete="SET NULL"), index=True)


class FaqItem(TimestampMixin, db.Model):
    """One question of the home page FAQ section and its answer, per language (a language may be missing: the site
    then leaves the question out of that language), plus who made the last change."""

    __tablename__ = "faq_items"
    __table_args__ = (
        CheckConstraint("jsonb_typeof(question) = 'object'", name="question"),
        CheckConstraint("jsonb_typeof(answer) = 'object'", name="answer"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    question: Mapped[Localized]
    answer: Mapped[Localized]
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id", ondelete="SET NULL"), index=True)
