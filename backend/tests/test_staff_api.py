"""test_staff_api.py — The staff panel API (app/staff/routes.py): access control and create/read/update/delete of
every resource (price rules included), with the field checks and the database constraints turned into 400/409 answers.
"""
import uuid

import pytest

from app.database.models.catalog import Category, Product
from app.database.models.content import FaqItem
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


def test_products_with_images_and_references(api, database):
    category = api("POST", "/categories", {"slug": "dogs", "name": {"he": "כלבים", "en": "Dogs"}}).get_json()
    product = {
        "slug": "beef-14kg",
        "name": {"he": "בקר 14 ק\"ג", "en": "Beef 14 kg"},
        "categoryId": category["id"],
        "listPrice": "303.90",
        "images": [
            {"url": "products/a.jpg", "thumbnailUrl": "/api/media/products/a-300.jpg", "srcset": "products/a-500.jpg 500w, /api/media/products/a-768.jpg 768w"},
            {"url": "products/b.jpg"},
        ],
    }
    response = api("POST", "/products", product)
    assert response.status_code == 201
    created = response.get_json()
    assert (created["listPrice"], created["categoryId"], created["brandId"]) == (303.9, category["id"], None)
    # Stored as keys (a key or our URL is accepted), answered as URLs.
    assert [image["url"] for image in created["images"]] == ["/api/media/products/a.jpg", "/api/media/products/b.jpg"]
    assert created["images"][0]["thumbnailUrl"] == "/api/media/products/a-300.jpg"
    assert created["images"][0]["srcset"] == "/api/media/products/a-500.jpg 500w, /api/media/products/a-768.jpg 768w"
    assert database.get(Product, uuid.UUID(created["id"])).images[0].srcset == "products/a-500.jpg 500w, products/a-768.jpg 768w"

    # Images are replaced as a whole.
    changed = api("PATCH", f"/products/{created['id']}", {"images": [{"url": "products/c.jpg"}]}).get_json()
    assert [image["url"] for image in changed["images"]] == ["/api/media/products/c.jpg"]
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


def test_faq_items_create_read_update_delete(api, staff):
    created = api("POST", "/faq-items", {"question": {"he": "שאלה"}, "answer": {"he": "תשובה", "en": "Answer"}})
    assert created.status_code == 201
    item = created.get_json()
    assert (item["question"], item["answer"], item["sortOrder"], item["updatedById"]) == (
        {"he": "שאלה"}, {"he": "תשובה", "en": "Answer"}, 0, str(staff.id),
    )
    assert api("PATCH", f"/faq-items/{item['id']}", {"question": {"he": "שאלה", "en": "Question"}}).get_json()["question"]["en"] == "Question"
    assert [row["id"] for row in api("GET", "/faq-items").get_json()] == [item["id"]]
    assert api("DELETE", f"/faq-items/{item['id']}").status_code == 204


@pytest.mark.parametrize(
    ("body", "error"),
    [
        ({"question": ["no"], "answer": {}}, {"error": "invalid", "field": "question"}),
        ({"question": {"he": 1}, "answer": {}}, {"error": "invalid", "field": "question"}),
        ({"question": {"he": "שאלה"}}, {"error": "required", "field": "answer"}),
    ],
)
def test_invalid_faq_items_are_refused(api, body, error):
    response = api("POST", "/faq-items", body)
    assert (response.status_code, response.get_json()) == (400, error)


def test_the_faq_list_is_replaced_at_once(api, database, staff, client):
    kept = FaqItem(question={"he": "נשארת"}, answer={"he": "כן"}, sort_order=0)
    untouched = FaqItem(question={"he": "בלי שינוי"}, answer={"he": "כן"}, sort_order=1)
    gone = FaqItem(question={"he": "נמחקת"}, answer={"he": "כן"}, sort_order=2)
    database.add_all([kept, untouched, gone])
    database.commit()
    kept_id, untouched_id, gone_id = str(kept.id), str(untouched.id), str(gone.id)

    response = api(
        "PUT",
        "/faq-items",
        [
            {"id": kept_id, "question": {"he": "נשארת", "en": "Kept"}, "sortOrder": 99},
            {"id": untouched_id, "question": {"he": "בלי שינוי"}, "answer": {"he": "כן"}},
            {"question": {"he": "חדשה", "en": "New"}, "answer": {"he": "תשובה", "en": "Answer"}},
        ],
    )
    assert response.status_code == 200
    rows = response.get_json()
    # The list order is the body's order; a sortOrder in the body is ignored.
    assert [row["sortOrder"] for row in rows] == [0, 1, 2]
    assert [row["id"] for row in rows[:2]] == [kept_id, untouched_id]
    assert rows[0]["question"] == {"he": "נשארת", "en": "Kept"}
    assert rows[0]["answer"] == {"he": "כן"}  # fields left out keep their value
    assert [row["question"]["he"] for row in client.get("/api/faq").get_json()] == ["נשארת", "בלי שינוי", "חדשה"]
    assert database.get(FaqItem, uuid.UUID(gone_id)) is None
    # Only the rows that changed record the editor: the untouched one (same texts, same place) keeps none.
    database.expire_all()
    assert database.get(FaqItem, uuid.UUID(kept_id)).updated_by_id == staff.id
    assert database.get(FaqItem, uuid.UUID(rows[2]["id"])).updated_by_id == staff.id
    assert database.get(FaqItem, uuid.UUID(untouched_id)).updated_by_id is None

    # Moving a row is a change too.
    moved = api("PUT", "/faq-items", [{"id": untouched_id}, {"id": rows[2]["id"]}]).get_json()
    assert [(row["id"], row["sortOrder"]) for row in moved] == [(untouched_id, 0), (rows[2]["id"], 1)]
    database.expire_all()
    assert database.get(FaqItem, uuid.UUID(untouched_id)).updated_by_id == staff.id

    assert api("PUT", "/faq-items", []).get_json() == []
    assert client.get("/api/faq").get_json() == []


