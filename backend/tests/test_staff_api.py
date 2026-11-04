"""test_staff_api.py — The staff panel API (app/staff/routes.py): access control and create/read/update/delete of
every resource (price rules included), with the field checks and the database constraints turned into 400/409 answers.
"""
import uuid

import pytest

from app.database.models.catalog import Category, Product
from app.database.models.price_rules import PriceRule


@pytest.fixture
def api(staff_client, csrf):
    """Calls the staff API as the signed-in staff user, with the CSRF header on every change.

    Args:
        staff_client: The signed-in client.
        csrf: Builds the CSRF header.

    Returns:
        A function (method, path, json=None) -> the test-client response; path is relative to /api/staff.
    """

    def call(method: str, path: str, json=None):
        """Sends one request.

        Args:
            method: "GET", "POST", "PATCH" or "DELETE".
            path: E.g. "/brands".
            json: The request body, if any.

        Returns:
            The response.
        """
        headers = csrf(staff_client) if method != "GET" else {}
        return staff_client.open(f"/api/staff{path}", method=method, json=json, headers=headers)

    return call


def test_the_staff_api_needs_a_staff_sign_in(client):
    assert client.get("/api/staff/brands").get_json() == {"error": "unauthorized"}
    assert client.get(f"/api/staff/products/{uuid.uuid4()}").status_code == 401  # no 404 before signing in
    assert client.post("/api/staff/brands", json={"slug": "x", "name": "X"}).status_code == 401


def test_unknown_resources_and_keys_are_not_found(api):
    assert api("GET", "/suppliers").status_code == 404
    assert api("GET", "/brands/not-a-uuid").status_code == 404
    assert api("GET", f"/brands/{uuid.uuid4()}").get_json() == {"error": "not_found"}


def test_brands_create_read_update_delete(api):
    response = api("POST", "/brands", {"slug": "jr-farm", "name": "JR Farm", "tagline": {"he": "מומחים"}, "sortOrder": 4})
    assert response.status_code == 201
    brand = response.get_json()
    assert {k: brand[k] for k in ("slug", "name", "tagline", "accentColor", "logoUrl", "sortOrder", "isActive")} == {
        "slug": "jr-farm", "name": "JR Farm", "tagline": {"he": "מומחים"}, "accentColor": None, "logoUrl": None,
        "sortOrder": 4, "isActive": True,
    }
    assert brand["createdAt"] and brand["updatedAt"]

    assert [b["slug"] for b in api("GET", "/brands").get_json()] == ["jr-farm"]
    changed = api("PATCH", f"/brands/{brand['id']}", {"accentColor": "#4A7C42", "isActive": False}).get_json()
    assert (changed["accentColor"], changed["isActive"], changed["name"]) == ("#4A7C42", False, "JR Farm")
    assert api("GET", f"/brands/{brand['id']}").get_json()["accentColor"] == "#4A7C42"

    assert api("DELETE", f"/brands/{brand['id']}").status_code == 204
    assert api("GET", f"/brands/{brand['id']}").status_code == 404


@pytest.mark.parametrize(
    ("body", "error"),
    [
        ({"slug": "ok", "name": "Ok", "sortOrder": "1"}, {"error": "invalid", "field": "sortOrder"}),
        ({"slug": "ok", "name": "Ok", "isActive": 1}, {"error": "invalid", "field": "isActive"}),
        ({"slug": "ok", "name": "Ok", "colour": "#fff"}, {"error": "unknown_field", "field": "colour"}),
        ({"slug": "Not A Slug", "name": "Bad"}, {"error": "invalid", "constraint": "brands_slug_check"}),
        ({"slug": "ok", "name": "Ok", "tagline": {"en": "No Hebrew"}}, {"error": "invalid", "constraint": "brands_tagline_check"}),
        ({"slug": "ok"}, {"error": "required", "field": "name"}),
        (["not", "an", "object"], {"error": "invalid_body"}),
    ],
)
def test_invalid_fields_are_refused(api, body, error):
    response = api("POST", "/brands", body)
    assert (response.status_code, response.get_json()) == (400, error)


def test_a_duplicate_slug_is_a_conflict(api):
    api("POST", "/brands", {"slug": "paw", "name": "Paw"})
    response = api("POST", "/brands", {"slug": "paw", "name": "Paw again"})
    assert (response.status_code, response.get_json()) == (409, {"error": "duplicate", "constraint": "brands_slug_key"})


def test_a_change_needs_a_json_body(staff_client, csrf):
    response = staff_client.post("/api/staff/brands", data="slug=x", headers=csrf(staff_client))
    assert response.status_code == 415


