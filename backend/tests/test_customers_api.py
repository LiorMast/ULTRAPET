"""test_customers_api.py — The public and customer routes of the `customers` blueprint (app/customers/routes.py).

Catalog categories and products (search in any language, category and brand filters, chip and brand counts, the
sorts, a customer's price sorts and price range, paging), the product page,
brands, stats,
the saved home page sections and FAQ, articles, resellers, the sitemap, and the signed-in customer's prices. Sign-in itself is in test_auth.py.
"""
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.database.models.catalog import Brand, Category, Product, ProductImage
from app.database.models.content import Article, FaqItem, PageSection, Reseller
from app.database.models.price_rules import PriceRule
from app.database.models.settings import Setting


@pytest.fixture
def catalog(database) -> SimpleNamespace:
    """A small catalog: two visible categories and a hidden one, four visible products and two hidden ones.

    Catalog order (sort_order): treat (dogs), salmon cat food (cats), beef (dogs), chew (dogs). "salmon" is in the
    cat food's name and in the treat's English description only (HTML, as the WordPress export stores it).

    Args:
        database: The test database session.

    Returns:
        The rows by name: dogs, cats, hidden, treat, cat_food, beef, chew.
    """
    dogs = Category(slug="dogs", name={"he": "כלבים", "en": "Dogs"}, legacy_path="/product-category/כלבים/", sort_order=0)
    cats = Category(slug="cats", name={"he": "חתולים", "en": "Cats"}, image_url="categories/cats.webp", sort_order=1)
    hidden = Category(slug="hidden", name={"he": "מוסתר"}, sort_order=2, is_active=False)
    treat = Product(
        slug="dog-treat",
        name={"he": "חטיף לכלבים", "en": "Dog Treat"},
        description={"he": "<p>חטיף טעים</p>", "en": "<p>With <strong>salmon</strong> oil, 100% natural</p>"},
        category=dogs,
        list_price=Decimal("10.00"),
        sort_order=0,
        images=[ProductImage(url="products/treat.jpg", sort_order=0)],
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
        {"slug": "dogs", "name": {"he": "כלבים", "en": "Dogs"}, "legacyPath": "/product-category/כלבים/", "imageUrl": None},
        {"slug": "cats", "name": {"he": "חתולים", "en": "Cats"}, "legacyPath": None, "imageUrl": "/api/media/categories/cats.webp"},
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
        # The stored key becomes its URL; no thumbnail or srcset stored: the card falls back to the full image.
        "image": {"src": "/api/media/products/treat.jpg", "thumbnail": "/api/media/products/treat.jpg", "srcSet": ""},
    }
    assert data["items"][1]["image"] is None
    assert "price" not in str(data["items"]).lower()
    # The price fields of the answer exist for customers only; a visitor gets them empty.
    assert (data["sort"], data["priceRange"], data["priceBounds"]) == (None, None, None)


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
        ("strong", []),  # the description is HTML: its tags are not searched
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


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("sort=name-asc&lang=en", ["beef-dog-food", "dog-chew", "dog-treat", "salmon-cat-food"]),
        ("sort=name-desc&lang=en", ["salmon-cat-food", "dog-treat", "dog-chew", "beef-dog-food"]),
        ("sort=name-asc", ["dog-treat", "beef-dog-food", "salmon-cat-food", "dog-chew"]),  # Hebrew by default
        ("sort=no-such-sort", ["dog-treat", "salmon-cat-food", "beef-dog-food", "dog-chew"]),
        ("sort=name-asc&lang=xx", ["dog-treat", "beef-dog-food", "salmon-cat-food", "dog-chew"]),
    ],
)
def test_products_sort_by_name(client, catalog, query, expected):
    assert slugs(client.get(f"/api/products?{query}")) == expected


