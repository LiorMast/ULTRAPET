"""test_customers_api.py — The public and customer routes of the `customers` blueprint (app/customers/routes.py).

Catalog categories and products (search in any language, category filter, chip counts, paging), brands, stats,
articles, resellers, the sitemap, and the signed-in customer's prices. Sign-in itself is in test_auth.py.
"""
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.database.models.catalog import Brand, Category, Product, ProductImage
from app.database.models.content import Article, PageSection, Reseller
from app.database.models.price_rules import PriceRule
from app.database.models.settings import Setting


@pytest.fixture
def catalog(database) -> SimpleNamespace:
    """A small catalog: two visible categories and a hidden one, four visible products and two hidden ones.

    Catalog order (sort_order): treat (dogs), salmon cat food (cats), beef (dogs), chew (dogs). "salmon" is in the
    cat food's name and in the treat's English description only.

    Args:
        database: The test database session.

    Returns:
        The rows by name: dogs, cats, hidden, treat, cat_food, beef, chew.
    """
    dogs = Category(slug="dogs", name={"he": "כלבים", "en": "Dogs"}, legacy_path="/product-category/כלבים/", sort_order=0)
    cats = Category(slug="cats", name={"he": "חתולים", "en": "Cats"}, sort_order=1)
    hidden = Category(slug="hidden", name={"he": "מוסתר"}, sort_order=2, is_active=False)
    treat = Product(
        slug="dog-treat",
        name={"he": "חטיף לכלבים", "en": "Dog Treat"},
        description={"he": "חטיף טעים", "en": "With salmon oil, 100% natural"},
        category=dogs,
        list_price=Decimal("10.00"),
        sort_order=0,
        images=[ProductImage(url="https://img/treat.jpg", sort_order=0)],
    )
    cat_food = Product(slug="salmon-cat-food", name={"he": "מזון סלמון לחתולים", "en": "Salmon Cat Food"}, category=cats, sort_order=1)
    beef = Product(slug="beef-dog-food", name={"he": "מזון בקר לכלבים", "en": "Beef Dog Food"}, category=dogs, sort_order=2)
    chew = Product(slug="dog-chew", name={"he": "עצם לעיסה", "en": "Dog Chew"}, category=dogs, sort_order=3)
    gone = Product(slug="old-salmon", name={"he": "סלמון ישן"}, category=dogs, is_active=False)
    in_hidden = Product(slug="hidden-salmon", name={"he": "סלמון מוסתר"}, category=hidden)
    database.add_all([dogs, cats, hidden, treat, cat_food, beef, chew, gone, in_hidden])
    database.commit()
    return SimpleNamespace(dogs=dogs, cats=cats, hidden=hidden, treat=treat, cat_food=cat_food, beef=beef, chew=chew)


def slugs(response) -> list[str]:
    """The product slugs of a /api/products response, in order.

    Args:
        response: The test-client response.

    Returns:
        The slugs.
    """
    return [item["slug"] for item in response.get_json()["items"]]


def test_categories_lists_the_active_ones_in_order(client, catalog):
    assert client.get("/api/categories").get_json() == [
        {"slug": "dogs", "name": {"he": "כלבים", "en": "Dogs"}, "legacyPath": "/product-category/כלבים/"},
        {"slug": "cats", "name": {"he": "חתולים", "en": "Cats"}, "legacyPath": None},
    ]


def test_products_lists_the_visible_ones_in_catalog_order_without_prices(client, catalog):
    data = client.get("/api/products").get_json()
    assert [item["slug"] for item in data["items"]] == ["dog-treat", "salmon-cat-food", "beef-dog-food", "dog-chew"]
    assert {k: data[k] for k in ("page", "pageSize", "pageCount", "total", "category")} == {
        "page": 1, "pageSize": 24, "pageCount": 1, "total": 4, "category": None
    }
    assert data["categoryCounts"] == {"dogs": 3, "cats": 1}
    assert data["items"][0] == {
        "id": str(catalog.treat.id),
        "slug": "dog-treat",
        "name": {"he": "חטיף לכלבים", "en": "Dog Treat"},
        "category": "dogs",
        # No thumbnail or srcset stored: the card falls back to the full image.
        "image": {"src": "https://img/treat.jpg", "thumbnail": "https://img/treat.jpg", "srcSet": ""},
    }
    assert data["items"][1]["image"] is None
    assert "price" not in str(data).lower()