def test_products_with_images_and_references(api):
    category = api("POST", "/categories", {"slug": "dogs", "name": {"he": "כלבים", "en": "Dogs"}}).get_json()
    product = {
        "slug": "beef-14kg",
        "name": {"he": "בקר 14 ק\"ג", "en": "Beef 14 kg"},
        "categoryId": category["id"],
        "listPrice": "303.90",
        "images": [{"url": "https://img/a.jpg", "thumbnailUrl": "https://img/a-300.jpg"}, {"url": "https://img/b.jpg"}],
    }
    response = api("POST", "/products", product)
    assert response.status_code == 201
    created = response.get_json()
    assert (created["listPrice"], created["categoryId"], created["brandId"]) == (303.9, category["id"], None)
    assert [image["url"] for image in created["images"]] == ["https://img/a.jpg", "https://img/b.jpg"]
    assert created["images"][0]["thumbnailUrl"] == "https://img/a-300.jpg"

    # Images are replaced as a whole.
    changed = api("PATCH", f"/products/{created['id']}", {"images": [{"url": "https://img/c.jpg"}]}).get_json()
    assert [image["url"] for image in changed["images"]] == ["https://img/c.jpg"]
    assert [p["slug"] for p in api("GET", "/products").get_json()] == ["beef-14kg"]

    missing = api("POST", "/products", {**product, "slug": "other", "categoryId": str(uuid.uuid4())})
    assert (missing.status_code, missing.get_json()["error"]) == (400, "invalid_reference")
    malformed = api("POST", "/products", {**product, "slug": "other", "categoryId": "dogs"})
    assert malformed.get_json() == {"error": "invalid", "field": "categoryId"}
    negative = api("PATCH", f"/products/{created['id']}", {"listPrice": -1})
    assert negative.get_json() == {"error": "invalid", "constraint": "products_list_price_check"}


def test_price_rules_are_discounts_on_a_category_or_product(api, database, staff):
    category = Category(slug="cats", name={"he": "חתולים"})
    product = Product(slug="tuna", name={"he": "טונה"}, category=category)
    database.add(product)
    database.commit()

    response = api("POST", "/price-rules", {"categoryId": str(category.id), "kind": "percent", "value": 10,
                                            "startsOn": "2026-11-01", "endsOn": "2026-11-30"})
    assert response.status_code == 201
    rule = response.get_json()
    assert {k: rule[k] for k in ("categoryId", "productId", "businessUserId", "kind", "value", "startsOn", "endsOn", "isActive")} == {
        "categoryId": str(category.id), "productId": None, "businessUserId": None, "kind": "percent", "value": 10.0,
        "startsOn": "2026-11-01", "endsOn": "2026-11-30", "isActive": True,
    }
    assert database.get(PriceRule, uuid.UUID(rule["id"])).created_by_id == staff.id

    # A general discount by amount, open-ended.
    amount = api("POST", "/price-rules", {"productId": str(product.id), "kind": "amount", "value": "12.50", "startsOn": "2026-11-03"})
    assert (amount.status_code, amount.get_json()["value"]) == (201, 12.5)
    changed = api("PATCH", f"/price-rules/{rule['id']}", {"kind": "amount", "value": 5, "endsOn": None}).get_json()
    assert (changed["kind"], changed["value"], changed["endsOn"]) == ("amount", 5.0, None)
    assert [r["id"] for r in api("GET", "/price-rules").get_json()] == [rule["id"], amount.get_json()["id"]]
    assert api("DELETE", f"/price-rules/{rule['id']}").status_code == 204


@pytest.mark.parametrize(
    ("body", "error"),
    [
        ({"kind": "percent", "value": 0}, {"error": "invalid", "constraint": "price_rules_value_check"}),
        ({"kind": "amount", "value": -5}, {"error": "invalid", "constraint": "price_rules_value_check"}),
        ({"kind": "percent", "value": 101}, {"error": "invalid", "constraint": "price_rules_percent_max_check"}),
        ({"kind": "percent", "value": 5, "startsOn": "2026-12-01", "endsOn": "2026-11-01"}, {"error": "invalid", "constraint": "price_rules_dates_check"}),
        ({"kind": "percent", "value": 5, "startsOn": "1 Nov"}, {"error": "invalid", "field": "startsOn"}),
        ({"kind": "percent"}, {"error": "required", "field": "value"}),
    ],
)
def test_invalid_price_rules_are_refused(api, database, body, error):
    category = Category(slug="birds", name={"he": "ציפורים"})
    database.add(category)
    database.commit()
    response = api("POST", "/price-rules", {"categoryId": str(category.id), **body})
    assert (response.status_code, response.get_json()) == (400, error)


