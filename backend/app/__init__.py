"""app — The Ultra Pet backend: one Flask application (monolith) over PostgreSQL.

create_app() builds the application: configuration from the environment, the database (app.database.db), JWT
sign-in (app.auth), the file storage settings (app.storage), the CLI commands (app.database.seed, app.database.legacy_media, app.catalog_pdf) and the routes. The routes are two blueprints, each in its
own folder: customers/ (prefix /api: everything the public site and the business customers call) and staff/
(prefix /api/staff: the staff panel API). Other modules: database/ (schema SQL, SQLAlchemy base, models, seed
commands), pricing (the customer's price), storage (the file storage: a local stub or an S3 bucket, storage_s3) and catalog_pdf (builds the
downloadable PDF catalog from the products).

Run: `flask --app app run --debug` (DATABASE_URL and SECRET_KEY must be set; compose sets them and FLASK_APP).
"""
import os
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from flask import Flask, Response, jsonify
from flask.json.provider import DefaultJSONProvider
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException

from app import storage
from app.auth import init_auth
from app.catalog_pdf import build_catalog_command
from app.customers.routes import bp as customers_bp
from app.database import models  # noqa: F401  (registers every model on db.metadata)
from app.database.db import db
from app.database.legacy_media import import_media_command, push_media_command
from app.database.seed import reset_db_command, seed_command
from app.database.wordpress import export_wordpress_command
from app.staff.routes import bp as staff_bp

# The largest request body Flask reads (uploads are refused above 5 MB by the upload route; this cap is the backstop
# against huge bodies, answered 413 "request_entity_too_large").
MAX_CONTENT_LENGTH = 6 * 1024 * 1024


def json_default(value: Any) -> Any:
    """Serializes the values the standard JSON encoder does not know.

    Args:
        value: A datetime, date, Decimal, UUID, ...

    Returns:
        ISO 8601 text for dates and times (Flask's default would be an HTTP date), a number for a Decimal
        (prices; the browser works in numbers anyway), and Flask's default for anything else (UUID -> text).
    """
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return DefaultJSONProvider.default(value)


class ApiJSONProvider(DefaultJSONProvider):
    """The app's JSON: ISO dates, numeric Decimals, keys in the order the code builds them, Hebrew unescaped."""

    default = staticmethod(json_default)
    sort_keys = False
    ensure_ascii = False


def http_error(error: HTTPException) -> tuple[Response, int]:
    """Answers an HTTP error (404, 405, 415, aborts, ...) with JSON instead of Flask's HTML page.

    Args:
        error: The raised HTTP exception.

    Returns:
        {"error": "<name>"} in snake case (e.g. "not_found") with the error's status.
    """
    name = re.sub(r"\W+", "_", (error.name or "error").lower()).strip("_")
    return jsonify(error=name), error.code or 500


def create_app(config: dict[str, Any] | None = None) -> Flask:
    """Builds the Flask application.

    Args:
        config: Settings that override the environment (tests pass their own database URL, secret and media folder).

    Returns:
        The configured application.

    Raises:
        RuntimeError: No database URL or no secret key is configured, or the file storage settings cannot work
            (storage.check_config).
    """
    app = Flask(__name__)
    app.json = ApiJSONProvider(app)
    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=os.environ.get("DATABASE_URL"),
        SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True},
        SECRET_KEY=os.environ.get("SECRET_KEY"),
        SITE_URL=os.environ.get("SITE_URL", "https://www.ultrapet.co.il"),
        # Where the stored files live (app/storage.py): "local" (the stub: files under MEDIA_ROOT, served at
        # /api/media/) or "s3" (the bucket S3_BUCKET in S3_REGION; credentials from boto3's chain, e.g. AWS_* env vars).
        STORAGE_BACKEND=os.environ.get("STORAGE_BACKEND", "") or "local",
        # The stub's folder: backend/media, git-ignored, inside compose's bind mount.
        MEDIA_ROOT=os.environ.get("MEDIA_ROOT", os.path.join(os.path.dirname(os.path.dirname(__file__)), "media")),
        # The S3 bucket and its region (used when STORAGE_BACKEND=s3: the objects and their URLs).
        S3_BUCKET=os.environ.get("S3_BUCKET", ""),
        S3_REGION=os.environ.get("S3_REGION", ""),
        # Optional: the endpoint of an S3-compatible service (empty = AWS), and the public base URL of the objects
        # when a CDN or custom domain serves the bucket (empty = https://<bucket>.s3.<region>.amazonaws.com/).
        S3_ENDPOINT_URL=os.environ.get("S3_ENDPOINT_URL", ""),
        S3_PUBLIC_URL=os.environ.get("S3_PUBLIC_URL", ""),
        # How a change to the catalog rebuilds the PDF catalog (app/catalog_pdf.py): "thread" (in the background),
        # "inline" (before the request answers) or "off".
        CATALOG_REBUILD=os.environ.get("CATALOG_REBUILD", "thread"),
        # Email (app/mailer.py): MAIL_BACKEND "smtp" / "log" / "memory" / "off" (empty = smtp when SMTP_HOST is set,
        # else log); the SMTP server and its sign-in; the sender; who gets the staff notifications (comma separated;
        # empty = the contact_email setting).
        MAIL_BACKEND=os.environ.get("MAIL_BACKEND", ""),
        SMTP_HOST=os.environ.get("SMTP_HOST", ""),
        SMTP_PORT=int(os.environ.get("SMTP_PORT", "") or 587),
        SMTP_USER=os.environ.get("SMTP_USER", ""),
        SMTP_PASSWORD=os.environ.get("SMTP_PASSWORD", ""),
        SMTP_TLS=os.environ.get("SMTP_TLS", "true").lower() in ("1", "true", "yes"),
        MAIL_FROM=os.environ.get("MAIL_FROM", ""),
        LEADS_NOTIFY_TO=os.environ.get("LEADS_NOTIFY_TO", ""),
        MAX_CONTENT_LENGTH=MAX_CONTENT_LENGTH,
    )
    if config:
        app.config.update(config)
    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        raise RuntimeError("Set DATABASE_URL, e.g. postgresql+psycopg://content:<password>@localhost:5433/content")
    if not app.config["SECRET_KEY"]:
        raise RuntimeError("Set SECRET_KEY (it signs the sign-in tokens); see .env.example")
    storage.check_config(app.config)

    db.init_app(app)
    init_auth(app)
    app.cli.add_command(reset_db_command)
    app.cli.add_command(seed_command)
    app.cli.add_command(import_media_command)
    app.cli.add_command(push_media_command)
    app.cli.add_command(export_wordpress_command)
    app.cli.add_command(build_catalog_command)
    app.register_error_handler(HTTPException, http_error)
    app.register_blueprint(customers_bp)
    app.register_blueprint(staff_bp)

    @app.get("/api/health")
    def health() -> tuple[dict[str, str], int]:
        """Liveness check for compose, monitoring and the frontend dev proxy.

        Returns:
            {"status": "ok"} with 200 when the database answers, {"status": "error"} with 503 when it does not.
        """
        try:
            db.session.execute(text("SELECT 1"))
        except SQLAlchemyError:
            return {"status": "error"}, 503
        return {"status": "ok"}, 200

    return app
