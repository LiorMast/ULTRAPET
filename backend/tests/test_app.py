"""test_app.py — The application factory, the health endpoint and the JSON shape of HTTP errors."""
import pytest

from app import create_app


def test_health_reports_ok_when_the_database_answers(app, database):
    response = app.test_client().get("/api/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_http_errors_answer_json(client):
    assert client.get("/api/no-such-route").get_json() == {"error": "not_found"}
    response = client.delete("/api/brands")
    assert (response.status_code, response.get_json()) == (405, {"error": "method_not_allowed"})


def test_the_app_needs_a_secret_key(app, monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        create_app({"SQLALCHEMY_DATABASE_URI": app.config["SQLALCHEMY_DATABASE_URI"]})
