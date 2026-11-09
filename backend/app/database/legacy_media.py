"""legacy_media.py — `flask import-media`: copies the files the old WordPress site served (the 400 products' photos with
their sized copies, the PDF catalog) into our file storage (app/storage.py: the S3 stub now, the bucket later).

Every resource the new site loads comes from that storage or is bundled with the frontend; nothing is hot-linked
from www.ultrapet.co.il. The seed (app/database/seed.py) writes the rows with the object keys only; this command
fetches the files behind them, once. The list is frontend/src/stubs/legacy-media.json: object key -> the WordPress URL
it came from (made when the stubs' URLs were turned into keys).

The command is safe to repeat: objects that already exist are skipped, so a run that failed half-way just runs again.
A download must be a JPEG, PNG, WebP or AVIF picture or a PDF (storage.file_type); anything else is reported and not
stored. Once the WordPress site is gone this command has nothing to fetch: copy the bucket (or backend/media) instead.
"""
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit
from urllib.request import Request, urlopen

import click
from flask import current_app

from app import storage
from app.database.seed import STUBS_DIR, read_json

MANIFEST = STUBS_DIR / "legacy-media.json"
# Parallel downloads, the time one may take, and the largest file accepted (the PDF catalog is the biggest).
WORKERS = 8
TIMEOUT_SECONDS = 60
MAX_BYTES = 100 * 1024 * 1024
# A generic client name for the old site's server logs.
USER_AGENT = "UltraPetMediaImport/1.0"


def download(url: str) -> bytes:
    """Fetches one file from the old site.

    Args:
        url: The WordPress URL; its path may hold Hebrew letters, which are percent-encoded here.

    Returns:
        The file's bytes.

    Raises:
        OSError: The request failed (urllib's HTTPError and URLError are OSErrors), or the file is larger than
            MAX_BYTES.
    """
    parts = urlsplit(url)
    request = Request(urlunsplit(parts._replace(path=quote(parts.path))), headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310 (the manifest lists https URLs only)
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise OSError("file too large")
    return body


def import_media(
    manifest: dict[str, str], fetch: Callable[[str], bytes] | None = None, workers: int = WORKERS
) -> tuple[int, int, dict[str, str]]:
    """Copies every listed file that the storage does not have yet into it.

    Args:
        manifest: Object key -> source URL.
        fetch: Downloads one URL; None = download (the tests pass a fake).
        workers: How many downloads run at once.

    Returns:
        (stored, skipped, failed): how many files were stored, how many were already there, and key -> the reason
        for each file that could not be stored.
    """
    app = current_app._get_current_object()
    fetch = fetch or download
    todo = {key: url for key, url in manifest.items() if not storage.object_exists(key)}

    def copy(key: str, url: str) -> str | None:
        """Downloads one file and stores it under its key.

        Args:
            key: The object key, e.g. "products/2026-05-abc.png".
            url: Where the old site served it.

        Returns:
            None when stored, else the reason it was not.
        """
        try:
            body = fetch(url)
        except OSError as error:
            return f"download failed: {error}"
        kind = storage.file_type(body, storage.IMAGE_TYPES + storage.DOCUMENT_TYPES)
        if kind is None:
            return "not a picture or a PDF"
        with app.app_context():
            storage.put_object(key, body, kind[1])
        return None

    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = dict(zip(todo, pool.map(lambda item: copy(*item), todo.items())))
    failed = {key: reason for key, reason in results.items() if reason}
    return len(todo) - len(failed), len(manifest) - len(todo), failed


@click.command("import-media")
@click.option("--manifest", "manifest_path", type=click.Path(exists=True, dir_okay=False, path_type=Path), default=MANIFEST,
              help="The JSON list of object key -> source URL (default: frontend/src/stubs/legacy-media.json).")
def import_media_command(manifest_path: Path) -> None:
    """Copies the old WordPress site's files (product photos, the PDF catalog) into the file storage (see
    import_media); exits with status 1 when any file failed.

    Args:
        manifest_path: The manifest file.
    """
    stored, skipped, failed = import_media(read_json(manifest_path))
    click.echo(f"Stored {stored} files, {skipped} were already there, {len(failed)} failed.")
    for key, reason in sorted(failed.items()):
        click.echo(f"  {key}: {reason}", err=True)
    if failed:
        raise click.exceptions.Exit(1)
