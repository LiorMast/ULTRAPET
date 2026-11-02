"""conftest.py — Shared pytest fixtures: a separate test database built from the SQL files, and a clean slate per test.

The tests never touch the development database: they use TEST_DATABASE_URL, or DATABASE_URL with the database
name `content_test`, created on first use. The schema is built once per run from drop-tables.sql +
create-tables.sql (the same way `flask reset-db` does), and every table is emptied after each database test.
Tests that need the database take the `database` fixture; the pure pricing tests do not.
"""
import os
from collections.abc import Iterator

import psycopg
import pytest
from flask import Flask
from psycopg import sql
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import scoped_session

from app import create_app
from app.database.db import db
from app.database.seed import CREATE_TABLES_SQL, DROP_TABLES_SQL, run_sql_file


def resolve_test_database_url() -> str:
    """Works out which database the tests use.

    Returns:
        TEST_DATABASE_URL when set, else DATABASE_URL pointed at the database `content_test`.
    """
    if url := os.environ.get("TEST_DATABASE_URL"):
        return url
    if not (url := os.environ.get("DATABASE_URL")):
        raise pytest.UsageError("Set DATABASE_URL or TEST_DATABASE_URL (compose sets DATABASE_URL in the backend).")
    return make_url(url).set(database="content_test").render_as_string(hide_password=False)


def ensure_database(url: str) -> None:
    """Creates the test database when it does not exist yet.

    Args:
        url: SQLAlchemy URL of the test database; its user must be allowed to create databases.
    """
    target = make_url(url)
    maintenance = target.set(drivername="postgresql", database="postgres").render_as_string(hide_password=False)
    with psycopg.connect(maintenance, autocommit=True) as connection:
        exists = connection.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target.database,)).fetchone()
        if not exists:
            connection.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(target.database)))


@pytest.fixture(scope="session")
def app() -> Flask:
    """The Flask app on a freshly built test database (once per test run).

    Returns:
        The application.
    """
    url = resolve_test_database_url()
    ensure_database(url)
    application = create_app({"SQLALCHEMY_DATABASE_URI": url, "TESTING": True})
    with application.app_context():
        run_sql_file(DROP_TABLES_SQL)
        run_sql_file(CREATE_TABLES_SQL)
    return application


@pytest.fixture
def database(app: Flask) -> Iterator[scoped_session]:
    """An app context and its database session; every table is emptied afterwards.

    Args:
        app: The session-wide application.

    Yields:
        db.session.
    """
    with app.app_context():
        yield db.session
        db.session.rollback()
        tables = ", ".join(table.name for table in db.metadata.sorted_tables)
        db.session.execute(text(f"TRUNCATE {tables}"))
        db.session.commit()
