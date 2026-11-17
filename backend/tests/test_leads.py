"""test_leads.py — Requests for a business account: the public form's endpoint (POST /api/leads, with the email to
staff), the staff side (the `leads` resource) and opening the account from a request (POST
/api/staff/leads/<id>/convert).
"""
import uuid

import pytest

from app.database.models.settings import Setting
from app.database.models.users import BusinessLead, BusinessUser

REQUEST = {
    "companyName": "Happy Paws",
    "contactPerson": "Noa Levi",
    "phone": "052-123-4567",
    "email": "Noa@HappyPaws.co.il",
    "city": "Haifa",
    "message": "We run two stores.",
    "locale": "en",
    "website": "",
}


@pytest.fixture
def staff_api(staff_client, csrf):
    """Calls the staff API as the signed-in staff user, with the CSRF header on every change.

    Args:
        staff_client: The signed-in client.
        csrf: Builds the CSRF header.

    Returns:
        A function (method, path, json=None) -> the response; path is relative to /api/staff.
    """

    def call(method: str, path: str, json=None):
        """Sends one request.

        Args:
            method: The HTTP method.
            path: E.g. "/leads".
            json: The request body, if any.

        Returns:
            The response.
        """
        headers = csrf(staff_client) if method != "GET" else {}
        return staff_client.open(f"/api/staff{path}", method=method, json=json, headers=headers)

    return call


@pytest.fixture
def lead(database) -> BusinessLead:
    """A new request for an account.

    Args:
        database: The test database session.

    Returns:
        The saved request.
    """
    row = BusinessLead(company_name="Happy Paws", contact_person="Noa Levi", phone="0521234567", email="noa@happypaws.co.il", city="Haifa")
    database.add(row)
    database.commit()
    return row


def test_a_request_is_stored_and_staff_are_emailed(client, database, outbox):
    database.add(Setting(key="contact_email", value="office@ultrapet.co.il"))
    database.commit()
    response = client.post("/api/leads", json=REQUEST)
    assert (response.status_code, response.get_json()) == (201, {"ok": True})

    lead = database.query(BusinessLead).one()
    assert (lead.company_name, lead.email, lead.locale, lead.status, lead.message) == (
        "Happy Paws", "noa@happypaws.co.il", "en", "new", "We run two stores.",
    )
    [mail] = outbox
    assert mail["To"] == "office@ultrapet.co.il" and mail["Reply-To"] == "noa@happypaws.co.il"
    assert "Happy Paws" in mail["Subject"]
    body = mail.get_content()
    assert "Noa Levi" in body and "052-123-4567" in body and "/admin/requests" in body


def test_staff_recipients_come_from_the_config_first(app, client, database, outbox):
    app.config["LEADS_NOTIFY_TO"] = "sales@ultrapet.co.il, boss@ultrapet.co.il"
    try:
        client.post("/api/leads", json=REQUEST)
    finally:
        app.config["LEADS_NOTIFY_TO"] = ""
    assert outbox[0]["To"] == "sales@ultrapet.co.il, boss@ultrapet.co.il"


@pytest.mark.parametrize(
    ("change", "error", "field"),
    [
        ({"companyName": "  "}, "required", "companyName"),
        ({"city": None}, "required", "city"),
        ({"email": "not-an-email"}, "invalid", "email"),
        ({"phone": "12-34"}, "invalid", "phone"),
        ({"phone": "call me"}, "invalid", "phone"),
        ({"contactPerson": "x" * 201}, "invalid", "contactPerson"),
        ({"message": "x" * 2001}, "invalid", "message"),
        ({"locale": "fr"}, "invalid", "locale"),
        ({"companyName": 7}, "invalid", "companyName"),
    ],
)
def test_a_request_with_a_bad_field_is_refused(client, database, outbox, change, error, field):
    response = client.post("/api/leads", json={**REQUEST, **change})
    assert (response.status_code, response.get_json()) == (400, {"error": error, "field": field})
    assert database.query(BusinessLead).count() == 0 and outbox == []


def test_the_message_is_optional(client, database):
    assert client.post("/api/leads", json={**REQUEST, "message": "  "}).status_code == 201
    assert database.query(BusinessLead).one().message is None


def test_a_filled_honeypot_stores_nothing_but_looks_accepted(client, database, outbox):
    response = client.post("/api/leads", json={**REQUEST, "website": "https://spam.example"})
    assert (response.status_code, response.get_json()) == (201, {"ok": True})
    assert database.query(BusinessLead).count() == 0 and outbox == []


def test_staff_list_follow_up_and_delete_requests(staff_api, lead):
    [row] = staff_api("GET", "/leads").get_json()
    assert {k: row[k] for k in ("companyName", "contactPerson", "email", "city", "status", "notes", "businessUserId")} == {
        "companyName": "Happy Paws", "contactPerson": "Noa Levi", "email": "noa@happypaws.co.il", "city": "Haifa",
        "status": "new", "notes": None, "businessUserId": None,
    }
    changed = staff_api("PATCH", f"/leads/{lead.id}", {"status": "contacted", "notes": "Call back Sunday"}).get_json()
    assert (changed["status"], changed["notes"]) == ("contacted", "Call back Sunday")
    assert staff_api("PATCH", f"/leads/{lead.id}", {"status": "maybe"}).status_code == 400
    assert staff_api("PATCH", f"/leads/{lead.id}", {"companyName": "Other"}).get_json() == {"error": "unknown_field", "field": "companyName"}
    assert staff_api("POST", "/leads", {"status": "new"}).status_code == 405
    assert staff_api("DELETE", f"/leads/{lead.id}").status_code == 204
    assert staff_api("GET", "/leads").get_json() == []


def test_staff_open_the_account_from_a_request(staff_api, lead, database, client):
    fields = {"companyName": "Happy Paws Ltd", "fullName": "Noa Levi", "email": "noa@happypaws.co.il", "password": "s3cret-pass", "city": "Haifa"}
    response = staff_api("POST", f"/leads/{lead.id}/convert", fields)
    assert response.status_code == 201
    customer = response.get_json()
    assert (customer["companyName"], customer["isActive"]) == ("Happy Paws Ltd", True) and "password" not in customer

    [row] = staff_api("GET", "/leads").get_json()
    assert (row["status"], row["businessUserId"]) == ("converted", customer["id"])
    assert staff_api("POST", f"/leads/{lead.id}/convert", {**fields, "email": "other@x.co"}).get_json() == {"error": "converted"}
    assert client.post("/api/auth/login", json={"email": "noa@happypaws.co.il", "password": "s3cret-pass"}).status_code == 200


def test_a_refused_account_leaves_the_request_as_it_was(staff_api, lead, customer, database):
    no_password = staff_api("POST", f"/leads/{lead.id}/convert", {"companyName": "X", "fullName": "Y", "email": "y@x.co"})
    assert no_password.get_json() == {"error": "required", "field": "password"}
    taken = staff_api("POST", f"/leads/{lead.id}/convert", {"companyName": "X", "fullName": "Y", "email": customer.email, "password": "s3cret-pass"})
    assert (taken.status_code, taken.get_json()["error"]) == (409, "duplicate")
    database.refresh(lead)
    assert (lead.status, lead.business_user_id) == ("new", None)
    assert database.query(BusinessUser).count() == 1
    assert staff_api("POST", f"/leads/{uuid.uuid4()}/convert", {}).status_code == 404


def test_customers_cannot_see_the_requests(customer_client, lead):
    assert customer_client.get("/api/staff/leads").status_code == 403
