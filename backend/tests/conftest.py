"""conftest.py — Shared pytest fixtures: a separate test database built from the SQL files, a clean slate per test,
and API clients signed in as a business customer or a staff user.

The tests never touch the development database: they use TEST_DATABASE_URL, or DATABASE_URL with the database
name `content_test`, created on first use. The schema is built once per run from drop-tables.sql +
create-tables.sql (the same way `flask reset-db` does), and every table is emptied after each database test.
Tests that need the database take the `database` fixture; the pure pricing tests do not. API tests take `client`
(signed out), `customer_client` or `staff_client` (signed in through the real login routes, so they hold the JWT
cookies), and `csrf` for the X-CSRF-TOKEN header that POST/PATCH/DELETE with a token need.
"""
import os
from collections.abc import Callable, Iterator

import psycopg
import pytest
from flask import Flask
from flask.testing import FlaskClient
from psycopg import sql
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import scoped_session

from app import create_app
from app.database.db import db
from app.database.models.users import BusinessUser, StaffUser
from app.database.seed import CREATE_TABLES_SQL, DROP_TABLES_SQL, run_sql_file

# The sign-in of the users the fixtures create.
CUSTOMER = {"email": "shop@example.com", "password": "customer-password"}
STAFF = {"email": "admin@ultrapet.co.il", "password": "staff-password"}


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
    application = create_app(
        {"SQLALCHEMY_DATABASE_URI": url, "SECRET_KEY": "test-secret-at-least-32-bytes-long", "TESTING": True}
    )
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


@pytest.fixture
def client(app: Flask, database: scoped_session) -> FlaskClient:
    """A signed-out API client (it keeps the cookies the responses set).

    Args:
        app: The application.
        database: The clean test database (emptied after the test).

    Returns:
        The Flask test client.
    """
    return app.test_client()


@pytest.fixture
def customer(database: scoped_session) -> BusinessUser:
    """An active business customer (credentials in CUSTOMER).

    Args:
        database: The test database session.

    Returns:
        The saved BusinessUser.
    """
    user = BusinessUser(email=CUSTOMER["email"], full_name="Dana Cohen", company_name="Pet Corner")
    user.set_password(CUSTOMER["password"])
    database.add(user)
    database.commit()
    return user


@pytest.fixture
def staff(database: scoped_session) -> StaffUser:
    """An active staff user (credentials in STAFF).

    Args:
        database: The test database session.

    Returns:
        The saved StaffUser.
    """
    user = StaffUser(email=STAFF["email"], full_name="Office Admin")
    user.set_password(STAFF["password"])
    database.add(user)
    database.commit()
    return user


@pytest.fixture
def customer_client(client: FlaskClient, customer: BusinessUser) -> FlaskClient:
    """An API client signed in as the business customer.

    Args:
        client: The client to sign in.
        customer: The customer it signs in as.

    Returns:
        The client, holding the customer's JWT cookies.
    """
    assert client.post("/api/auth/login", json=CUSTOMER).status_code == 200
    return client


@pytest.fixture
def staff_client(client: FlaskClient, staff: StaffUser) -> FlaskClient:
    """An API client signed in as the staff user.

    Args:
        client: The client to sign in.
        staff: The staff user it signs in as.

    Returns:
        The client, holding the staff user's JWT cookies.
    """
    assert client.post("/api/auth/login", json=STAFF).status_code == 200
    return client


@pytest.fixture
def csrf() -> Callable[..., dict[str, str]]:
    """Builds the CSRF header a client must send with POST/PATCH/DELETE that need a token.

    Returns:
        A function (client, refresh=False) -> {"X-CSRF-TOKEN": <the matching CSRF cookie>}.
    """

    def headers(client: FlaskClient, refresh: bool = False) -> dict[str, str]:
        """Reads the client's CSRF cookie.

        Args:
            client: A signed-in test client.
            refresh: True for the refresh token's CSRF cookie (the /auth/refresh routes).

        Returns:
            The header to send.
        """
        cookie = client.get_cookie("csrf_refresh_token" if refresh else "csrf_access_token")
        return {"X-CSRF-TOKEN": cookie.value if cookie else ""}

    return headers
