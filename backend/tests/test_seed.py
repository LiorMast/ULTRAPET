"""test_seed.py — `flask seed` loads the stub catalog and content (articles, resellers, FAQ), settings, payment methods
and the optional users."""
import uuid
from decimal import Decimal

import pytest
from click import ClickException
from sqlalchemy import func, select

from app.database.models.catalog import Brand, Category, Product, ProductImage
from app.database.models.content import Article, FaqItem, Reseller
from app.database.models.orders import PaymentMethod
from app.database.seed import seed_database
from app.database.models.settings import get_setting
from app.database.models.users import BusinessUser


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
    monkeypatch.setenv("SEED_CUSTOMER_EMAIL", "Shop@Example.com")
    monkeypatch.setenv("SEED_CUSTOMER_PASSWORD", "customer-password")
    counts = seed_database()

    assert counts == {
        "categories": 15,
        "brands": 6,
        "products": 400,
        "articles": 4,
        "resellers": 124,
        "faq_items": 7,
        "settings": 15,
        "payment_methods": 3,
        "staff_users": 1,
        "business_users": 1,
    }
    assert (count(database, Category), count(database, Brand), count(database, Product)) == (15, 6, 400)
    assert count(database, PaymentMethod) == 3
    assert (count(database, Article), count(database, Reseller)) == (4, 124)

    product = database.scalar(select(Product).where(Product.woocommerce_id == 1081))
    assert isinstance(product.id, uuid.UUID)
    assert product.category.slug == "dry-dog-food"
    assert product.list_price == Decimal("303.90")
    assert product.name["en"] == "INTERNUTRI ORIGINAL DOG BEEF Dog Food 14 kg"
    # Pictures are object keys in the file storage (copied there by `flask import-media`), never WordPress URLs.
    assert product.images[0].url == "products/2026-05-45f8dcaa-598f-4d57-91c3-e59a834a5d80.png"
    assert product.images[0].thumbnail_url == "products/2026-05-45f8dcaa-598f-4d57-91c3-e59a834a5d80-300x300.png"
    assert database.scalar(select(func.count()).select_from(ProductImage).where(ProductImage.url.contains("://"))) == 0
    assert get_setting("catalog_pdf") == "catalog/ultrapetcatalog.pdf"
    # The catalog keeps the stub order: 1081 is the first product of products.json.
    assert product.sort_order == 0
    assert database.scalar(select(func.max(Product.sort_order))) == 399

    article = database.scalar(select(Article).where(Article.slug == "living-with-a-cat"))
    assert article.published_at.isoformat() == "2024-03-17T10:35:25+00:00"
    assert article.body["he"][0]["type"] == "p"
    assert database.scalar(select(Reseller).where(Reseller.name == "Petway")).city == "חיפה"
    assert database.scalar(select(func.count()).where(Reseller.approximate_location)) == 41
    faq = database.scalars(select(FaqItem).order_by(FaqItem.sort_order)).all()
    assert [item.sort_order for item in faq] == list(range(7))
    assert faq[0].question == {"he": "האם אתם מוכרים ללקוחות פרטיים?", "en": "Do you sell to private customers?"}
    assert faq[3].answer["en"] == "Yes, the minimum order is ₪2,000."
    customer = database.scalar(select(BusinessUser))
    assert (customer.email, customer.company_name) == ("shop@example.com", "Demo Pet Shop")
    assert customer.check_password("customer-password")
    assert get_setting("min_order_amount") == 2000
    assert get_setting("stat_retail_value") == 350
    assert get_setting("missing", "fallback") == "fallback"
    assert (get_setting("contact_phone"), get_setting("contact_whatsapp")) == ("1700-55-99-92", "+972 52-214-2410")

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
