"""test_catalog_pdf.py — The generated PDF catalog (app/catalog_pdf.py): what a build writes and when it is skipped,
the layout options and their checks, the rebuild after a staff change, the staff routes of the "PDF catalog" dialog
(GET / POST /api/staff/catalog-pdf) and the public download (GET /api/catalog.pdf?lang=).
"""
import io
import re

import pytest
from PIL import Image

from app import catalog_pdf, storage
from app.database.models.catalog import Brand, Category, Product, ProductImage
from app.database.models.settings import Setting, get_setting


def png(color: str = "red") -> bytes:
    """A small real picture.

    Args:
        color: Its fill color.

    Returns:
        PNG bytes.
    """
    out = io.BytesIO()
    Image.new("RGB", (40, 60), color).save(out, "PNG")
    return out.getvalue()


def page_count(body: bytes) -> int:
    """Counts the pages of a PDF by its page objects.

    Args:
        body: The PDF's bytes.

    Returns:
        The number of pages.
    """
    return len(re.findall(rb"/Type /Page\b", body))


@pytest.fixture
def catalog(database):
    """Two categories with seven active products (one with a stored photo, one whose photo file is missing), an
    inactive product, an empty category and the contact details.

    Args:
        database: The test database session.

    Returns:
        The first category.
    """
    storage.put_object("products/test-photo.png", png(), "image/png")
    brand = Brand(slug="paw", name="Paw")
    cats = Category(slug="cats", name={"he": "מזון יבש לחתולים", "en": "Dry cat food"}, sort_order=0)
    dogs = Category(slug="dogs", name={"he": "כלבים", "en": "Dogs"}, sort_order=1)
    empty = Category(slug="birds", name={"he": "ציפורים", "en": "Birds"}, sort_order=2)
    database.add_all([brand, cats, dogs, empty])
    database.flush()
    for index in range(5):
        database.add(Product(slug=f"cat-{index}", name={"he": f"PET FAN חול מתגבש {index} ליטר", "en": f"Litter {index} L"},
                             category_id=cats.id, brand_id=brand.id, sku=f"AB-{index}", barcode=f"729000{index}", sort_order=index,
                             images=[ProductImage(url="products/test-photo.png" if index == 0 else "products/missing.jpg")] if index < 2 else []))
    for index in range(2):
        database.add(Product(slug=f"dog-{index}", name={"he": f"עצם לעיסה {index}", "en": f"Chew bone {index}"}, category_id=dogs.id, sort_order=index))
    database.add(Product(slug="hidden", name={"he": "מוסתר", "en": "Hidden"}, category_id=dogs.id, is_active=False))
    database.add(Setting(key="contact_phone", value="1700-55-99-92"))
    database.add(Setting(key="contact_email", value="office@ultrapet.co.il"))
    database.commit()
    return cats


@pytest.fixture
def api(staff_client, csrf):
    """Calls the staff API as the signed-in staff user, with the CSRF header on every change.

    Args:
        staff_client: The signed-in client.
        csrf: Builds the CSRF header.

    Returns:
        A function (method, path, json=None) -> the response; path is relative to /api/staff.
    """
    return lambda method, path, json=None: staff_client.open(
        f"/api/staff{path}", method=method, json=json, headers=csrf(staff_client) if method != "GET" else {}
    )


def test_a_build_writes_a_catalog_per_language(catalog):
    status = catalog_pdf.build_catalog()
    files = get_setting("catalog_pdf_files")
    assert set(files) == {"he", "en"}
    assert (status["state"], status["products"]) == ("ready", 7)
    # Cover + (title page + 2 pages of up to 3) + (title page + 1 page) + back page.
    assert status["pages"] == 7
    for locale, key in files.items():
        assert re.fullmatch(rf"catalog/ultrapet-catalog-{locale}-\d{{8}}T\d{{6}}Z\.pdf", key)
        body = storage.get_object(key)
        assert body.startswith(b"%PDF-") and page_count(body) == 7


def test_the_data_holds_only_active_products_of_active_categories_and_never_prices(catalog, database):
    database.add(Product(slug="extra", name={"he": "נוסף", "en": "Extra"}, category_id=catalog.id, list_price=99, sort_order=9))
    database.commit()
    data = catalog_pdf.catalog_data()
    assert [category["name"]["en"] for category in data["categories"]] == ["Dry cat food", "Dogs"]
    assert [len(category["products"]) for category in data["categories"]] == [6, 2]
    first = data["categories"][0]["products"][0]
    assert first == {"name": {"he": "PET FAN חול מתגבש 0 ליטר", "en": "Litter 0 L"}, "brand": "Paw", "sku": "AB-0", "barcode": "7290000", "image": "products/test-photo.png"}
    assert data["categories"][0]["products"][-1] == {"name": {"he": "נוסף", "en": "Extra"}, "brand": None, "sku": None, "barcode": None, "image": None}
    assert "price" not in str(data).lower()
    assert data["contact"]["phone"] == "1700-55-99-92"


