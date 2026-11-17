"""test_storage.py — The file storage (app/storage.py) and its two drivers: the same contract (put / get / exists /
delete, URLs, keys) holds for the local stub and for the S3 driver (app/storage_s3.py, over moto's fake S3), plus what
only S3 does (each object's ContentType and Cache-Control, /api/media/ redirecting to the bucket), the start-up check
of the settings, and `flask push-media` (the stub's files copied into the bucket).
"""
from pathlib import Path

import pytest
from flask import Flask

from app import create_app, storage
from app.database.legacy_media import push_media
from tests.conftest import S3_TEST_BUCKET, S3_TEST_REGION

PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 64
BUCKET_URL = f"https://{S3_TEST_BUCKET}.s3.{S3_TEST_REGION}.amazonaws.com/"


@pytest.fixture(params=["local", "s3"])
def backend(request: pytest.FixtureRequest, app: Flask) -> str:
    """Runs a test once per driver (the S3 one inside moto's fake S3, see the `s3` fixture).

    Args:
        request: pytest's request (the parameter, and the `s3` fixture when needed).
        app: The application.

    Returns:
        "local" or "s3".
    """
    if request.param == "s3":
        request.getfixturevalue("s3")
    return request.param


def test_an_object_is_stored_read_and_deleted(app, backend):
    with app.app_context():
        key = f"categories/contract-{backend}.png"
        assert not storage.object_exists(key)
        assert storage.get_object(key) is None
        url = storage.put_object(key, PNG, "image/png")
        assert url == storage.public_url(key)
        assert storage.object_exists(key)
        assert storage.get_object(key) == PNG
        storage.put_object(key, PNG + b"x", "image/png")
        assert storage.get_object(key) == PNG + b"x"
        storage.delete_object(key)
        assert not storage.object_exists(key)
        storage.delete_object(key)  # a missing key is not an error


def test_the_driver_follows_the_setting(app, backend):
    with app.app_context():
        assert type(storage.driver()).__name__ == {"local": "LocalStorage", "s3": "S3Storage"}[backend]
        assert storage.uses_s3() is (backend == "s3")


def test_urls_and_keys_follow_the_driver(app, backend):
    base = {"local": "/api/media/", "s3": BUCKET_URL}[backend]
    with app.app_context():
        assert storage.public_url("brands/a.webp") == f"{base}brands/a.webp"
        assert storage.url_of(None) is None
        assert storage.object_key(f"{base}brands/a.webp") == "brands/a.webp"
        # The stub's URL is still ours under S3 (links saved before the switch).
        assert storage.object_key("/api/media/brands/a.webp") == "brands/a.webp"
        with pytest.raises(ValueError):
            storage.object_key("https://example.com/brands/a.webp")


def test_the_stub_ignores_bucket_settings(app, monkeypatch):
    monkeypatch.setitem(app.config, "S3_BUCKET", "ultrapet-media")
    monkeypatch.setitem(app.config, "S3_REGION", "eu-central-1")
    with app.app_context():
        assert storage.public_url("brands/a.webp") == "/api/media/brands/a.webp"


def test_a_public_url_setting_serves_the_objects_from_a_cdn(app, s3, monkeypatch):
    monkeypatch.setitem(app.config, "S3_PUBLIC_URL", "https://media.ultrapet.co.il")
    with app.app_context():
        assert storage.public_url("products/a.jpg") == "https://media.ultrapet.co.il/products/a.jpg"
        assert storage.object_key("https://media.ultrapet.co.il/products/a.jpg") == "products/a.jpg"


def test_s3_objects_keep_their_type_and_a_year_long_cache(app, s3):
    with app.app_context():
        storage.put_object("catalog/a.pdf", b"%PDF-1.7\n", "application/pdf")
    head = s3.head_object(Bucket=S3_TEST_BUCKET, Key="catalog/a.pdf")
    assert head["ContentType"] == "application/pdf"
    assert head["CacheControl"] == "public, max-age=31536000, immutable"


def test_media_links_redirect_to_the_bucket_under_s3(client, s3):
    response = client.get("/api/media/categories/a.png")
    assert response.status_code == 301
    assert response.headers["Location"] == f"{BUCKET_URL}categories/a.png"
    assert client.get("/api/media/../app/__init__.py").status_code == 404


@pytest.mark.parametrize(
    ("settings", "message"),
    [
        ({"STORAGE_BACKEND": "ftp"}, "STORAGE_BACKEND must be one of"),
        ({"STORAGE_BACKEND": "s3"}, "needs S3_BUCKET and S3_REGION"),
        ({"STORAGE_BACKEND": "s3", "S3_BUCKET": "b"}, "needs S3_BUCKET and S3_REGION"),
    ],
)
def test_the_app_refuses_storage_settings_that_cannot_work(app, settings, message):
    base = {"SQLALCHEMY_DATABASE_URI": app.config["SQLALCHEMY_DATABASE_URI"], "SECRET_KEY": "x" * 32, "S3_BUCKET": "", "S3_REGION": ""}
    with pytest.raises(RuntimeError, match=message):
        create_app(base | settings)


def test_push_media_copies_the_stub_files_the_bucket_lacks(app, s3):
    root = Path(app.config["MEDIA_ROOT"])
    for key in ("products/push-a.png", "products/push-b.png"):
        (root / key).parent.mkdir(parents=True, exist_ok=True)
        (root / key).write_bytes(PNG)
    (root / "products" / "not a key.png").write_bytes(PNG)
    s3.put_object(Bucket=S3_TEST_BUCKET, Key="products/push-b.png", Body=b"already there")
    with app.app_context():
        planned = push_media(dry_run=True)
        assert s3.list_objects_v2(Bucket=S3_TEST_BUCKET, Prefix="products/push-a")["KeyCount"] == 0
        copied, skipped, failed = push_media()
    assert planned[0] == copied
    assert "products/push-a.png" not in failed
    assert skipped >= 1
    assert failed["products/not a key.png"] == "not an object key"
    copied_a = s3.get_object(Bucket=S3_TEST_BUCKET, Key="products/push-a.png")
    assert copied_a["Body"].read() == PNG
    assert copied_a["ContentType"] == "image/png"
    assert s3.get_object(Bucket=S3_TEST_BUCKET, Key="products/push-b.png")["Body"].read() == b"already there"
    (root / "products" / "not a key.png").unlink()


def test_push_media_needs_the_s3_driver(app):
    with app.app_context():  # what the `flask` command line pushes for every command
        result = app.test_cli_runner().invoke(args=["push-media"])
    assert result.exit_code != 0
    assert "STORAGE_BACKEND=s3" in result.output
