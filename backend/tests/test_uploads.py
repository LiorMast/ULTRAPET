"""test_uploads.py — Picture uploads: the staff route POST /api/staff/uploads (app/staff/routes.py), the S3 stub that
stores the files (app/storage.py), the public route that serves them (GET /api/media/<key>), and how a row stores a
picture: only its object key, the URL being built from S3_BUCKET / S3_REGION.
"""
import io
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app import storage
from app.database.models.catalog import Category

# The first bytes of each accepted image type, padded to a small "file".
PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\0" * 64
WEBP = b"RIFF\0\0\0\0WEBPVP8 " + b"\0" * 64
AVIF = b"\0\0\0\x1cftypavif" + b"\0" * 64


@pytest.fixture
def upload(staff_client, csrf):
    """Uploads a file as the signed-in staff user.

    Args:
        staff_client: The signed-in client.
        csrf: Builds the CSRF header.

    Returns:
        A function (body, name="photo.png", folder="categories") -> the response; body None sends no file.
    """

    def send(body: bytes | None, name: str = "photo.png", folder: str = "categories"):
        """Posts one multipart upload.

        Args:
            body: The file's bytes, or None for a form without a file.
            name: The file name the browser would send.
            folder: The upload folder.

        Returns:
            The response.
        """
        data = {"folder": folder}
        if body is not None:
            data["file"] = (io.BytesIO(body), name)
        return staff_client.post("/api/staff/uploads", data=data, headers=csrf(staff_client), content_type="multipart/form-data")

    return send


@pytest.mark.parametrize(
    ("body", "extension", "media_type"),
    [(PNG, "png", "image/png"), (JPEG, "jpg", "image/jpeg"), (WEBP, "webp", "image/webp"), (AVIF, "avif", "image/avif")],
)
def test_staff_upload_a_picture_that_is_then_served(app, client, upload, body, extension, media_type):
    response = upload(body, name="whatever.bin")
    assert response.status_code == 201
    key, url = response.json["key"], response.json["url"]
    assert re.fullmatch(rf"categories/\d{{8}}T\d{{6}}Z_[0-9a-f]{{32}}\.{extension}", key)
    assert "whatever" not in key
    assert url == f"/api/media/{key}"
    assert (Path(app.config["MEDIA_ROOT"]) / key).read_bytes() == body

    served = client.get(url)
    assert served.status_code == 200
    assert served.data == body
    assert served.mimetype == media_type
    assert served.headers["X-Content-Type-Options"] == "nosniff"
    assert "immutable" in served.headers["Cache-Control"]


