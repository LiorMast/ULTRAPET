"""seed.py — Database commands for development: `flask reset-db --yes` and `flask seed`.

reset-db rebuilds the schema by running drop-tables.sql and then create-tables.sql. seed fills an empty database
from the data the frontend uses today:
- categories, products (with their WooCommerce ids in woocommerce_id, and images), placeholder prices and brands from
  frontend/src/stubs/;
- the home page stats from legacy/supabase-export/cms_settings.json, plus VAT, the minimum order and the currency;
- the three payment methods;
- a staff admin, when SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are set.
Paths are relative to the repository root; compose mounts the same folders at the same relative places, so the
commands work both locally and in the backend container. Also used by the tests (run_sql_file, seed_database).
"""
import json
import os
from decimal import Decimal
from pathlib import Path
from typing import Any

import click
import psycopg
from sqlalchemy import func, select

from app.database.models.catalog import Brand, Category, Product, ProductImage
from app.database.db import db
from app.database.models.orders import PaymentMethod
from app.database.models.settings import Setting
from app.database.models.users import StaffUser

DATABASE_DIR = Path(__file__).resolve().parent
REPO_DIR = DATABASE_DIR.parents[2]
CREATE_TABLES_SQL = DATABASE_DIR / "create-tables.sql"
DROP_TABLES_SQL = DATABASE_DIR / "drop-tables.sql"
STUBS_DIR = REPO_DIR / "frontend" / "src" / "stubs"
LEGACY_EXPORT_DIR = REPO_DIR / "legacy" / "supabase-export"

# Settings that are not in the legacy export: (key, value, description).
BASE_SETTINGS = [
    ("vat_percent", 18, "VAT rate in percent, added to prices at checkout"),
    ("min_order_amount", 2000, "Minimum order subtotal in shekels before VAT"),
    ("currency", "ILS", "Currency of all prices (ISO 4217)"),
]

# Payment methods offered at checkout: (code, Hebrew name, English name).
PAYMENT_METHODS = [
    ("credit_card", "כרטיס אשראי", "Credit card"),
    ("bit", "ביט", "Bit"),
    ("bank_transfer", "העברה בנקאית", "Bank transfer"),
]


def run_sql_file(path: Path) -> None:
    """Runs a whole SQL script (several statements, its own BEGIN/COMMIT) against the app's database.

    Uses a separate psycopg connection in autocommit mode, so the script controls its own transaction.

    Args:
        path: The .sql file, e.g. CREATE_TABLES_SQL.
    """
    url = db.engine.url.set(drivername="postgresql").render_as_string(hide_password=False)
    with psycopg.connect(url, autocommit=True) as connection:
        connection.execute(path.read_text(encoding="utf-8"))


def read_json(path: Path) -> Any:
    """Reads a JSON file.

    Args:
        path: The file.

    Returns:
        The parsed JSON.
    """
    return json.loads(path.read_text(encoding="utf-8"))


def seed_database() -> dict[str, int]:
    """Fills an empty database with the stub catalog, settings, payment methods and (optionally) a staff admin.

    Returns:
        How many rows were added per kind, e.g. {"products": 400, ...}.

    Raises:
        click.ClickException: The database already has categories or products.
    """
    if db.session.scalar(select(func.count()).select_from(Category)) or db.session.scalar(
        select(func.count()).select_from(Product)
    ):
        raise click.ClickException("The database is not empty; run `flask reset-db --yes` first.")

    categories = {}
    for order, item in enumerate(read_json(STUBS_DIR / "product-categories.json")):
        categories[item["slug"]] = Category(
            slug=item["slug"], name=item["name"], legacy_path=item.get("legacyPath"), sort_order=order
        )
    db.session.add_all(categories.values())

    brands = read_json(STUBS_DIR / "brands.json")
    for order, item in enumerate(brands):
        db.session.add(
            Brand(
                slug=item["slug"],
                name=item["name"],
                tagline=item.get("tagline"),
                accent_color=item.get("accent"),
                sort_order=order,
            )
        )

    prices = read_json(STUBS_DIR / "prices.json")["prices"]
    products = read_json(STUBS_DIR / "products.json")
    for item in products:
        image = item.get("image")
        db.session.add(
            Product(
                woocommerce_id=int(item["id"]),
                slug=item["slug"],
                name=item["name"],
                description=item["description"] if item["description"].get("he") else None,
                category=categories[item["category"]],
                list_price=Decimal(str(prices[item["id"]])) if item["id"] in prices else None,
                legacy_path=item.get("legacyPath"),
                images=[
                    ProductImage(url=image["src"], thumbnail_url=image.get("thumbnail"), srcset=image.get("srcSet") or None)
                ]
                if image
                else [],
            )
        )

    legacy_settings = read_json(LEGACY_EXPORT_DIR / "cms_settings.json")
    for item in legacy_settings:
        value = item["value"]
        db.session.add(
            Setting(
                key=item["key"],
                value=int(value) if value.isdigit() else value,
                description="Home page stats figure (from the legacy CMS)",
            )
        )
    for key, value, description in BASE_SETTINGS:
        db.session.add(Setting(key=key, value=value, description=description))

    for order, (code, name_he, name_en) in enumerate(PAYMENT_METHODS):
        db.session.add(PaymentMethod(code=code, name={"he": name_he, "en": name_en}, sort_order=order))

    staff = 0
    email, password = os.environ.get("SEED_ADMIN_EMAIL"), os.environ.get("SEED_ADMIN_PASSWORD")
    if email and password:
        admin = StaffUser(email=email.strip().lower(), full_name="Administrator")
        admin.set_password(password)
        db.session.add(admin)
        staff = 1

    db.session.flush()
    db.session.commit()
    return {
        "categories": len(categories),
        "brands": len(brands),
        "products": len(products),
        "settings": len(legacy_settings) + len(BASE_SETTINGS),
        "payment_methods": len(PAYMENT_METHODS),
        "staff_users": staff,
    }


@click.command("reset-db")
@click.confirmation_option("--yes", prompt="Drop every table and recreate the schema (all data is lost)?")
def reset_db_command() -> None:
    """Drops every table and recreates the schema from drop-tables.sql and create-tables.sql (dev only)."""
    run_sql_file(DROP_TABLES_SQL)
    run_sql_file(CREATE_TABLES_SQL)
    click.echo("Schema recreated from create-tables.sql.")


@click.command("seed")
def seed_command() -> None:
    """Fills an empty database with the stub catalog, settings and payment methods (see seed_database)."""
    counts = seed_database()
    click.echo("Seeded: " + ", ".join(f"{count} {name}" for name, count in counts.items()))
