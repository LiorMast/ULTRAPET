"""seed.py — Database commands for development: `flask reset-db --yes` and `flask seed`.

reset-db rebuilds the schema by running drop-tables.sql and then create-tables.sql. seed fills an empty database
from the stub files in frontend/src/stubs/ (the data the frontend showed before the API existed; its unit tests
still use them as fixtures):
- categories, brands (those found only in product names are inactive) and products (in stub order, with their
  WooCommerce ids in woocommerce_id, their brand, item code (sku) and barcode, the sanitized HTML description and every
  photo of the gallery in order: object keys in the file storage, see app/storage.py), plus placeholder prices; the
  product stubs come from the old site (`flask export-wordpress`, app/database/wordpress.py);
- the articles (with their WordPress dates) and the resellers of the Where to Buy page;
- the questions of the home page FAQ section (stubs/faq.json, in file order);
- the home page stats from legacy/supabase-export/cms_settings.json, plus VAT, the minimum order, the currency and the
  PDF catalog's object key;
- the contact details of the Contact section and the WhatsApp button, and the opening hours (stubs/contact.json:
  settings contact_<field>);
- the three payment methods;
- a staff admin, when SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are set, and a demo business customer (to see
  prices in the catalog), when SEED_CUSTOMER_EMAIL and SEED_CUSTOMER_PASSWORD are set.
Paths are relative to the repository root; compose mounts the same folders at the same relative places, so the
commands work both locally and in the backend container. The seed writes only rows: the files they name (product
photos, the PDF catalog) are copied into the file storage once by `flask import-media` (app/database/legacy_media.py). Also used by the tests (run_sql_file, seed_database).
"""
import json
import os
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import click
import psycopg
from sqlalchemy import func, select

from app.database.models.catalog import Brand, Category, Product, ProductImage
from app.database.models.content import Article, FaqItem, Reseller
from app.database.db import db
from app.database.models.orders import PaymentMethod
from app.database.models.settings import Setting
from app.database.models.users import BusinessUser, StaffUser

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
    ("catalog_pdf", "catalog/ultrapetcatalog.pdf", "Object key of the downloadable PDF catalog (no prices) in the file storage; /api/catalog.pdf redirects to it"),
]

# What each contact setting (contact_<field>, from stubs/contact.json) holds.
CONTACT_DESCRIPTIONS = {
    "phone": "Customer-service phone number, as shown (the tel: link uses its digits)",
    "whatsapp": "Customer-service WhatsApp number, as shown, international (the wa.me link uses its digits)",
    "email": "Customer-service email address (the Contact form sends to it)",
    "hours": "Customer-service opening hours, {he, en} (from the old site's footer)",
}

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
    """Fills an empty database with the stub catalog and content (articles, resellers, FAQ), settings, payment methods
    and (optionally) a staff admin and a demo customer.

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
    brand_rows = {}
    for order, item in enumerate(brands):
        brand_rows[item["slug"]] = Brand(
            slug=item["slug"],
            name=item["name"],
            tagline=item.get("tagline"),
            accent_color=item.get("accent"),
            sort_order=order,
            is_active=item.get("active", True),
        )
    db.session.add_all(brand_rows.values())

    prices = read_json(STUBS_DIR / "prices.json")["prices"]
    products = read_json(STUBS_DIR / "products.json")
    for order, item in enumerate(products):
        db.session.add(
            Product(
                woocommerce_id=int(item["id"]),
                slug=item["slug"],
                sku=item.get("sku"),
                barcode=item.get("barcode"),
                name=item["name"],
                description=item["description"] if item["description"].get("he") else None,
                category=categories[item["category"]],
                brand=brand_rows[item["brand"]] if item.get("brand") else None,
                list_price=Decimal(str(prices[item["id"]])) if item["id"] in prices else None,
                sort_order=order,
                legacy_path=item.get("legacyPath"),
                images=[
                    ProductImage(
                        url=image["src"],
                        thumbnail_url=image.get("thumbnail"),
                        srcset=image.get("srcSet") or None,
                        alt=image.get("alt") or None,
                        sort_order=index,
                    )
                    for index, image in enumerate(item.get("images", []))
                ],
            )
        )

    articles = read_json(STUBS_DIR / "articles.json")
    for item in articles:
        db.session.add(
            Article(
                slug=item["slug"],
                topic=item["topic"],
                title=item["title"],
                description=item["description"],
                image_alt=item.get("imageAlt"),
                body=item["body"],
                related_categories=item.get("relatedCategories", []),
                legacy_path=item.get("legacyPath"),
                published_at=datetime.fromisoformat(item["publishedAt"]),
                updated_at=datetime.fromisoformat(item["updatedAt"]),
            )
        )

    resellers = read_json(STUBS_DIR / "branches.json")
    for item in resellers:
        db.session.add(
            Reseller(
                name=item["name"],
                address=item["address"],
                city=item["city"],
                phone=item.get("phone"),
                website=item.get("website"),
                latitude=item["lat"],
                longitude=item["lng"],
                approximate_location=item.get("approximate", False),
            )
        )

    faq = read_json(STUBS_DIR / "faq.json")
    for order, item in enumerate(faq):
        db.session.add(FaqItem(question=item["question"], answer=item["answer"], sort_order=order))

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
    contact = read_json(STUBS_DIR / "contact.json")
    for field, value in contact.items():
        db.session.add(Setting(key=f"contact_{field}", value=value, description=CONTACT_DESCRIPTIONS[field]))

    for order, (code, name_he, name_en) in enumerate(PAYMENT_METHODS):
        db.session.add(PaymentMethod(code=code, name={"he": name_he, "en": name_en}, sort_order=order))

    staff = 0
    email, password = os.environ.get("SEED_ADMIN_EMAIL"), os.environ.get("SEED_ADMIN_PASSWORD")
    if email and password:
        admin = StaffUser(email=email.strip().lower(), full_name="Administrator")
        admin.set_password(password)
        db.session.add(admin)
        staff = 1

    customers = 0
    email, password = os.environ.get("SEED_CUSTOMER_EMAIL"), os.environ.get("SEED_CUSTOMER_PASSWORD")
    if email and password:
        customer = BusinessUser(email=email.strip().lower(), full_name="Demo Customer", company_name="Demo Pet Shop")
        customer.set_password(password)
        db.session.add(customer)
        customers = 1

    db.session.flush()
    db.session.commit()
    return {
        "categories": len(categories),
        "brands": len(brands),
        "products": len(products),
        "articles": len(articles),
        "resellers": len(resellers),
        "faq_items": len(faq),
        "settings": len(legacy_settings) + len(BASE_SETTINGS) + len(contact),
        "payment_methods": len(PAYMENT_METHODS),
        "staff_users": staff,
        "business_users": customers,
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
    """Fills an empty database with the stub catalog and content, settings and payment methods (see seed_database)."""
    counts = seed_database()
    click.echo("Seeded: " + ", ".join(f"{count} {name}" for name, count in counts.items()))
