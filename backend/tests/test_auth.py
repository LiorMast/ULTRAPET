"""test_auth.py — JWT sign-in (app/auth.py) through the shared /api/auth routes (customers and staff).

Cookies and their flags, "remember me", wrong credentials, expiry and refresh, the CSRF double-submit check,
deactivated users, tokens of the wrong user type, tampered tokens and sign-out.
"""
from datetime import timedelta

import pytest
from flask_jwt_extended import create_access_token

from tests.conftest import CUSTOMER, STAFF


def set_cookies(response) -> dict[str, str]:
    """Collects the Set-Cookie headers of a response by cookie name.

    Args:
        response: A test-client response.

    Returns:
        Cookie name -> its full Set-Cookie header.
    """
    return {header.split("=", 1)[0]: header for header in response.headers.getlist("Set-Cookie")}


def test_login_sets_httponly_jwt_cookies_and_readable_csrf_cookies(client, customer):
    response = client.post("/api/auth/login", json=CUSTOMER)
    assert response.status_code == 200
    assert response.get_json() == {
        "user": {"kind": "business", "email": CUSTOMER["email"], "fullName": "Dana Cohen", "companyName": "Pet Corner"}
    }
    cookies = set_cookies(response)
    for name in ("access_token_cookie", "refresh_token_cookie"):
        assert "HttpOnly" in cookies[name] and "Path=/api/" in cookies[name] and "SameSite=Lax" in cookies[name]
    for name in ("csrf_access_token", "csrf_refresh_token"):
        assert "HttpOnly" not in cookies[name]
    # Without "remember me" they end with the browser session.
    assert not any("Max-Age" in header for header in cookies.values())


def test_remember_me_keeps_the_cookies_for_30_days(client, customer):
    cookies = set_cookies(client.post("/api/auth/login", json={**CUSTOMER, "remember": True}))
    assert all(f"Max-Age={30 * 24 * 3600}" in header for header in cookies.values())


def test_login_records_the_time(client, customer, database):
    assert customer.last_login_at is None
    client.post("/api/auth/login", json={**CUSTOMER, "email": " Shop@Example.com "})
    database.refresh(customer)
    assert customer.last_login_at is not None


@pytest.mark.parametrize(
    "credentials",
    [
        {**CUSTOMER, "password": "wrong-password"},
        {**CUSTOMER, "email": "nobody@example.com"},
    ],
)
def test_wrong_credentials_are_refused(client, customer, credentials):
    response = client.post("/api/auth/login", json=credentials)
    assert (response.status_code, response.get_json()) == (401, {"error": "invalid_credentials"})
    assert "Set-Cookie" not in response.headers


def test_staff_sign_in_here_and_an_inactive_staff_user_is_refused(client, staff, database):
    response = client.post("/api/auth/login", json=STAFF)
    assert response.status_code == 200
    assert response.get_json()["user"] == {
        "kind": "staff", "email": STAFF["email"], "fullName": "Office Admin", "companyName": None
    }
    staff.is_active = False
    database.commit()
    assert client.post("/api/auth/login", json=STAFF).status_code == 401


def test_login_needs_a_json_body_with_email_and_password(client):
    assert client.post("/api/auth/login", data="email=a&password=b").status_code == 415
    assert client.post("/api/auth/login", json={"email": "a@b.co"}).status_code == 400


def test_me_tells_who_is_signed_in(client, customer_client):
    assert customer_client.get("/api/auth/me").get_json()["user"]["companyName"] == "Pet Corner"


def test_me_without_a_token_is_unauthorized(client):
    response = client.get("/api/auth/me")
    assert (response.status_code, response.get_json()) == (401, {"error": "unauthorized"})


def test_an_expired_access_token_is_refreshed(app, customer_client, customer, csrf):
    with app.app_context():
        expired = create_access_token(
            str(customer.id), additional_claims={"user_type": "business"}, expires_delta=timedelta(seconds=-1)
        )
    customer_client.set_cookie("access_token_cookie", expired, path="/api/")
    response = customer_client.get("/api/auth/me")
    assert (response.status_code, response.get_json()) == (401, {"error": "token_expired"})

    response = customer_client.post("/api/auth/refresh", headers=csrf(customer_client, refresh=True))
    assert response.status_code == 204
    assert "access_token_cookie" in set_cookies(response)
    assert customer_client.get("/api/auth/me").status_code == 200


def test_refresh_keeps_remember_me(client, customer, csrf):
    client.post("/api/auth/login", json={**CUSTOMER, "remember": True})
    response = client.post("/api/auth/refresh", headers=csrf(client, refresh=True))
    assert "Max-Age" in set_cookies(response)["access_token_cookie"]


def test_refresh_needs_the_csrf_header_and_a_refresh_token(client, customer_client, csrf):
    response = customer_client.post("/api/auth/refresh")
    assert (response.status_code, response.get_json()) == (401, {"error": "csrf"})
    customer_client.delete_cookie("refresh_token_cookie", path="/api/")
    assert customer_client.post("/api/auth/refresh", headers=csrf(customer_client, refresh=True)).status_code == 401


def test_a_post_with_a_token_needs_the_csrf_header(staff_client, csrf):
    brand = {"slug": "new-brand", "name": "New Brand"}
    response = staff_client.post("/api/staff/brands", json=brand)
    assert (response.status_code, response.get_json()) == (401, {"error": "csrf"})
    assert staff_client.post("/api/staff/brands", json=brand, headers=csrf(staff_client)).status_code == 201


def test_a_deactivated_user_loses_access_at_once(customer_client, customer, database):
    customer.is_active = False
    database.commit()
    response = customer_client.get("/api/auth/me")
    assert (response.status_code, response.get_json()) == (401, {"error": "unauthorized"})


def test_a_token_only_opens_its_own_user_type(customer_client, client, staff, csrf):
    assert customer_client.get("/api/staff/brands").status_code == 403
    client.post("/api/auth/login", json=STAFF)  # the same browser signs in as staff instead
    assert client.get("/api/prices").status_code == 403
    assert client.get("/api/staff/brands").status_code == 200
    assert client.get("/api/auth/me").get_json()["user"]["kind"] == "staff"


def test_a_staff_session_is_refreshed_too(client, staff, csrf):
    client.post("/api/auth/login", json=STAFF)
    assert client.post("/api/auth/refresh", headers=csrf(client, refresh=True)).status_code == 204
    assert client.get("/api/staff/brands").status_code == 200


def test_a_tampered_token_is_invalid(customer_client):
    token = customer_client.get_cookie("access_token_cookie", path="/api/").value
    customer_client.set_cookie("access_token_cookie", token[:-4] + "AAAA", path="/api/")
    response = customer_client.get("/api/auth/me")
    assert (response.status_code, response.get_json()) == (401, {"error": "invalid_token"})


def test_logout_clears_the_cookies(customer_client):
    response = customer_client.post("/api/auth/logout")
    assert response.status_code == 204
    assert all("Expires=Thu, 01 Jan 1970" in header for header in set_cookies(response).values())
    assert customer_client.get("/api/auth/me").status_code == 401