@pytest.mark.parametrize(
    ("body", "error"),
    [
        ({"question": {"he": "x"}}, {"error": "invalid_body"}),
        (["not an object"], {"error": "invalid_body"}),
        ([{"id": "not-a-uuid", "question": {"he": "x"}, "answer": {"he": "y"}}], {"error": "invalid", "field": "id"}),
        ([{"id": str(uuid.uuid4()), "question": {"he": "x"}, "answer": {"he": "y"}}], {"error": "invalid", "field": "id"}),
        ([{"question": {"he": "x"}, "answer": {"he": "y"}, "colour": "red"}], {"error": "unknown_field", "field": "colour"}),
        ([{"question": {"he": "x"}}], {"error": "required", "field": "answer"}),
    ],
)
def test_a_refused_faq_list_changes_nothing(api, database, client, body, error):
    database.add(FaqItem(question={"he": "קיימת"}, answer={"he": "כן"}, sort_order=0))
    database.commit()
    response = api("PUT", "/faq-items", body)
    assert (response.status_code, response.get_json()) == (400, error)
    assert [row["question"] for row in client.get("/api/faq").get_json()] == [{"he": "קיימת"}]


def test_an_id_listed_twice_is_refused(api, database):
    item = FaqItem(question={"he": "קיימת"}, answer={"he": "כן"}, sort_order=0)
    database.add(item)
    database.commit()
    twice = {"id": str(item.id), "question": {"he": "קיימת"}, "answer": {"he": "כן"}}
    assert api("PUT", "/faq-items", [twice, twice]).get_json() == {"error": "invalid", "field": "id"}


def test_product_pictures_must_be_in_the_file_storage(api, database):
    category = Category(slug="birds", name={"he": "ציפורים"})
    database.add(category)
    database.commit()
    product = {"slug": "seeds", "name": {"he": "זרעים"}, "categoryId": str(category.id)}
    for image in (
        {"url": "https://www.ultrapet.co.il/wp-content/uploads/a.jpg"},
        {"url": "products/a.jpg", "thumbnailUrl": "https://other.example/a.jpg"},
        {"url": "products/a.jpg", "srcset": "https://other.example/a.jpg 300w"},
        {"url": "products/a.jpg", "srcset": "products/a.jpg"},  # no width
    ):
        response = api("POST", "/products", {**product, "images": [image]})
        assert (response.status_code, response.get_json()["error"]) == (400, "invalid")


def test_brand_logos_must_be_in_the_file_storage(api):
    created = api("POST", "/brands", {"slug": "paw", "name": "Paw", "logoUrl": "brands/paw.png"}).get_json()
    assert created["logoUrl"] == "/api/media/brands/paw.png"
    response = api("PATCH", f"/brands/{created['id']}", {"logoUrl": "https://example.com/paw.svg"})
    assert response.get_json() == {"error": "invalid", "field": "logoUrl"}


def test_a_new_category_is_named_after_its_english_name_and_goes_last(api, database):
    database.add_all([
        Category(slug="dry-dog-food", name={"he": "מזון יבש לכלבים"}, sort_order=0),
        Category(slug="birds", name={"he": "ציפורים"}, sort_order=7),
    ])
    database.commit()
    first = api("POST", "/categories", {"name": {"he": "מזון יבש", "en": "Dry Dog Food!"}}).get_json()
    assert (first["slug"], first["sortOrder"]) == ("dry-dog-food-2", 8)
    second = api("POST", "/categories", {"name": {"he": "עוד", "en": "Dry dog food"}}).get_json()
    assert (second["slug"], second["sortOrder"]) == ("dry-dog-food-3", 9)
    # Hebrew only: a neutral name. Given values are kept.
    assert api("POST", "/categories", {"name": {"he": "חדש"}}).get_json()["slug"] == "category"
    assert api("POST", "/categories", {"name": {"he": "חדש"}}).get_json()["slug"] == "category-2"
    given = api("POST", "/categories", {"name": {"he": "x", "en": "X"}, "slug": "mine", "sortOrder": 3}).get_json()
    assert (given["slug"], given["sortOrder"]) == ("mine", 3)
    # An edit never renames it.
    renamed = api("PATCH", f"/categories/{first['id']}", {"name": {"he": "אחר", "en": "Other"}}).get_json()
    assert renamed["slug"] == "dry-dog-food-2"