@pytest.mark.parametrize(
    ("options", "pages"),
    [
        ({"perPage": 1}, 1 + (1 + 5) + (1 + 2) + 1),
        ({"perPage": 6, "showBrand": True, "showSku": True, "showBarcode": True}, 1 + (1 + 1) + (1 + 1) + 1),
        ({"perPage": 12, "categoryPages": False}, 1 + 1 + 1 + 1),
    ],
)
def test_the_options_decide_the_pages(catalog, database, options, pages):
    database.add(Setting(key="catalog_pdf_options", value=options))
    database.commit()
    assert catalog_pdf.build_catalog()["pages"] == pages


@pytest.mark.parametrize(("per_page", "expected"), [(1, (1, 1)), (3, (3, 1)), (4, (4, 1)), (5, (3, 2)), (8, (4, 2)), (9, (3, 3)), (12, (4, 3))])
def test_the_grid_of_a_page(per_page, expected):
    assert catalog_pdf.grid(per_page) == expected


@pytest.mark.parametrize(
    ("raw", "field"),
    [({"perPage": 0}, "perPage"), ({"perPage": 13}, "perPage"), ({"perPage": "3"}, "perPage"), ({"perPage": True}, "perPage"), ({"showSku": 1}, "showSku"), ([], "options")],
)
def test_bad_options_are_refused(raw, field):
    with pytest.raises(ValueError, match=field):
        catalog_pdf.clean_options(raw)


def test_options_left_out_take_their_defaults():
    assert catalog_pdf.clean_options({"perPage": 6, "unknown": 1}) == catalog_pdf.DEFAULT_OPTIONS | {"perPage": 6}


def test_an_unchanged_catalog_is_not_rebuilt_unless_forced(catalog, database):
    catalog_pdf.build_catalog()
    files = get_setting("catalog_pdf_files")
    catalog_pdf.build_catalog()
    assert get_setting("catalog_pdf_files") == files

    database.get(Category, catalog.id).name = {"he": "חתולים", "en": "Cats"}
    database.commit()
    catalog_pdf.build_catalog()
    assert catalog_pdf.fingerprint_of(catalog_pdf.catalog_data(), catalog_pdf.stored_options()) == get_setting("catalog_pdf_status")["fingerprint"]


def test_a_change_the_options_hide_is_not_a_new_catalog(catalog, database):
    catalog_pdf.build_catalog()
    files = get_setting("catalog_pdf_files")
    product = database.query(Product).filter_by(slug="cat-0").one()
    product.barcode = "0000000000017"
    database.commit()
    catalog_pdf.build_catalog()
    assert get_setting("catalog_pdf_files") == files

    shown = catalog_pdf.DEFAULT_OPTIONS | {"showBarcode": True}
    data = catalog_pdf.catalog_data()
    assert catalog_pdf.fingerprint_of(data, shown) != catalog_pdf.fingerprint_of(data, catalog_pdf.DEFAULT_OPTIONS)


def test_a_new_build_replaces_the_files_and_deletes_the_old_ones(catalog, monkeypatch):
    stamps = iter(["20261101T000000Z", "20261102T000000Z"])

    class Clock(catalog_pdf.datetime):
        """A clock whose file-name stamps differ between two builds of the same second."""

        def strftime(self, pattern):
            """Formats the time; the stamp pattern gets the next fake stamp.

            Args:
                pattern: The strftime pattern.

            Returns:
                The text.
            """
            return next(stamps) if pattern.endswith("Z") else super().strftime(pattern)

    monkeypatch.setattr(catalog_pdf, "datetime", Clock)
    catalog_pdf.build_catalog()
    old = get_setting("catalog_pdf_files")
    catalog_pdf.build_catalog(force=True)
    new = get_setting("catalog_pdf_files")
    assert new["he"].endswith("20261102T000000Z.pdf")
    assert not any(storage.object_exists(key) for key in old.values())
    assert all(storage.object_exists(key) for key in new.values())


def test_a_failed_build_keeps_the_previous_files_and_says_so(catalog, monkeypatch):
    catalog_pdf.build_catalog()
    files = get_setting("catalog_pdf_files")

    def broken(*args):
        """Stands in for render and fails.

        Args:
            args: Ignored.
        """
        raise RuntimeError("no ink")

    monkeypatch.setattr(catalog_pdf, "render", broken)
    with pytest.raises(RuntimeError):
        catalog_pdf.build_catalog(force=True)
    status = get_setting("catalog_pdf_status")
    assert (status["state"], status["error"]) == ("failed", "no ink")
    assert get_setting("catalog_pdf_files") == files and storage.object_exists(files["he"])


