"""users.py — The people of the system: staff users, business users (customers) and business leads.

AppUser is the shared sign-in record (table app_users). StaffUser and BusinessUser inherit from it with joined-table
inheritance: each subtype has its own table whose primary key is also a foreign key to app_users, and
`app_users.user_type` says which one a row belongs to. Querying AppUser therefore returns StaffUser and BusinessUser
objects. BusinessLead is a "become a customer" form submission that staff may convert into a BusinessUser.
Column meanings are documented in create-tables.sql.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from werkzeug.security import check_password_hash, generate_password_hash

from app.db import TimestampMixin, db

if TYPE_CHECKING:
    from app.models.orders import Order
    from app.models.price_rules import PriceRule


class AppUser(TimestampMixin, db.Model):
    """Anyone who can sign in. Never created directly: create a StaffUser or a BusinessUser."""

    __tablename__ = "app_users"
    __table_args__ = (
        CheckConstraint("user_type IN ('staff', 'business')", name="user_type"),
        CheckConstraint("email = lower(email)", name="email"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_type: Mapped[str]
    email: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]
    full_name: Mapped[str]
    phone: Mapped[str | None]
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    last_login_at: Mapped[datetime | None]

    __mapper_args__ = {"polymorphic_on": "user_type"}

    def set_password(self, password: str) -> None:
        """Stores a hash of the password (werkzeug's default, scrypt); the password itself is never kept.

        Args:
            password: The new plain-text password.
        """
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        """Checks a sign-in attempt against the stored hash.

        Args:
            password: The plain-text password that was typed.

        Returns:
            True when it matches.
        """
        return check_password_hash(self.password_hash, password)


class StaffUser(AppUser):
    """An Ultra Pet employee who uses the staff panel. Every staff user is an admin for now."""

    __tablename__ = "staff_users"
    __table_args__ = (CheckConstraint("role IN ('admin')", name="role"),)

    id: Mapped[int] = mapped_column(ForeignKey("app_users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(default="admin", server_default="admin")

    __mapper_args__ = {"polymorphic_identity": "staff"}


class BusinessUser(AppUser):
    """A wholesale customer (pet store, chain, distributor, wholesaler) with access to the B2B portal."""

    __tablename__ = "business_users"
    __table_args__ = (CheckConstraint("business_number ~ '^[0-9]{9}$'", name="business_number"),)

    id: Mapped[int] = mapped_column(ForeignKey("app_users.id", ondelete="CASCADE"), primary_key=True)
    company_name: Mapped[str]
    business_number: Mapped[str | None] = mapped_column(unique=True)
    city: Mapped[str | None]
    address: Mapped[str | None]
    rivhit_customer_id: Mapped[str | None] = mapped_column(unique=True)
    notes: Mapped[str | None]

    # The customer's own price rules, deleted with the customer. Never detached: a rule whose business_user_id
    # became NULL would turn into a general rule for every customer.
    price_rules: Mapped[list[PriceRule]] = relationship(
        back_populates="business_user", cascade="all, delete-orphan", passive_deletes=True
    )
    # Orders block deleting the customer (ON DELETE RESTRICT), so the ORM must not try to detach them.
    orders: Mapped[list[Order]] = relationship(back_populates="business_user", passive_deletes="all")

    __mapper_args__ = {"polymorphic_identity": "business"}


class BusinessLead(TimestampMixin, db.Model):
    """A submission of the public "become a business customer" form, followed up by staff."""

    __tablename__ = "business_leads"
    __table_args__ = (
        CheckConstraint("locale IN ('he', 'en', 'ru', 'ar')", name="locale"),
        CheckConstraint("status IN ('new', 'contacted', 'converted', 'rejected')", name="status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_name: Mapped[str]
    contact_person: Mapped[str]
    phone: Mapped[str]
    email: Mapped[str]
    city: Mapped[str]
    message: Mapped[str | None]
    locale: Mapped[str] = mapped_column(default="he", server_default="he")
    status: Mapped[str] = mapped_column(default="new", server_default="new")
    business_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("business_users.id", ondelete="SET NULL"), index=True
    )

    business_user: Mapped[BusinessUser | None] = relationship()