def test_products_filters_by_category(client, catalog):
    response = client.get("/api/products?category=dogs")
    assert slugs(response) == ["dog-treat", "beef-dog-food", "dog-chew"]
    assert (response.get_json()["category"], response.get_json()["total"]) == ("dogs", 3)


@pytest.mark.parametrize("category", ["hidden", "no-such-category"])
def test_products_ignores_an_unknown_or_hidden_category(client, catalog, category):
    data = client.get(f"/api/products?category={category}").get_json()
    assert (data["category"], data["total"]) == (None, 4)


@pytest.mark.parametrize(
    ("q", "expected"),
    [
        ("salmon", ["dog-treat", "salmon-cat-food"]),  # the treat matches through its English description
        ("SALMON cat", ["salmon-cat-food"]),  # every word must match; case is ignored
        ("סלמון", ["salmon-cat-food"]),  # Hebrew
        ("100%", ["dog-treat"]),  # % is a literal character, not a wildcard
        ("D_g", []),  # so is _
        ("zzzz", []),
    ],
)
def test_products_searches_every_language(client, catalog, q, expected):
    assert slugs(client.get("/api/products", query_string={"q": q})) == expected


def test_category_counts_follow_the_search_but_not_the_category(client, catalog):
    data = client.get("/api/products?q=salmon&category=cats").get_json()
    assert data["categoryCounts"] == {"dogs": 1, "cats": 1}
    assert (data["total"], [item["slug"] for item in data["items"]]) == (1, ["salmon-cat-food"])


def test_products_pages_and_clamps_the_page(client, catalog):
    data = client.get("/api/products?pageSize=3&page=2").get_json()
    assert ([item["slug"] for item in data["items"]], data["page"], data["pageCount"]) == (["dog-chew"], 2, 2)
    assert client.get("/api/products?pageSize=3&page=99").get_json()["page"] == 2
    assert client.get("/api/products?page=abc").get_json()["page"] == 1
    assert client.get("/api/products?pageSize=1000").get_json()["pageSize"] == 100


def test_an_empty_search_has_one_empty_page(client, catalog):
    data = client.get("/api/products?q=zzzz").get_json()
    assert (data["items"], data["total"], data["page"], data["pageCount"]) == ([], 0, 1, 1)


def test_brands_lists_the_active_ones_and_finds_one(client, database):
    database.add_all(
        [
            Brand(slug="paw", name="Paw", accent_color="#C97D30", tagline={"he": "יומיומי"}, sort_order=1),
            Brand(slug="ultra-pet", name="Ultra Pet", sort_order=0),
            Brand(slug="old", name="Old Brand", is_active=False),
        ]
    )
    database.commit()
    assert [b["slug"] for b in client.get("/api/brands").get_json()] == ["ultra-pet", "paw"]
    assert client.get("/api/brands/paw").get_json() == {
        "slug": "paw", "name": "Paw", "accent": "#C97D30", "tagline": {"he": "יומיומי"}, "description": None,
        "logoUrl": None,
    }
    assert client.get("/api/brands/old").status_code == 404
    assert client.get("/api/brands/missing").get_json() == {"error": "not_found"}


def test_stats_reads_the_settings_in_display_order(client, database):
    database.add_all(
        [
            Setting(key="stat_years_value", value=12),
            Setting(key="stat_retail_value", value=350),
            Setting(key="stat_retail_suffix", value="+"),
        ]
    )
    database.commit()
    assert client.get("/api/stats").get_json() == [
        {"id": "retail", "value": 350, "suffix": "+"},
        {"id": "years", "value": 12, "suffix": ""},
    ]


@pytest.fixture
def articles(database) -> None:
    """Two published articles, a draft and one scheduled for tomorrow.

    Args:
        database: The test database session.
    """
    body = {"he": [{"type": "p", "text": "שלום"}], "en": [{"type": "p", "text": "Hello"}]}

    def article(slug: str, published_at: datetime | None) -> Article:
        """Builds an article.

        Args:
            slug: Its slug.
            published_at: Its publication time (None = draft).

        Returns:
            The unsaved article.
        """
        return Article(
            slug=slug, topic="cats", title={"he": slug}, description={"he": "תקציר"}, body=body,
            published_at=published_at, updated_at=datetime(2024, 3, 17, 22, 30, tzinfo=UTC),
        )

    database.add_all(
        [
            article("older", datetime(2024, 3, 17, 10, 40, 39, tzinfo=UTC)),
            article("newer", datetime(2024, 5, 1, 9, 0, tzinfo=UTC)),
            article("draft", None),
            article("scheduled", datetime.now(UTC) + timedelta(days=1)),
        ]
    )
    database.commit()