def test_a_category_with_products_cannot_be_deleted(api, database):
    category = Category(slug="birds", name={"he": "ציפורים"})
    database.add(Product(slug="seeds", name={"he": "זרעים"}, category=category))
    database.commit()
    response = api("DELETE", f"/categories/{category.id}")
    assert (response.status_code, response.get_json()["error"]) == (409, "in_use")


def test_settings_are_keyed_by_their_name(api):
    assert api("POST", "/settings", {"key": "min_order_amount", "value": 2000}).status_code == 201
    assert api("PATCH", "/settings/min_order_amount", {"value": 2500}).get_json()["value"] == 2500
    assert api("GET", "/settings/min_order_amount").get_json() == {
        **api("GET", "/settings/min_order_amount").get_json(), "key": "min_order_amount", "value": 2500,
        "description": None,
    }
    assert "id" not in api("GET", "/settings").get_json()[0]
    assert api("DELETE", "/settings/min_order_amount").status_code == 204


def test_page_sections_record_who_made_the_last_change(api, database, staff, client):
    hero = {"title": {"text": {"he": "אולטרה", "en": "Ultra"}, "size": {"he": "lg"}}}
    created = api("POST", "/page-sections", {"key": "hero", "content": hero})
    assert created.status_code == 201
    assert created.get_json()["updatedById"] == str(staff.id)
    changed = api("PATCH", "/page-sections/hero", {"content": {"tagline": {}}}).get_json()
    assert changed["content"] == {"tagline": {}}  # the content is replaced as a whole
    assert changed["updatedAt"] >= created.get_json()["updatedAt"]
    assert client.get("/api/sections/hero").get_json()["content"] == {"tagline": {}}


@pytest.mark.parametrize(
    ("body", "error"),
    [
        ({"key": "hero", "content": ["not", "an", "object"]}, {"error": "invalid", "field": "content"}),
        ({"key": "Hero!", "content": {}}, {"error": "invalid", "constraint": "page_sections_key_check"}),
        ({"key": "hero"}, {"error": "required", "field": "content"}),
    ],
)
def test_invalid_page_sections_are_refused(api, body, error):
    response = api("POST", "/page-sections", body)
    assert (response.status_code, response.get_json()) == (400, error)


def test_customers_cannot_edit_page_sections(customer_client, csrf):
    response = customer_client.post("/api/staff/page-sections", json={"key": "hero", "content": {}}, headers=csrf(customer_client))
    assert response.status_code == 403


def test_articles_are_published_by_setting_published_at(api, client):
    article = {
        "slug": "new-post",
        "topic": "dogs",
        "title": {"he": "כותרת"},
        "description": {"he": "תקציר"},
        "body": {"he": [{"type": "p", "text": "טקסט"}]},
        "relatedCategories": ["dog-food"],
    }
    created = api("POST", "/articles", article).get_json()
    assert created["publishedAt"] is None
    assert client.get("/api/articles/new-post").status_code == 404  # a draft

    # Without a UTC offset the time is Israel time.
    published = api("PATCH", f"/articles/{created['id']}", {"publishedAt": "2024-06-01T09:00:00"}).get_json()
    assert published["publishedAt"] == "2024-06-01T06:00:00+00:00"
    assert client.get("/api/articles/new-post").get_json()["publishedAt"] == "2024-06-01T09:00:00+03:00"

    bad_body = api("POST", "/articles", {**article, "slug": "bad", "body": {"en": []}})
    assert bad_body.get_json() == {"error": "invalid", "constraint": "articles_body_check"}
    bad_date = api("PATCH", f"/articles/{created['id']}", {"publishedAt": "tomorrow"})
    assert bad_date.get_json() == {"error": "invalid", "field": "publishedAt"}


def test_resellers_need_a_valid_location(api):
    shop = {"name": "Pet Shop", "address": "1 Main", "city": "חיפה", "latitude": 32.8, "longitude": 35}
    created = api("POST", "/resellers", shop)
    assert created.status_code == 201
    assert created.get_json()["longitude"] == 35.0
    out_of_range = api("POST", "/resellers", {**shop, "latitude": 91})
    assert out_of_range.get_json() == {"error": "invalid", "constraint": "resellers_latitude_check"}
    no_city = api("POST", "/resellers", {k: v for k, v in shop.items() if k != "city"})
    assert no_city.get_json() == {"error": "required", "field": "city"}
