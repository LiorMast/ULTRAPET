"""storage.py — A stub of the S3 file storage: every file the site serves that is not bundled with the frontend
(uploaded category pictures, the product photos and the PDF catalog moved from the WordPress site by
`flask import-media`, later brand logos) is kept on the local disk until the site has a real S3 bucket.

The database stores only an object's **key** (its path in the bucket, e.g. "categories/3f2a....webp"), never a URL:
responses build the URL with public_url / url_of, from the app config S3_BUCKET and S3_REGION (.env), so moving the
files to another bucket or region changes no rows. object_key turns a value staff submit (a key, or one of our own
URLs) back into a key and refuses anything else (another site's URL, "../x").

The interface is S3's: put an object under a key, delete it, and the object's public URL. Callers (the staff upload
route in app/staff/routes.py, `flask import-media` in app/database/legacy_media.py) use only these functions, so moving to S3 changes this module alone:
    put_object    -> boto3 `s3.put_object(Bucket=..., Key=key, Body=body, ContentType=content_type)`
    delete_object -> `s3.delete_object(Bucket=..., Key=key)`
    object_exists -> `s3.head_object(Bucket=..., Key=key)` (False on a 404)
    public_url    -> already builds the bucket's URL once S3_BUCKET and S3_REGION are set
    send_object   -> not needed any more (S3 serves the files); drop the /api/media route with it.
Until then leave S3_BUCKET / S3_REGION empty: the stub keeps the files on disk and they are served from /api/media/.

The stub writes `<MEDIA_ROOT>/<key>` (MEDIA_ROOT: app config, default backend/media, git-ignored) and the public
route GET /api/media/<key> (app/customers/routes.py) serves it. Keys are built by the server
(`<folder>/<UTC timestamp>_<random hex>.<ext>`, e.g. categories/20261106T132045Z_3f2a....webp, for an upload; the
imported files' keys are listed in frontend/src/stubs/legacy-media.json), never taken from a request, and every path
is checked to stay inside MEDIA_ROOT.

file_type recognizes a file by its first bytes (the upload route and the import accept only what it knows).
"""
import re
from collections.abc import Callable
from pathlib import Path

from flask import Response, abort, current_app, send_from_directory
from werkzeug.security import safe_join

# Where the stub's objects are served (the bucket's URL, for S3).
MEDIA_URL = "/api/media/"
# Object keys never change content (a new upload gets a new key), so browsers may cache them for a year.
CACHE_MAX_AGE = 365 * 24 * 60 * 60
# The media type the stub serves per extension (S3 keeps each object's ContentType; the stub reads it from the key,
# since the system's type table may not know newer formats such as WebP and AVIF).
MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".pdf": "application/pdf",
}
# The pictures the site stores, by their first bytes: (extension, media type, test). SVG is refused on purpose: it
# can carry scripts, and the files are served from our own origin.
IMAGE_TYPES: tuple[tuple[str, str, Callable[[bytes], bool]], ...] = (
    ("jpg", "image/jpeg", lambda head: head.startswith(b"\xff\xd8\xff")),
    ("png", "image/png", lambda head: head.startswith(b"\x89PNG\r\n\x1a\n")),
    ("webp", "image/webp", lambda head: head[:4] == b"RIFF" and head[8:12] == b"WEBP"),
    ("avif", "image/avif", lambda head: head[4:12] in (b"ftypavif", b"ftypavis")),
)
# The documents the site stores (the PDF catalog), the same way.
DOCUMENT_TYPES: tuple[tuple[str, str, Callable[[bytes], bool]], ...] = (
    ("pdf", "application/pdf", lambda head: head.startswith(b"%PDF-")),
)
# The shape of an object key: "<folder>/<name>.<ext>" (the upload route builds "<folder>/<UTC timestamp>_<uuid>.<ext>"). No scheme, no leading slash, no
# "..", so a stored key can never point at another site or outside the bucket.
KEY_PATTERN = re.compile(r"[a-z0-9-]+/[A-Za-z0-9_-]+\.[a-z0-9]+")


def file_type(body: bytes, types: tuple[tuple[str, str, Callable[[bytes], bool]], ...] = IMAGE_TYPES) -> tuple[str, str] | None:
    """Recognizes a file by its first bytes (what the file is, whatever its name or the browser claims).

    Args:
        body: The file's bytes.
        types: The kinds accepted: IMAGE_TYPES (default: JPEG, PNG, WebP, AVIF), or IMAGE_TYPES + DOCUMENT_TYPES.

    Returns:
        (extension, media type), e.g. ("png", "image/png"); None for anything else.
    """
    return next(((extension, media) for extension, media, test in types if test(body[:16])), None)