def test_newest_first_follows_the_woocommerce_id_of_rows_added_together(client, catalog, database):
    for product, woocommerce_id in ((catalog.treat, 1), (catalog.cat_food, 3), (catalog.beef, 2)):
        product.woocommerce_id = woocommerce_id
    database.commit()
    data = client.get("/api/products?sort=newest").get_json()
    assert data["sort"] == "newest"
    # The chew has no WooCommerce id: like a product added later in the admin, but with the same timestamp here.
    assert [item["slug"] for item in data["items"]] == ["salmon-cat-food", "beef-dog-food", "dog-treat", "dog-chew"]


@pytest.fixture
def branded(catalog, database) -> SimpleNamespace:
    """Brands on the small catalog: Paw (treat, cat food), JR Farm (beef), an inactive brand (chew).

    Args:
        catalog: The small catalog.
        database: The test database session.

    Returns:
        The catalog's rows.
    """
    paw = Brand(slug="paw", name="Paw", sort_order=0)
    farm = Brand(slug="jr-farm", name="JR Farm", sort_order=1)
    old = Brand(slug="old", name="Old", is_active=False)
    catalog.treat.brand, catalog.cat_food.brand, catalog.beef.brand, catalog.chew.brand = paw, paw, farm, old
    database.commit()
    return catalog


def test_products_filter_by_brands_with_counts(client, branded):
    data = client.get("/api/products?brand=jr-farm,paw,old,nope").get_json()
    assert data["brands"] == ["paw", "jr-farm"]  # active ones only, in brand order
    assert [item["slug"] for item in data["items"]] == ["dog-treat", "salmon-cat-food", "beef-dog-food"]
    assert data["brandCounts"] == {"paw": 2, "jr-farm": 1}
    assert data["categoryCounts"] == {"dogs": 2, "cats": 1}  # the brand filter applies to the chips


def test_brand_counts_follow_the_category_but_not_the_brand(client, branded):
    data = client.get("/api/products?brand=jr-farm&category=dogs").get_json()
    assert (data["total"], data["brandCounts"], data["categoryCounts"]) == (1, {"paw": 1, "jr-farm": 1}, {"dogs": 1, "cats": 0})


@pytest.fixture
def priced(catalog, database) -> SimpleNamespace:
    """List prices on the small catalog: treat 10, beef 30, chew 20; the cat food has none.

    Args:
        catalog: The small catalog.
        database: The test database session.

    Returns:
        The catalog's rows.
    """
    catalog.beef.list_price, catalog.chew.list_price = Decimal("30.00"), Decimal("20.00")
    database.commit()
    return catalog


def test_a_customer_sorts_by_their_own_price(customer_client, customer, priced, database):
    database.add(PriceRule(business_user=customer, product=priced.beef, kind="amount", value=Decimal("25")))  # beef: 5
    database.commit()
    data = customer_client.get("/api/products?sort=price-asc").get_json()
    assert data["sort"] == "price-asc"
    # The cat food has no price: last either way.
    assert [item["slug"] for item in data["items"]] == ["beef-dog-food", "dog-treat", "dog-chew", "salmon-cat-food"]
    assert data["priceBounds"] == {"min": 5.0, "max": 20.0}
    assert slugs(customer_client.get("/api/products?sort=price-desc")) == ["dog-chew", "dog-treat", "beef-dog-food", "salmon-cat-food"]
    paged = customer_client.get("/api/products?sort=price-asc&pageSize=3&page=2").get_json()
    assert [item["slug"] for item in paged["items"]] == ["salmon-cat-food"]


def test_a_customer_filters_by_a_price_range(customer_client, priced):
    data = customer_client.get("/api/products?min=15&max=40").get_json()
    assert [item["slug"] for item in data["items"]] == ["beef-dog-food", "dog-chew"]
    assert data["priceRange"] == {"min": 15.0, "max": 40.0}
    assert data["categoryCounts"] == {"dogs": 2, "cats": 0}
    assert data["priceBounds"] == {"min": 10.0, "max": 30.0}  # before the range
    swapped = customer_client.get("/api/products?min=25&max=5").get_json()
    assert (swapped["priceRange"], [i["slug"] for i in swapped["items"]]) == ({"min": 5.0, "max": 25.0}, ["dog-treat", "dog-chew"])
    only_min = customer_client.get("/api/products?min=abc&max=-3").get_json()
    assert (only_min["priceRange"], only_min["total"]) == (None, 4)