def test_articles_lists_the_published_ones_newest_first(client, articles):
    data = client.get("/api/articles").get_json()
    assert [a["slug"] for a in data] == ["newer", "older"]
    older = data[1]
    # Dates are ISO 8601 in Israel time, like the WordPress dates the site started with.
    assert (older["publishedAt"], older["updatedAt"]) == ("2024-03-17T12:40:39+02:00", "2024-03-18T00:30:00+02:00")
    assert older["body"]["en"] == [{"type": "p", "text": "Hello"}]
    assert (older["relatedCategories"], older["imageAlt"], older["legacyPath"]) == ([], None, None)


def test_sections_returns_the_saved_content(client, database):
    assert client.get("/api/sections/hero").status_code == 404
    database.add(PageSection(key="hero", content={"title": {"text": {"he": "שלום"}}}))
    database.commit()
    data = client.get("/api/sections/hero").get_json()
    assert (data["key"], data["content"]) == ("hero", {"title": {"text": {"he": "שלום"}}})
    assert data["updatedAt"].endswith(("+02:00", "+03:00"))


def test_an_unpublished_article_is_not_found(client, articles):
    assert client.get("/api/articles/older").status_code == 200
    assert client.get("/api/articles/draft").status_code == 404
    assert client.get("/api/articles/scheduled").status_code == 404


def test_resellers_lists_the_active_ones_by_city_and_name(client, database):
    database.add_all(
        [
            Reseller(name="Zoo", address="1 Main", city="חיפה", latitude=32.8, longitude=35.0, approximate_location=True),
            Reseller(name="Alpha", address="2 Main", city="חיפה", phone="04-1", website="https://a.co", latitude=32.7,
                     longitude=35.1),
            Reseller(name="Beta", address="3 Main", city="אילת", latitude=29.5, longitude=34.9),
            Reseller(name="Closed", address="4 Main", city="אילת", latitude=29.5, longitude=34.9, is_active=False),
        ]
    )
    database.commit()
    data = client.get("/api/resellers").get_json()
    assert [r["name"] for r in data] == ["Beta", "Alpha", "Zoo"]
    assert {k: v for k, v in data[1].items() if k != "id"} == {
        "name": "Alpha", "address": "2 Main", "city": "חיפה", "phone": "04-1", "website": "https://a.co", "lat": 32.7,
        "lng": 35.1, "approximate": False,
    }
    assert data[2]["approximate"] is True


def test_the_sitemap_lists_the_pages_and_published_articles_in_each_language(client, articles):
    response = client.get("/api/sitemap.xml")
    assert response.mimetype == "application/xml"
    xml = response.get_data(as_text=True)
    for loc in ["https://www.ultrapet.co.il/", "https://www.ultrapet.co.il/en", "https://www.ultrapet.co.il/catalog",
                "https://www.ultrapet.co.il/en/articles", "https://www.ultrapet.co.il/articles/older",
                "https://www.ultrapet.co.il/en/articles/newer"]:
        assert f"<loc>{loc}</loc>" in xml
    assert '<xhtml:link rel="alternate" hreflang="en" href="https://www.ultrapet.co.il/en/articles/older"/>' in xml
    assert "<lastmod>2024-03-18</lastmod>" in xml  # the update date in Israel
    assert "draft" not in xml and "scheduled" not in xml


def test_prices_need_a_signed_in_customer(client):
    assert client.get("/api/prices").get_json() == {"error": "unauthorized"}


def test_prices_are_the_customers_own(customer_client, customer, catalog, database):
    database.add(PriceRule(business_user=customer, category=catalog.dogs, kind="percent", value=Decimal("10")))
    database.commit()
    data = customer_client.get("/api/prices").get_json()
    # Only the treat has a list price; the customer's 10% dog discount applies to it.
    assert data == {"currency": "ILS", "prices": {str(catalog.treat.id): 9.0}}
