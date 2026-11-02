"""app — The Ultra Pet backend: one Flask application (monolith) over PostgreSQL.

create_app() builds the application: configuration from the environment, the database (app.db), the CLI commands
(app.seed) and the routes. Modules: db (SQLAlchemy base), models/ (one module per area of the schema), pricing
(the customer's price), seed (dev database commands). The schema itself lives in backend/create-tables.sql.

Run: `flask --app app run --debug` (DATABASE_URL must point to the database; compose sets it and FLASK_APP).
"""
import os
from typing import Any

from flask import Flask
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app import models  # noqa: F401  (registers every model on db.metadata)
from app.db import db
from app.seed import reset_db_command, seed_command


def create_app(config: dict[str, Any] | None = None) -> Flask:
    """Builds the Flask application.

    Args:
        config: Settings that override the environment (tests pass their own database URL).

    Returns:
        The configured application.

    Raises:
        RuntimeError: No database URL is configured.
    """
    app = Flask(__name__)
    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=os.environ.get("DATABASE_URL"),
        SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True},
        SECRET_KEY=os.environ.get("SECRET_KEY"),
    )
    if config:
        app.config.update(config)
    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        raise RuntimeError("Set DATABASE_URL, e.g. postgresql+psycopg://content:<password>@localhost:5433/content")

    db.init_app(app)
    app.cli.add_command(reset_db_command)
    app.cli.add_command(seed_command)

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
