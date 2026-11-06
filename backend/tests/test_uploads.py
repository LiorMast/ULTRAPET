"""test_uploads.py — Picture uploads: the staff route POST /api/staff/uploads (app/staff/routes.py), the S3 stub that
stores the files (app/storage.py) and the public route that serves them (GET /api/media/<key>).
"""
import io
from pathlib import Path

import pytest

from app import storage

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
    assert key.startswith("categories/") and key.endswith(f".{extension}")
    assert url == f"/api/media/{key}"
    assert (Path(app.config["MEDIA_ROOT"]) / key).read_bytes() == body

    served = client.get(url)
    assert served.status_code == 200
    assert served.data == body
    assert served.mimetype == media_type
    assert served.headers["X-Content-Type-Options"] == "nosniff"
    assert "immutable" in served.headers["Cache-Control"]


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
