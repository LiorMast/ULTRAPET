"""storage.py — The file storage of every file the site serves that is not bundled with the frontend (uploaded
category, brand, Private Label and product pictures; the product photos and the PDF catalog moved from the WordPress
site by `flask import-media`; the generated PDF catalog). Two drivers share one interface, S3's:

    STORAGE_BACKEND=local (default)  LocalStorage: a stub that keeps the objects on the local disk, under MEDIA_ROOT
                                     (default backend/media, git-ignored), served by GET /api/media/<key>.
    STORAGE_BACKEND=s3               S3Storage (app/storage_s3.py): an S3 bucket through boto3 (S3_BUCKET, S3_REGION; S3_ENDPOINT_URL for an
                                     S3-compatible service; S3_PUBLIC_URL for a CDN or custom domain in front of it).

Callers (the staff upload route in app/staff/routes.py, `flask import-media` / `flask push-media` in
app/database/legacy_media.py, the PDF catalog builder in app/catalog_pdf.py) use only the module functions below
(put_object, get_object, object_exists, delete_object, public_url, ...), never a driver, so switching drivers is a
setting. `flask push-media` copies the stub's files into the bucket before the switch.

The database stores only an object's **key** (its path in the bucket, e.g. "categories/3f2a....webp"), never a URL:
responses build the URL with public_url / url_of from the driver's base URL ("/api/media/" for the stub, the bucket's
or S3_PUBLIC_URL for S3), so moving the files to another bucket, region or CDN changes no rows. object_key turns a
value staff submit (a key, or one of our own URLs) back into a key and refuses anything else (another site's URL,
"../x").

The bucket (S3): objects are public to read (a bucket policy allowing s3:GetObject on arn:aws:s3:::<bucket>/*; ACLs
stay disabled) and written by the server only. Credentials come from boto3's default chain: AWS_ACCESS_KEY_ID /
AWS_SECRET_ACCESS_KEY in the environment, or the instance's IAM role; the role needs s3:PutObject, s3:GetObject and
s3:DeleteObject on the objects (and s3:ListBucket on the bucket, so HeadObject answers 404 rather than 403 for a
missing key). Every object is written with its ContentType and a year-long immutable Cache-Control, since a key
never changes content (a new upload gets a new key). With S3, GET /api/media/<key> redirects to the bucket (old links
keep working).

Keys are built by the server (`<folder>/<UTC timestamp>_<random hex>.<ext>`, e.g.
categories/20261106T132045Z_3f2a....webp, for an upload; the imported files' keys are listed in
frontend/src/stubs/legacy-media.json), never taken from a request; the stub checks every path to stay inside
MEDIA_ROOT.

file_type recognizes a file by its first bytes (the upload route and the import accept only what it knows).
"""
import re
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any

from flask import Response, abort, current_app, redirect, send_from_directory
from werkzeug.security import safe_join

if TYPE_CHECKING:
    from app.storage_s3 import S3Storage

# Where the stub's objects are served (the bucket's URL, for S3).
MEDIA_URL = "/api/media/"
# Object keys never change content (a new upload gets a new key), so browsers may cache them for a year.
CACHE_MAX_AGE = 365 * 24 * 60 * 60
# The Cache-Control the S3 driver stores with every object (the stub's send_object answers the same).
CACHE_CONTROL = f"public, max-age={CACHE_MAX_AGE}, immutable"
# The drivers STORAGE_BACKEND may name.
BACKENDS = ("local", "s3")
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


class LocalStorage:
    """The stub driver: each object is the file `<root>/<key>` on the local disk."""

    def __init__(self, root: str) -> None:
        """Keeps the folder of the objects.

        Args:
            root: MEDIA_ROOT.
        """
        self.root = root

    def path(self, key: str) -> Path:
        """The file that holds an object.

        Args:
            key: The object key, e.g. "categories/3f2a....webp".

        Returns:
            The path under the root.

        Raises:
            404 when the key would point outside the root (e.g. "../x").
        """
        path = safe_join(self.root, key)
        if path is None:
            abort(404)
        return Path(path)

    def put(self, key: str, body: bytes, content_type: str) -> None:
        """Writes an object, replacing one with the same key.

        Args:
            key: The object key.
            body: The file's bytes.
            content_type: Its media type (unused: the stub serves files by their extension, MEDIA_TYPES).
        """
        path = self.path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)

    def get(self, key: str) -> bytes | None:
        """Reads an object.

        Args:
            key: The object key.

        Returns:
            Its bytes; None when there is no such object.
        """
        path = self.path(key)
        return path.read_bytes() if path.is_file() else None

    def exists(self, key: str) -> bool:
        """Whether an object exists.

        Args:
            key: The object key.

        Returns:
            True when it does.
        """
        return self.path(key).is_file()

    def delete(self, key: str) -> None:
        """Deletes an object; a missing one is not an error.

        Args:
            key: The object key.
        """
        self.path(key).unlink(missing_ok=True)


