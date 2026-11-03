"""auth.py — Sign-in with JSON Web Tokens (Flask-JWT-Extended), shared by the customers and staff blueprints.

A successful sign-in sets two JWTs as HttpOnly cookies, so page scripts never see them:
- an access token (15 minutes), sent with every /api request and checked by `require_user`;
- a refresh token (30 days), used only by the `/auth/refresh` routes to issue a new access token.
Each token's identity is the user's UUID and its `user_type` claim says `business` or `staff` (the library's own
`type` claim says access or refresh); the refresh token also carries `remember`. With "remember me" the cookies persist for 30 days, otherwise they end with the browser session.

CSRF: the cookies are SameSite=Lax, and Flask-JWT-Extended's double-submit check makes every POST/PATCH/PUT/DELETE
that needs a token also send the X-CSRF-TOKEN header, which the frontend copies from the readable `csrf_access_token`
(or `csrf_refresh_token`) cookie. A cross-site page cannot read that cookie, so it cannot forge the header.

Every protected request loads the user from the database (`load_user`), so deleting or deactivating a user cuts
them off at once. Errors answer 401 with {"error": "unauthorized" | "csrf" | "token_expired" | "invalid_token"};
the frontend refreshes and retries once on "token_expired".
"""
import os
import uuid
from datetime import timedelta
from typing import Any

from flask import Flask, Response, abort, jsonify, request
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    create_refresh_token,
    current_user,
    get_jwt,
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies,
    verify_jwt_in_request,
)
from sqlalchemy import func, select
from werkzeug.security import check_password_hash, generate_password_hash

from app.database.db import db
from app.database.models.users import AppUser, BusinessUser, StaffUser

ACCESS_LIFETIME = timedelta(minutes=15)
REFRESH_LIFETIME = timedelta(days=30)

# The user model of each `user_type` claim.
USER_TYPES: dict[str, type[AppUser]] = {"business": BusinessUser, "staff": StaffUser}

# Checked when the email is unknown, so a failed sign-in takes as long whether or not the account exists.
DUMMY_HASH = generate_password_hash("not-a-real-password")

jwt = JWTManager()


def init_auth(app: Flask) -> None:
    """Configures the JWT cookies on the app (unless the caller already set a value) and registers the loaders.

    Args:
        app: The application being built by create_app.
    """
    for key, value in {
        "JWT_TOKEN_LOCATION": ["cookies"],
        "JWT_ACCESS_TOKEN_EXPIRES": ACCESS_LIFETIME,
        "JWT_REFRESH_TOKEN_EXPIRES": REFRESH_LIFETIME,
        "JWT_COOKIE_SECURE": os.environ.get("JWT_COOKIE_SECURE", "").lower() in ("1", "true", "yes"),
        "JWT_COOKIE_SAMESITE": "Lax",
        "JWT_COOKIE_CSRF_PROTECT": True,
        "JWT_ACCESS_COOKIE_PATH": "/api/",
        "JWT_REFRESH_COOKIE_PATH": "/api/",
    }.items():
        app.config.setdefault(key, value)
    jwt.init_app(app)


def error_response(error: str, status: int = 401) -> tuple[Response, int]:
    """Builds the JSON error answer of a failed token check.

    Args:
        error: The error code the frontend looks at, e.g. "token_expired".
        status: The HTTP status.

    Returns:
        The response and its status.
    """
    return jsonify(error=error), status


@jwt.user_lookup_loader
def load_user(_header: dict[str, Any], payload: dict[str, Any]) -> AppUser | None:
    """Loads the signed-in user of a valid token (Flask-JWT-Extended calls it on every protected request).

    Args:
        _header: The token's header (unused).
        payload: The token's claims; `sub` is the user id and `user_type` the user type.

    Returns:
        The user, or None (the request is refused) when they are gone, inactive or of another type.
    """
    model = USER_TYPES.get(payload.get("user_type", ""))
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        return None
    user = db.session.get(AppUser, user_id) if model else None
    return user if model and isinstance(user, model) and user.is_active else None


@jwt.user_lookup_error_loader
def user_lookup_error(_header: dict[str, Any], _payload: dict[str, Any]) -> tuple[Response, int]:
    """Answers a valid token whose user no longer exists or was deactivated.

    Args:
        _header: The token's header (unused).
        _payload: The token's claims (unused).

    Returns:
        401 {"error": "unauthorized"}.
    """
    return error_response("unauthorized")


@jwt.unauthorized_loader
def unauthorized(reason: str) -> tuple[Response, int]:
    """Answers a request without a token, or without the matching CSRF header.

    Args:
        reason: The library's explanation, e.g. "Missing CSRF token".

    Returns:
        401 {"error": "csrf"} for a CSRF failure, else 401 {"error": "unauthorized"}.
    """
    return error_response("csrf" if "csrf" in reason.lower() else "unauthorized")


