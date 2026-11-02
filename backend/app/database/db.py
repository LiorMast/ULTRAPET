"""db.py — The Flask-SQLAlchemy `db` object and the declarative base every model inherits.

Shared by all model modules (users, catalog, pricing, orders, settings). It fixes three things for the whole schema:
- the constraint naming convention, which yields Postgres' own default names, so the models and
  create-tables.sql (the source of truth) agree on every constraint and index name;
- the column types behind Python annotations (UUID -> UUID, int -> BIGINT, str -> TEXT, Localized -> JSONB, ...);
- uuid_pk(), the primary key column of every table with a generated id;
- TimestampMixin, the created_at / updated_at pair most tables carry.
"""
import uuid
from datetime import datetime
from decimal import Decimal

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import BigInteger, DateTime, MetaData, Numeric, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, registry

# Text per language, e.g. {"he": "מזון יבש", "en": "Dry food"}; Hebrew is always present (a CHECK in the schema).
Localized = dict[str, str]

# Postgres' default names: <table>_pkey, <table>_<columns>_fkey / _key / _idx, and <table>_<name>_check for the
# checks the models name (column checks use the column name, multi-column checks a short descriptive name).
NAMING_CONVENTION = {
    "pk": "%(table_name)s_pkey",
    "fk": "%(table_name)s_%(column_0_N_name)s_fkey",
    "uq": "%(table_name)s_%(column_0_N_name)s_key",
    "ix": "%(table_name)s_%(column_0_N_name)s_idx",
    "ck": "%(table_name)s_%(constraint_name)s_check",
}


class Base(DeclarativeBase):
    """Declarative base of every model: the naming convention plus the default column type per annotation.

    `uuid.UUID` maps to UUID (all ids and foreign keys) and `int` to BIGINT; counters that are plain INTEGER say so
    explicitly. Money columns
    default to NUMERIC(10,2); totals and percentages give their own precision. Both live on the registry, because
    Flask-SQLAlchemy subclasses this base (SQLAlchemy 2.1 rejects a per-class type_annotation_map there).
    """

    registry = registry(
        metadata=MetaData(naming_convention=NAMING_CONVENTION),
        type_annotation_map={
            uuid.UUID: UUID(as_uuid=True),
            int: BigInteger,
            str: Text,
            Decimal: Numeric(10, 2),
            datetime: DateTime(timezone=True),
            # None is stored as SQL NULL (not the JSON value null), so `IS NULL` and the CHECKs see it.
            Localized: JSONB(none_as_null=True),
        },
    )


db = SQLAlchemy(model_class=Base)


class TimestampMixin:
    """Adds created_at (set by the database on insert) and updated_at (refreshed by SQLAlchemy on every update)."""

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


def localized_check(column: str, *, nullable: bool = False) -> str:
    """Builds the CHECK expression that requires a Hebrew value in a JSONB translation column.

    Args:
        column: The column name, e.g. "name".
        nullable: True when the whole column may be NULL (the check then only applies to a value).

    Returns:
        The SQL expression, identical to the one in create-tables.sql.
    """
    check = f"coalesce({column} ->> 'he', '') <> ''"
    return f"{column} IS NULL OR {check}" if nullable else check


def uuid_pk() -> Mapped[uuid.UUID]:
    """Builds the primary key column of a table with a generated id.

    The database fills it with gen_random_uuid() on insert (the same default as create-tables.sql), and SQLAlchemy
    reads the new id back, so `product.id` is available after the first flush.

    Returns:
        A mapped_column for `id: Mapped[uuid.UUID]`.
    """
    return mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
