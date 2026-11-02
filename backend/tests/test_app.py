"""test_app.py — The application factory and the health endpoint."""


def test_health_reports_ok_when_the_database_answers(app, database):
    response = app.test_client().get("/api/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}