@pytest.mark.parametrize("who", ["client", "staff_client"])
def test_price_sorts_and_ranges_are_ignored_without_a_customer(request, priced, who):
    client = request.getfixturevalue(who)
    data = client.get("/api/products?sort=price-desc&min=15&max=25").get_json()
    assert (data["sort"], data["priceRange"], data["priceBounds"]) == (None, None, None)
    assert [item["slug"] for item in data["items"]] == ["dog-treat", "salmon-cat-food", "beef-dog-food", "dog-chew"]


def test_an_empty_search_has_one_empty_page(client, catalog):
    data = client.get("/api/products?q=zzzz").get_json()
    assert (data["items"], data["total"], data["page"], data["pageCount"]) == ([], 0, 1, 1)


def test_a_product_page_has_the_full_product_and_its_related_ones(client, catalog, database):
    brand = Brand(slug="paw", name="Paw")
    catalog.beef.brand = brand
    catalog.beef.sku = "08396"
    catalog.beef.barcode = "7290011072026"
    catalog.beef.legacy_path = "/product/בקר/"
    catalog.beef.description = {"he": "<h2>מרכיבים</h2><ul><li>בקר 28%</li></ul>", "en": ""}
    catalog.beef.images = [
        ProductImage(url="products/beef.jpg", thumbnail_url="products/beef-300x300.jpg", srcset="products/beef-768x768.jpg 768w",
                     alt={"he": "שק בקר"}, sort_order=0),
        ProductImage(url="products/beef-back.jpg", sort_order=1),
    ]
    database.commit()
    data = client.get("/api/products/beef-dog-food").get_json()
    assert {k: data[k] for k in ("id", "slug", "name", "sku", "barcode", "legacyPath", "category", "brand")} == {
        "id": str(catalog.beef.id),
        "slug": "beef-dog-food",
        "name": {"he": "מזון בקר לכלבים", "en": "Beef Dog Food"},
        "sku": "08396",
        "barcode": "7290011072026",
        "legacyPath": "/product/בקר/",
        "category": {"slug": "dogs", "name": {"he": "כלבים", "en": "Dogs"}},
        "brand": {"slug": "paw", "name": "Paw"},
    }
    # An empty translation is left out.
    assert data["description"] == {"he": "<h2>מרכיבים</h2>\n<ul><li>בקר 28%</li></ul>"}
    assert data["images"] == [
        {"src": "/api/media/products/beef.jpg", "thumbnail": "/api/media/products/beef-300x300.jpg",
         "srcSet": "/api/media/products/beef-768x768.jpg 768w", "alt": {"he": "שק בקר"}},
        {"src": "/api/media/products/beef-back.jpg", "thumbnail": "/api/media/products/beef-back.jpg", "srcSet": "", "alt": None},
    ]
    # The next products of the category in catalog order, wrapping round; never itself, never a hidden one.
    assert [item["slug"] for item in data["related"]] == ["dog-chew", "dog-treat"]
    assert data["related"][1]["image"]["src"] == "/api/media/products/treat.jpg"
    assert data["updatedAt"].endswith(("+02:00", "+03:00"))
    assert "price" not in str(data).lower()


def test_a_product_page_sanitizes_the_description(client, catalog, database):
    catalog.treat.description = {"he": '<p onclick="x()">טעים<script>alert(1)</script></p><img src=x onerror=alert(1)><a href="javascript:x">קישור</a>'}
    database.commit()
    assert client.get("/api/products/dog-treat").get_json()["description"] == {"he": "<p>טעים</p>\n<p>קישור</p>"}


def test_a_product_page_hides_an_inactive_brand(client, catalog, database):
    catalog.chew.brand = Brand(slug="lino", name="LINO", is_active=False)
    database.commit()
    assert client.get("/api/products/dog-chew").get_json()["brand"] is None