def test_the_first_category_starts_the_order(api):
    assert api("POST", "/categories", {"name": {"he": "ציפורים", "en": "Birds"}}).get_json()["sortOrder"] == 0


def test_categories_are_reordered_at_once(api, database, client):
    rows = [Category(slug=slug, name={"he": slug}, sort_order=n) for n, slug in enumerate(["a", "b", "c"])]
    database.add_all(rows)
    database.commit()
    a, b, c = (str(row.id) for row in rows)
    response = api("PUT", "/categories/order", {"ids": [c, a, b]})
    assert response.status_code == 200
    assert [(row["slug"], row["sortOrder"]) for row in response.get_json()] == [("c", 0), ("a", 1), ("b", 2)]
    assert [row["slug"] for row in api("GET", "/categories").get_json()] == ["c", "a", "b"]
    assert [row["slug"] for row in client.get("/api/categories").get_json()] == ["c", "a", "b"]


@pytest.mark.parametrize(
    "ids",
    [
        lambda a, b, c: [a, b],  # a row is missing
        lambda a, b, c: [a, b, c, str(uuid.uuid4())],  # a row that does not exist
        lambda a, b, c: [a, b, b],  # listed twice
        lambda a, b, c: [a, b, "not-a-uuid"],
        lambda a, b, c: [a, b, 3],
    ],
)
def test_a_wrong_order_list_changes_nothing(api, database, ids):
    rows = [Category(slug=slug, name={"he": slug}, sort_order=n) for n, slug in enumerate(["a", "b", "c"])]
    database.add_all(rows)
    database.commit()
    response = api("PUT", "/categories/order", {"ids": ids(*(str(row.id) for row in rows))})
    assert (response.status_code, response.get_json()) == (400, {"error": "invalid", "field": "ids"})
    assert [row["slug"] for row in api("GET", "/categories").get_json()] == ["a", "b", "c"]


@pytest.mark.parametrize("body", [[], {"order": []}, {"ids": "a,b"}])
def test_an_order_needs_an_ids_list(api, body):
    assert api("PUT", "/categories/order", body).get_json() == {"error": "invalid_body"}


def test_only_orderable_resources_can_be_reordered(api):
    assert api("PUT", "/price-rules/order", {"ids": []}).status_code == 405
    assert api("PUT", "/faq-items/order", {"ids": []}).status_code == 405


def test_brands_and_products_are_named_placed_and_reordered_like_categories(api, database):
    paw = api("POST", "/brands", {"name": "Paw"}).get_json()
    jr = api("POST", "/brands", {"name": "JR Farm"}).get_json()
    assert [(b["slug"], b["sortOrder"]) for b in (paw, jr)] == [("paw", 0), ("jr-farm", 1)]
    assert api("POST", "/brands", {"name": "Paw"}).get_json()["slug"] == "paw-2"
    assert api("POST", "/brands", {"name": "פאו"}).get_json()["slug"] == "brand"
    reordered = api("PUT", "/brands/order", {"ids": [b["id"] for b in reversed(api("GET", "/brands").get_json())]}).get_json()
    assert [b["slug"] for b in reordered] == ["brand", "paw-2", "jr-farm", "paw"]

    category = Category(slug="dogs", name={"he": "כלבים"})
    database.add(category)
    database.commit()
    beef = api("POST", "/products", {"name": {"he": "בקר", "en": "Beef 14 kg"}, "categoryId": str(category.id)}).get_json()
    plain = api("POST", "/products", {"name": {"he": "עוף"}, "categoryId": str(category.id)}).get_json()
    assert [(p["slug"], p["sortOrder"]) for p in (beef, plain)] == [("beef-14-kg", 0), ("product", 1)]
    reordered = api("PUT", "/products/order", {"ids": [plain["id"], beef["id"]]}).get_json()
    assert [(p["slug"], p["sortOrder"]) for p in reordered] == [("product", 0), ("beef-14-kg", 1)]


def test_customers_cannot_reorder_categories(customer_client, csrf):
    assert customer_client.put("/api/staff/categories/order", json={"ids": []}, headers=csrf(customer_client)).status_code == 403


def test_only_list_resources_can_be_replaced(api):
    assert api("PUT", "/brands", []).status_code == 405


def test_customers_cannot_replace_the_faq(customer_client, csrf):
    assert customer_client.put("/api/staff/faq-items", json=[], headers=csrf(customer_client)).status_code == 403


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