def test_a_staff_change_to_a_product_rebuilds_the_catalog(app, api, catalog, database, monkeypatch):
    monkeypatch.setitem(app.config, "CATALOG_REBUILD", "inline")
    product = database.scalar(Product.__table__.select().where(Product.slug == "dog-0"))
    assert api("PATCH", f"/products/{product}", {"isActive": False}).status_code == 200
    assert get_setting("catalog_pdf_status")["products"] == 6
    # Not after a change the catalog does not show, a refused change or a read.
    built = get_setting("catalog_pdf_status")["builtAt"]
    monkeypatch.setattr(catalog_pdf, "build_catalog", lambda *args, **kwargs: pytest.fail("rebuilt"))
    assert api("POST", "/faq-items", {"question": {"he": "ש"}, "answer": {"he": "ת"}}).status_code == 201
    assert api("PATCH", f"/products/{product}", {"listPrice": "x"}).status_code == 400
    assert api("GET", "/products").status_code == 200
    assert get_setting("catalog_pdf_status")["builtAt"] == built


def test_no_automatic_rebuild_when_staff_switched_it_off(app, api, catalog, database, monkeypatch):
    monkeypatch.setitem(app.config, "CATALOG_REBUILD", "inline")
    database.add(Setting(key="catalog_pdf_options", value={"autoRebuild": False}))
    database.commit()
    assert api("PATCH", f"/categories/{catalog.id}", {"sortOrder": 5}).status_code == 200
    assert get_setting("catalog_pdf_status") is None


def test_the_dialog_reads_the_state_and_generates(app, api, catalog, monkeypatch):
    assert api("GET", "/catalog-pdf").get_json() == {"options": catalog_pdf.DEFAULT_OPTIONS, "status": {"state": "none"}, "urls": {}}

    # The answer says "building" while the build runs in the background.
    response = api("POST", "/catalog-pdf", {"options": {"perPage": 6}})
    assert (response.status_code, response.get_json()["status"]["state"]) == (202, "building")
    assert response.get_json()["options"]["perPage"] == 6

    monkeypatch.setitem(app.config, "CATALOG_REBUILD", "inline")
    state = api("POST", "/catalog-pdf", {"options": {"showSku": True}}).get_json()
    assert state["options"] == catalog_pdf.DEFAULT_OPTIONS | {"perPage": 6, "showSku": True}
    assert (state["status"]["state"], state["status"]["pages"], state["status"]["products"]) == ("ready", 6, 7)
    assert "fingerprint" not in state["status"]
    assert re.fullmatch(r"/api/media/catalog/ultrapet-catalog-en-\w+\.pdf", state["urls"]["en"])


@pytest.mark.parametrize(
    ("body", "error"),
    [
        ({}, {"error": "invalid_body"}),
        ({"options": 3}, {"error": "invalid_body"}),
        ({"options": {"perPage": 40}}, {"error": "invalid", "field": "perPage"}),
        ({"options": {"categoryPages": "yes"}}, {"error": "invalid", "field": "categoryPages"}),
    ],
)
def test_the_dialog_refuses_bad_options(api, body, error):
    response = api("POST", "/catalog-pdf", body)
    assert (response.status_code, response.get_json()) == (400, error)
    assert get_setting("catalog_pdf_options") is None


def test_visitors_cannot_reach_the_dialog(client):
    assert client.get("/api/staff/catalog-pdf").status_code == 401


def test_customers_cannot_reach_the_dialog(customer_client):
    assert customer_client.get("/api/staff/catalog-pdf").status_code == 403


def test_a_build_that_never_finished_reads_as_failed(database):
    database.add(Setting(key="catalog_pdf_status", value={"state": "building", "startedAt": "2026-01-01T00:00:00+00:00"}))
    database.commit()
    assert catalog_pdf.catalog_state()["status"]["state"] == "failed"


def test_the_download_follows_the_language_and_falls_back(client, catalog, database):
    assert client.get("/api/catalog.pdf").status_code == 404
    database.add(Setting(key="catalog_pdf", value="catalog/ultrapetcatalog.pdf"))
    database.commit()
    assert client.get("/api/catalog.pdf?lang=en").headers["Location"] == "/api/media/catalog/ultrapetcatalog.pdf"

    catalog_pdf.build_catalog()
    files = get_setting("catalog_pdf_files")
    for query, locale in (("", "he"), ("?lang=he", "he"), ("?lang=en", "en"), ("?lang=ru", "he")):
        response = client.get(f"/api/catalog.pdf{query}")
        assert (response.status_code, response.headers["Location"]) == (302, f"/api/media/{files[locale]}")
        assert response.headers["Cache-Control"] == "no-store"
    served = client.get(f"/api/media/{files['en']}")
    assert served.mimetype == "application/pdf" and served.data.startswith(b"%PDF-")
