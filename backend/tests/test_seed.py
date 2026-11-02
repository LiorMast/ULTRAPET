"""test_seed.py — `flask seed` loads the stub catalog, settings and payment methods into an empty database."""
import uuid
from decimal import Decimal

import pytest
from click import ClickException
from sqlalchemy import func, select

from app.database.models.catalog import Brand, Category, Product
from app.database.models.orders import PaymentMethod
from app.database.seed import seed_database
from app.database.models.settings import get_setting


def count(database, model) -> int:
    """Counts the rows of a model.

    Args:
        database: The test database session.
        model: The model class.

    Returns:
        The number of rows.
    """
    return database.scalar(select(func.count()).select_from(model))


def test_seed_loads_the_stub_data(database, monkeypatch):
    monkeypatch.setenv("SEED_ADMIN_EMAIL", "Admin@UltraPet.co.il")
    monkeypatch.setenv("SEED_ADMIN_PASSWORD", "secret-password")
    counts = seed_database()

    assert counts == {
        "categories": 15,
        "brands": 6,
        "products": 400,
        "settings": 11,
        "payment_methods": 3,
        "staff_users": 1,
    }
    assert (count(database, Category), count(database, Brand), count(database, Product)) == (15, 6, 400)
    assert count(database, PaymentMethod) == 3

    product = database.scalar(select(Product).where(Product.woocommerce_id == 1081))
    assert isinstance(product.id, uuid.UUID)
    assert product.category.slug == "dry-dog-food"
    assert product.list_price == Decimal("303.90")
    assert product.name["en"] == "INTERNUTRI ORIGINAL DOG BEEF Dog Food 14 kg"
    assert product.images[0].thumbnail_url.endswith("-300x300.png")
    assert get_setting("min_order_amount") == 2000
    assert get_setting("stat_retail_value") == 350
    assert get_setting("missing", "fallback") == "fallback"

    # A product created later has no WooCommerce id and still gets its own id.
    new = Product(slug="new-product", name={"he": "מוצר חדש"}, category=product.category)
    database.add(new)
    database.commit()
    assert new.woocommerce_id is None
    assert new.id != product.id


def test_seed_refuses_a_database_that_has_data(database):
    seed_database()
    with pytest.raises(ClickException, match="not empty"):
        seed_database()


def test_the_seed_command_reports_what_it_added(app, database):
    result = app.test_cli_runner().invoke(args=["seed"])
    assert result.exit_code == 0, result.output
    assert "400 products" in result.output