def object_path(key: str) -> Path:
    """The file that holds an object.

    Args:
        key: The object key, e.g. "categories/3f2a....webp".

    Returns:
        The path under MEDIA_ROOT.

    Raises:
        404 when the key would point outside MEDIA_ROOT (e.g. "../x").
    """
    path = safe_join(str(current_app.config["MEDIA_ROOT"]), key)
    if path is None:
        abort(404)
    return Path(path)


def base_url() -> str:
    """The URL the object keys are appended to.

    Returns:
        "https://<S3_BUCKET>.s3.<S3_REGION>.amazonaws.com/" when both are configured, else the stub's "/api/media/".
    """
    bucket, region = current_app.config.get("S3_BUCKET"), current_app.config.get("S3_REGION")
    return f"https://{bucket}.s3.{region}.amazonaws.com/" if bucket and region else MEDIA_URL


def public_url(key: str) -> str:
    """The URL browsers load an object from.

    Args:
        key: The object key, e.g. "categories/3f2a....webp".

    Returns:
        The bucket's URL of the key (see base_url), e.g. "/api/media/categories/3f2a....webp" in dev.
    """
    return f"{base_url()}{key}"


def url_of(key: str | None) -> str | None:
    """The public URL of a key stored in a row (e.g. a category's image_url), for a response.

    Args:
        key: The stored object key, or None (no picture).

    Returns:
        The URL (public_url), or None.
    """
    return public_url(key) if key else None


def srcset_urls(srcset: str | None) -> str | None:
    """The HTML srcset of a stored one, whose entries name object keys ("products/a-300x300.jpg 300w, ...").

    Args:
        srcset: The stored srcset, or None.

    Returns:
        The same entries with each key turned into its URL (public_url), or None.
    """
    if not srcset:
        return srcset
    entries = (entry.strip().split(maxsplit=1) for entry in srcset.split(",") if entry.strip())
    return ", ".join(" ".join([public_url(parts[0]), *parts[1:]]) for parts in entries)


def object_key(value: str) -> str:
    """Turns a picture value staff submit (an object key, or a URL of one of our objects) into the key to store.

    Args:
        value: The key ("categories/3f2a.png") or our URL of it ("/api/media/categories/3f2a.png", or the bucket's
            https URL once S3 is configured).

    Returns:
        The key.

    Raises:
        ValueError: The value is not one of our objects (another site's URL, a path with "..", ...).
    """
    for base in (base_url(), MEDIA_URL):
        if value.startswith(base):
            value = value[len(base):]
            break
    if not KEY_PATTERN.fullmatch(value):
        raise ValueError(f"not an object key: {value!r}")
    return value


def put_object(key: str, body: bytes, content_type: str) -> str:
    """Stores an object (S3 PutObject), replacing any object with the same key.

    Args:
        key: The object key, e.g. "categories/3f2a....png".
        body: The file's bytes.
        content_type: Its media type, e.g. "image/png" (the stub serves files by their extension, MEDIA_TYPES, which
            matches the type the upload route chose).

    Returns:
        The object's public URL.
    """
    path = object_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return public_url(key)


def object_exists(key: str) -> bool:
    """Whether an object is stored under a key (S3 HeadObject).

    Args:
        key: The object key.

    Returns:
        True when the object exists.
    """
    return object_path(key).is_file()


def delete_object(key: str) -> None:
    """Deletes an object (S3 DeleteObject); like S3, deleting a missing key is not an error.

    Args:
        key: The object key.
    """
    object_path(key).unlink(missing_ok=True)


def send_object(key: str) -> Response:
    """Answers a request for an object (what S3 does for a public bucket).

    Args:
        key: The object key from the URL.

    Returns:
        The file, cached for a year and never type-sniffed; 404 when there is no such object.
    """
    mimetype = MEDIA_TYPES.get(Path(key).suffix.lower())
    response = send_from_directory(current_app.config["MEDIA_ROOT"], key, mimetype=mimetype, max_age=CACHE_MAX_AGE)
    response.cache_control.public = True
    response.cache_control.immutable = True
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
