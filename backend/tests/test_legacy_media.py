"""test_legacy_media.py — `flask import-media` (app/database/legacy_media.py): copying the old WordPress site's files
into the file storage, with a fake downloader (the tests never reach the network).
"""
import io
import json
from pathlib import Path

from app import storage
from app.database.legacy_media import MANIFEST, download, import_media
from app.database.seed import read_json

PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 64
PDF = b"%PDF-1.7\n" + b"\0" * 64


def fake_fetch(files: dict[str, bytes]):
    """A downloader that answers from a dict and records what it was asked for.

    Args:
        files: URL -> the bytes it serves; any other URL fails like a 404.

    Returns:
        (fetch, asked): the function and the list of URLs it was called with.
    """
    asked: list[str] = []

    def fetch(url: str) -> bytes:
        """Answers one URL.

        Args:
            url: The URL.

        Returns:
            Its bytes.

        Raises:
            OSError: The URL is not in `files`.
        """
        asked.append(url)
        if url not in files:
            raise OSError("HTTP Error 404: Not Found")
        return files[url]

    return fetch, asked


def test_files_are_copied_once_and_failures_are_reported(app):
    manifest = {
        "products/import-a.png": "https://old.example/a.png",
        "catalog/import-catalog.pdf": "https://old.example/catalog.pdf",
        "products/import-missing.png": "https://old.example/missing.png",
        "products/import-page.png": "https://old.example/page.png",
    }
    fetch, asked = fake_fetch({"https://old.example/a.png": PNG, "https://old.example/catalog.pdf": PDF, "https://old.example/page.png": b"<html>"})
    with app.app_context():
        stored, skipped, failed = import_media(manifest, fetch, workers=2)
        assert (stored, skipped) == (2, 0)
        assert set(failed) == {"products/import-missing.png", "products/import-page.png"}
        assert failed["products/import-page.png"] == "not a picture or a PDF"
        assert storage.object_path("products/import-a.png").read_bytes() == PNG
        assert storage.object_exists("catalog/import-catalog.pdf")
        assert not storage.object_exists("products/import-page.png")

        # A second run fetches only what is still missing.
        asked.clear()
        stored, skipped, failed = import_media(manifest, fetch, workers=2)
        assert (stored, skipped, len(failed)) == (0, 2, 2)
        assert sorted(asked) == ["https://old.example/missing.png", "https://old.example/page.png"]


def test_the_command_exits_with_an_error_when_a_file_failed(app, tmp_path: Path, monkeypatch):
    manifest = tmp_path / "media.json"
    manifest.write_text(json.dumps({"products/import-cli.png": "https://old.example/gone.png"}))
    fetch, _ = fake_fetch({})
    monkeypatch.setattr("app.database.legacy_media.download", fetch)
    with app.app_context():  # what the `flask` command line pushes for every command
        result = app.test_cli_runner().invoke(args=["import-media", "--manifest", str(manifest)])
    assert result.exit_code == 1
    assert "0 files, 0 were already there, 1 failed" in result.output
    assert "products/import-cli.png: download failed" in result.output


def test_the_manifest_lists_every_stored_file_of_the_stubs():
    manifest = read_json(MANIFEST)
    products = read_json(MANIFEST.parent / "products.json")
    keys = set()
    for product in products:
        image = product["image"]
        keys |= {image["src"], image["thumbnail"], *(entry.split()[0] for entry in image["srcSet"].split(",") if entry.strip())}
    assert keys <= set(manifest)
    assert "catalog/ultrapetcatalog.pdf" in manifest
    assert all(storage.KEY_PATTERN.fullmatch(key) for key in manifest)
    assert all(url.startswith("https://www.ultrapet.co.il/wp-content/uploads/") for url in manifest.values())


def test_hebrew_paths_are_percent_encoded(monkeypatch):
    url = "https://www.ultrapet.co.il/wp-content/uploads/2024/03/בקר.png"
    seen = {}

    class Response(io.BytesIO):
        """A stand-in for urlopen's response: a file-like object of a small PNG (BytesIO is a context manager)."""

    def fake_urlopen(request, timeout):
        """Records the request.

        Args:
            request: The urllib Request.
            timeout: Seconds.

        Returns:
            The fake response.
        """
        seen["url"] = request.full_url
        return Response(PNG)

    monkeypatch.setattr("app.database.legacy_media.urlopen", fake_urlopen)
    assert download(url) == PNG
    assert seen["url"] == "https://www.ultrapet.co.il/wp-content/uploads/2024/03/%D7%91%D7%A7%D7%A8.png"