def test_a_key_starts_with_the_upload_time_in_utc(upload):
    before = datetime.now(timezone.utc).replace(microsecond=0)
    key = upload(PNG).json["key"]
    stamp = datetime.strptime(key.removeprefix("categories/").split("_")[0], "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
    assert before <= stamp <= datetime.now(timezone.utc) + timedelta(seconds=1)


def test_every_upload_gets_a_new_key(upload):
    assert upload(PNG).json["key"] != upload(PNG).json["key"]


def test_signed_out_visitors_cannot_upload(client):
    response = client.post("/api/staff/uploads", data={"folder": "categories", "file": (io.BytesIO(PNG), "a.png")})
    assert response.status_code == 401


def test_customers_cannot_upload(customer_client, csrf):
    response = customer_client.post(
        "/api/staff/uploads",
        data={"folder": "categories", "file": (io.BytesIO(PNG), "a.png")},
        headers=csrf(customer_client),
    )
    assert response.status_code == 403


def test_an_unknown_folder_is_refused(upload):
    response = upload(PNG, folder="../secrets")
    assert response.status_code == 400
    assert response.json == {"error": "invalid", "field": "folder"}


@pytest.mark.parametrize("body", [None, b""])
def test_a_file_is_required(upload, body):
    response = upload(body)
    assert response.status_code == 400
    assert response.json == {"error": "required", "field": "file"}


@pytest.mark.parametrize(
    ("body", "name"),
    [(b"just some text", "notes.png"), (b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "logo.svg")],
)
def test_only_raster_images_are_accepted(upload, body, name):
    response = upload(body, name=name)
    assert response.status_code == 400
    assert response.json == {"error": "unsupported_type", "field": "file"}


def test_a_picture_over_5_mb_is_refused(upload):
    response = upload(PNG + b"\0" * (5 * 1024 * 1024))
    assert response.status_code == 400
    assert response.json == {"error": "too_large", "field": "file"}


def test_a_body_over_the_app_limit_is_refused(upload):
    response = upload(PNG + b"\0" * (7 * 1024 * 1024))
    assert response.status_code == 413
    assert response.json == {"error": "request_entity_too_large"}


@pytest.mark.parametrize("path", ["/api/media/categories/missing.png", "/api/media/../app/__init__.py", "/api/media/%2e%2e/x"])
def test_unknown_or_escaping_media_paths_are_not_found(client, path):
    assert client.get(path).status_code == 404


def test_delete_object_removes_the_file_and_ignores_a_missing_one(app, upload):
    key = upload(PNG).json["key"]
    with app.app_context():
        storage.delete_object(key)
        storage.delete_object(key)
    assert not (Path(app.config["MEDIA_ROOT"]) / key).exists()


@pytest.fixture
def category(database):
    """A category without a photo.

    Args:
        database: The test database session.

    Returns:
        The saved category.
    """
    row = Category(slug="birds", name={"he": "ציפורים", "en": "Birds"})
    database.add(row)
    database.commit()
    return row


@pytest.fixture
def set_picture(staff_client, csrf, category):
    """Changes the category's imageUrl through the staff API.

    Args:
        staff_client: The signed-in staff client.
        csrf: Builds the CSRF header.
        category: The category to change.

    Returns:
        A function (value) -> the PATCH response.
    """

    def patch(value):
        """Sends the PATCH.

        Args:
            value: The imageUrl to save.

        Returns:
            The response.
        """
        return staff_client.patch(f"/api/staff/categories/{category.id}", json={"imageUrl": value}, headers=csrf(staff_client))

    return patch


def test_a_row_stores_the_key_of_an_uploaded_picture_and_answers_its_url(client, database, upload, set_picture, category):
    uploaded = upload(PNG).json
    key, url = uploaded["key"], uploaded["url"]
    response = set_picture(url)
    assert response.status_code == 200
    assert response.json["imageUrl"] == url
    database.refresh(category)
    assert category.image_url == key
    assert client.get("/api/categories").get_json()[0]["imageUrl"] == url


def test_a_bare_key_is_stored_as_is(database, set_picture, category):
    assert set_picture("categories/abc.webp").json["imageUrl"] == "/api/media/categories/abc.webp"
    database.refresh(category)
    assert category.image_url == "categories/abc.webp"


@pytest.mark.parametrize("value", ["", None])
def test_an_empty_picture_is_stored_as_none(database, set_picture, category, value):
    assert set_picture(value).json["imageUrl"] is None
    database.refresh(category)
    assert category.image_url is None


def test_urls_are_built_from_the_configured_bucket_and_region(app, client, database, monkeypatch, set_picture, category):
    monkeypatch.setitem(app.config, "S3_BUCKET", "ultrapet-media")
    monkeypatch.setitem(app.config, "S3_REGION", "eu-central-1")
    url = "https://ultrapet-media.s3.eu-central-1.amazonaws.com/categories/abc.webp"
    assert set_picture(url).json["imageUrl"] == url
    database.refresh(category)
    assert category.image_url == "categories/abc.webp"
    assert client.get("/api/categories").get_json()[0]["imageUrl"] == url


@pytest.mark.parametrize(
    "value",
    [
        "https://example.com/birds.png",
        "https://other-bucket.s3.eu-central-1.amazonaws.com/categories/abc.webp",
        "/api/media/../app/__init__.py",
        "categories/../../etc/passwd",
        "/etc/passwd",
        "//example.com/categories/a.png",
        42,
    ],
)
def test_anything_but_one_of_our_objects_is_refused(database, set_picture, category, value):
    response = set_picture(value)
    assert response.status_code == 400
    assert response.json == {"error": "invalid", "field": "imageUrl"}
    database.refresh(category)
    assert category.image_url is None


def test_brand_logos_are_uploaded_into_their_own_folder(upload):
    response = upload(PNG, folder="brands")
    assert response.status_code == 201
    assert response.json["key"].startswith("brands/")


def test_a_srcset_names_keys_and_is_answered_with_urls(app, monkeypatch):
    stored = "products/a-300x300.jpg 300w, products/a-768x768.jpg 768w"
    with app.app_context():
        assert storage.srcset_urls(stored) == "/api/media/products/a-300x300.jpg 300w, /api/media/products/a-768x768.jpg 768w"
        assert storage.srcset_urls(None) is None
        monkeypatch.setitem(app.config, "S3_BUCKET", "ultrapet-media")
        monkeypatch.setitem(app.config, "S3_REGION", "eu-central-1")
        assert storage.srcset_urls("products/a.jpg 500w") == "https://ultrapet-media.s3.eu-central-1.amazonaws.com/products/a.jpg 500w"


def test_a_stored_pdf_is_served_as_a_pdf(app, client):
    with app.app_context():
        assert not storage.object_exists("catalog/test-served.pdf")
        storage.put_object("catalog/test-served.pdf", b"%PDF-1.7\n" + b"\0" * 32, "application/pdf")
        assert storage.object_exists("catalog/test-served.pdf")
    response = client.get("/api/media/catalog/test-served.pdf")
    assert (response.status_code, response.mimetype) == (200, "application/pdf")


def test_file_type_knows_pdfs_only_when_asked():
    pdf = b"%PDF-1.7\n" + b"\0" * 32
    assert storage.file_type(pdf) is None
    assert storage.file_type(pdf, storage.IMAGE_TYPES + storage.DOCUMENT_TYPES) == ("pdf", "application/pdf")
    assert storage.file_type(PNG) == ("png", "image/png")