def check_config(config: Any) -> None:
    """Refuses a storage configuration that cannot work (called by create_app at start-up).

    Args:
        config: The app config (STORAGE_BACKEND, S3_BUCKET, S3_REGION).

    Raises:
        RuntimeError: STORAGE_BACKEND is unknown, or "s3" without S3_BUCKET and S3_REGION.
    """
    backend = config.get("STORAGE_BACKEND")
    if backend not in BACKENDS:
        raise RuntimeError(f"STORAGE_BACKEND must be one of {', '.join(BACKENDS)}, not {backend!r}")
    if backend == "s3" and not (config.get("S3_BUCKET") and config.get("S3_REGION")):
        raise RuntimeError("STORAGE_BACKEND=s3 needs S3_BUCKET and S3_REGION (see .env.example)")


def driver() -> "LocalStorage | S3Storage":
    """The current app's storage driver, made once per settings (a test that changes them gets a new one).

    Returns:
        LocalStorage or S3Storage, by STORAGE_BACKEND.
    """
    config = current_app.config
    settings = (
        config.get("STORAGE_BACKEND", "local"),
        str(config.get("MEDIA_ROOT", "")),
        config.get("S3_BUCKET", ""),
        config.get("S3_REGION", ""),
        config.get("S3_ENDPOINT_URL", ""),
    )
    cached = current_app.extensions.get("storage")
    if cached is None or cached[0] != settings:
        backend, root, bucket, region, endpoint = settings
        if backend == "s3":
            from app.storage_s3 import S3Storage  # boto3 loads only when S3 is used

            cached = (settings, S3Storage(bucket, region, endpoint))
        else:
            cached = (settings, LocalStorage(root))
        current_app.extensions["storage"] = cached
    return cached[1]


def uses_s3() -> bool:
    """Whether the objects are in an S3 bucket.

    Returns:
        True when STORAGE_BACKEND is "s3".
    """
    return current_app.config.get("STORAGE_BACKEND", "local") == "s3"


def base_url() -> str:
    """The URL the object keys are appended to.

    Returns:
        With S3: S3_PUBLIC_URL (with a trailing "/") when set, else "https://<S3_BUCKET>.s3.<S3_REGION>.amazonaws.com/".
        With the stub: "/api/media/".
    """
    if not uses_s3():
        return MEDIA_URL
    config = current_app.config
    public = config.get("S3_PUBLIC_URL")
    if public:
        return public.rstrip("/") + "/"
    return f"https://{config['S3_BUCKET']}.s3.{config['S3_REGION']}.amazonaws.com/"


def public_url(key: str) -> str:
    """The URL browsers load an object from.

    Args:
        key: The object key, e.g. "categories/3f2a....webp".

    Returns:
        The key appended to base_url, e.g. "/api/media/categories/3f2a....webp" in dev.
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
        value: The key ("categories/3f2a.png") or our URL of it (base_url's, or the stub's "/api/media/...", which
            keeps redirecting to the bucket under S3).

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
        content_type: Its media type, e.g. "image/png".

    Returns:
        The object's public URL.
    """
    driver().put(key, body, content_type)
    return public_url(key)


def object_exists(key: str) -> bool:
    """Whether an object is stored under a key (S3 HeadObject).

    Args:
        key: The object key.

    Returns:
        True when the object exists.
    """
    return driver().exists(key)


def get_object(key: str) -> bytes | None:
    """Reads an object's bytes (S3 GetObject), e.g. a product photo for the PDF catalog (app/catalog_pdf.py).

    Args:
        key: The object key.

    Returns:
        The file's bytes; None when there is no such object.
    """
    return driver().get(key)


def delete_object(key: str) -> None:
    """Deletes an object (S3 DeleteObject); like S3, deleting a missing key is not an error.

    Args:
        key: The object key.
    """
    driver().delete(key)


def send_object(key: str) -> Response:
    """Answers GET /api/media/<key>: the stub serves the file (what S3 does for a public bucket); with S3 the request
    is redirected to the object's bucket URL, so links saved before the switch keep working.

    Args:
        key: The object key from the URL.

    Returns:
        The file, cached for a year and never type-sniffed, or a 301 to the bucket; 404 when there is no such object
        (the stub) or the key is not a valid key (S3).
    """
    if uses_s3():
        if not KEY_PATTERN.fullmatch(key):
            abort(404)
        return redirect(public_url(key), 301)
    mimetype = MEDIA_TYPES.get(Path(key).suffix.lower())
    response = send_from_directory(current_app.config["MEDIA_ROOT"], key, mimetype=mimetype, max_age=CACHE_MAX_AGE)
    response.cache_control.public = True
    response.cache_control.immutable = True
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
