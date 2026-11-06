"""storage.py — A stub of the S3 file storage: uploaded files (category pictures, later brand logos and product
photos) are kept on the local disk until the site has a real S3 bucket.

The interface is S3's: put an object under a key, delete it, and the object's public URL. Callers (the staff upload
route in app/staff/routes.py) use only these functions, so moving to S3 changes this module alone:
    put_object    -> boto3 `s3.put_object(Bucket=..., Key=key, Body=body, ContentType=content_type)`, returning the
                     bucket's (or CDN's) URL of the key
    delete_object -> `s3.delete_object(Bucket=..., Key=key)`
    public_url    -> f"https://<bucket or CDN host>/{key}"
    send_object   -> not needed any more (S3 serves the files); drop the /api/media route with it.

The stub writes `<MEDIA_ROOT>/<key>` (MEDIA_ROOT: app config, default backend/media, git-ignored) and the public
route GET /api/media/<key> (app/customers/routes.py) serves it. Keys are built by the server
(`<folder>/<random hex>.<ext>`), never taken from a request, and every path is checked to stay inside MEDIA_ROOT.
"""
from pathlib import Path

from flask import Response, abort, current_app, send_from_directory
from werkzeug.security import safe_join

# Where the stub's objects are served (the bucket's URL, for S3).
MEDIA_URL = "/api/media/"
# Object keys never change content (a new upload gets a new key), so browsers may cache them for a year.
CACHE_MAX_AGE = 365 * 24 * 60 * 60
# The media type the stub serves per extension (S3 keeps each object's ContentType; the stub reads it from the key,
# since the system's type table may not know newer formats such as WebP and AVIF).
MEDIA_TYPES = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif"}


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


def public_url(key: str) -> str:
    """The URL browsers load an object from.

    Args:
        key: The object key.

    Returns:
        "/api/media/<key>".
    """
    return f"{MEDIA_URL}{key}"


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
