"""settings.py — Site settings staff can change without a code release (VAT, minimum order, home page stats, ...).

One row per setting in the `settings` table, its value stored as JSON. Read a value with get_setting().
Column meanings are documented in create-tables.sql.
"""
from typing import Any

from sqlalchemy import CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.db import TimestampMixin, db


class Setting(TimestampMixin, db.Model):
    """One named setting and its JSON value."""

    __tablename__ = "settings"
    __table_args__ = (CheckConstraint("key ~ '^[a-z0-9_]+$'", name="key"),)

    key: Mapped[str] = mapped_column(primary_key=True)
    value: Mapped[Any] = mapped_column(JSONB(none_as_null=True))
    description: Mapped[str | None]


def get_setting(key: str, default: Any = None) -> Any:
    """Reads one setting.

    Args:
        key: The setting name, e.g. "min_order_amount".
        default: What to return when the setting does not exist.

    Returns:
        The stored value (a number, string, list or dict), or `default`.
    """
    setting = db.session.get(Setting, key)
    return default if setting is None else setting.value