@jwt.expired_token_loader
def token_expired(_header: dict[str, Any], _payload: dict[str, Any]) -> tuple[Response, int]:
    """Answers an expired token; for an access token the frontend then refreshes and retries.

    Args:
        _header: The token's header (unused).
        _payload: The token's claims (unused).

    Returns:
        401 {"error": "token_expired"}.
    """
    return error_response("token_expired")


@jwt.invalid_token_loader
def invalid_token(_reason: str) -> tuple[Response, int]:
    """Answers a token that is malformed, wrongly signed or of the wrong kind (a refresh token used for access).

    Args:
        _reason: The library's explanation (not shown to the client).

    Returns:
        401 {"error": "invalid_token"}.
    """
    return error_response("invalid_token")


def read_credentials() -> tuple[str, str, bool]:
    """Reads a sign-in form from the JSON request body ({"email", "password", "remember"}).

    Returns:
        The email, the password and whether to remember the sign-in (only a JSON true counts).

    Raises:
        415 Unsupported Media Type for a non-JSON body (Flask), 400 Bad Request when email or password is not text.
    """
    data = request.get_json()
    if not isinstance(data, dict) or not isinstance(data.get("email"), str) or not isinstance(data.get("password"), str):
        abort(400)
    return data["email"], data["password"], data.get("remember") is True


def authenticate(model: type[AppUser], email: str, password: str) -> AppUser | None:
    """Checks a sign-in attempt and records the sign-in time when it succeeds.

    A password hash is always checked (the user's or a dummy one), so the time taken does not reveal whether the
    email exists.

    Args:
        model: The user type allowed to sign in here: BusinessUser or StaffUser.
        email: The typed email (any case, surrounding spaces ignored).
        password: The typed password.

    Returns:
        The user, or None when the email is unknown, the password is wrong, or the account is inactive or of the
        other type.
    """
    user = db.session.scalar(select(AppUser).where(AppUser.email == email.strip().lower()))
    password_ok = check_password_hash(user.password_hash if user else DUMMY_HASH, password)
    if user is None or not password_ok or not isinstance(user, model) or not user.is_active:
        return None
    user.last_login_at = func.now()
    db.session.commit()
    return user


def user_type(user: AppUser) -> str:
    """Names a user's type the way the tokens' `user_type` claim does.

    Args:
        user: A business or staff user.

    Returns:
        "business" or "staff".
    """
    return next(name for name, model in USER_TYPES.items() if isinstance(user, model))


def issue_tokens(response: Response, user: AppUser, remember: bool) -> Response:
    """Signs a user in: sets the access and refresh tokens (and their CSRF cookies) on the response.

    Args:
        response: The sign-in response.
        user: The authenticated user.
        remember: True = the cookies persist for 30 days; False = they end with the browser session.

    Returns:
        The same response.
    """
    claims = {"user_type": user_type(user)}
    max_age = int(REFRESH_LIFETIME.total_seconds()) if remember else None
    set_access_cookies(response, create_access_token(str(user.id), additional_claims=claims), max_age=max_age)
    refresh_claims = {**claims, "remember": remember}
    set_refresh_cookies(response, create_refresh_token(str(user.id), additional_claims=refresh_claims), max_age=max_age)
    return response


def refresh_access(response: Response, kind: str) -> Response:
    """Issues a new access token from the request's refresh token (and its CSRF header).

    Args:
        response: The refresh response.
        kind: The user type this route serves, "business" or "staff".

    Returns:
        The same response, with a new access cookie that persists like the original sign-in.
    """
    verify_jwt_in_request(refresh=True)
    claims = get_jwt()
    if claims.get("user_type") != kind:
        abort(403)
    max_age = int(REFRESH_LIFETIME.total_seconds()) if claims.get("remember") else None
    token = create_access_token(claims["sub"], additional_claims={"user_type": kind})
    set_access_cookies(response, token, max_age=max_age)
    return response


def clear_tokens(response: Response) -> Response:
    """Signs out: expires every JWT and CSRF cookie.

    Args:
        response: The sign-out response.

    Returns:
        The same response.
    """
    unset_jwt_cookies(response)
    return response


def require_user(kind: str) -> AppUser:
    """Requires a valid access token of one user type; aborts the request otherwise.

    Args:
        kind: "business" or "staff".

    Returns:
        The signed-in user (a BusinessUser or a StaffUser).

    Raises:
        The library's errors (answered 401 by the loaders above) without a valid token, or 403 Forbidden when the
        token belongs to the other user type.
    """
    verify_jwt_in_request()
    if get_jwt().get("user_type") != kind:
        abort(403)
    return current_user