@pytest.mark.parametrize("slug", ["no-such-product", "old-salmon", "hidden-salmon"])
def test_a_product_page_is_404_when_unknown_inactive_or_in_a_hidden_category(client, catalog, slug):
    assert client.get(f"/api/products/{slug}").status_code == 404


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


def test_sections_lists_every_saved_section_by_key(client, database):
    assert client.get("/api/sections").get_json() == {}
    database.add_all([PageSection(key="hero", content={"a": 1}), PageSection(key="about", content={"b": 2})])
    database.commit()
    assert client.get("/api/sections").get_json() == {"hero": {"a": 1}, "about": {"b": 2}}


def test_contact_reads_the_settings(client, database):
    assert client.get("/api/contact").get_json() == {"phone": "", "whatsapp": "", "email": ""}
    database.add_all(
        [Setting(key="contact_phone", value="1700-55-99-92"), Setting(key="contact_email", value="office@example.com")]
    )
    database.commit()
    assert client.get("/api/contact").get_json() == {"phone": "1700-55-99-92", "whatsapp": "", "email": "office@example.com"}


def test_faq_lists_the_questions_in_display_order(client, database):
    assert client.get("/api/faq").get_json() == []
    second = FaqItem(question={"he": "שאלה ב"}, answer={"he": "תשובה ב"}, sort_order=1)
    first = FaqItem(question={"he": "שאלה א", "en": "Question A"}, answer={"he": "תשובה א", "en": "Answer A"}, sort_order=0)
    database.add_all([second, first])
    database.commit()
    assert client.get("/api/faq").get_json() == [
        {"id": str(first.id), "question": {"he": "שאלה א", "en": "Question A"}, "answer": {"he": "תשובה א", "en": "Answer A"}},
        {"id": str(second.id), "question": {"he": "שאלה ב"}, "answer": {"he": "תשובה ב"}},
    ]


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


def test_the_sitemap_lists_the_visible_product_pages(client, catalog, database):
    catalog.chew.slug = "עצם-dog-chew"
    database.commit()
    xml = client.get("/api/sitemap.xml").get_data(as_text=True)
    assert "<loc>https://www.ultrapet.co.il/products/dog-treat</loc>" in xml
    assert "<loc>https://www.ultrapet.co.il/en/products/beef-dog-food</loc>" in xml
    assert "<loc>https://www.ultrapet.co.il/products/%D7%A2%D7%A6%D7%9D-dog-chew</loc>" in xml  # percent-encoded
    assert "old-salmon" not in xml and "hidden-salmon" not in xml


def test_the_catalog_pdf_redirects_to_the_stored_file(client, database):
    assert client.get("/api/catalog.pdf").status_code == 404
    database.add(Setting(key="catalog_pdf", value="catalog/ultrapetcatalog.pdf"))
    database.commit()
    response = client.get("/api/catalog.pdf")
    assert (response.status_code, response.headers["Location"]) == (302, "/api/media/catalog/ultrapetcatalog.pdf")


def test_brand_logos_are_answered_as_urls(client, database):
    database.add(Brand(slug="paw", name="Paw", logo_url="brands/paw.png"))
    database.commit()
    assert client.get("/api/brands").get_json()[0]["logoUrl"] == "/api/media/brands/paw.png"


def test_prices_need_a_signed_in_customer(client):
    assert client.get("/api/prices").get_json() == {"error": "unauthorized"}


def test_prices_are_the_customers_own(customer_client, customer, catalog, database):
    database.add(PriceRule(business_user=customer, category=catalog.dogs, kind="percent", value=Decimal("10")))
    database.commit()
    data = customer_client.get("/api/prices").get_json()
    # Only the treat has a list price; the customer's 10% dog discount applies to it.
    # No product's stock is tracked, so there is no stock status (see test_inventory.py).
    assert data == {"currency": "ILS", "prices": {str(catalog.treat.id): 9.0}, "stock": {}}
