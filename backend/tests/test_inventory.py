"""test_inventory.py — Product stock (app/inventory.py): the stock status, the arithmetic of each movement kind, the
staff routes GET/POST /api/staff/products/<id>/stock (the ledger and the units on hand they keep in step), and the
stock status the signed-in customer gets from /api/prices.
"""
import uuid

import pytest

from app.database.models.catalog import Category, Product
from app.database.models.inventory import StockMovement
from app.inventory import HISTORY_LIMIT, StockError, apply_movement, stock_status


@pytest.fixture
def product(database):
    """An active, untracked product in a category of its own.

    Args:
        database: The test database session.

    Returns:
        The saved Product.
    """
    category = Category(slug="dogs", name={"he": "כלבים", "en": "Dogs"})
    item = Product(slug="beef-14kg", name={"he": "בקר", "en": "Beef"}, category=category)
    database.add(item)
    database.commit()
    return item


@pytest.fixture
def stock(staff_client, csrf):
    """Calls the stock routes of one product as the signed-in staff user.

    Args:
        staff_client: The signed-in client.
        csrf: Builds the CSRF header.

    Returns:
        A function (product_id, body=None) -> the response: GET without a body, POST with one.
    """

    def call(product_id, body=None):
        """Sends one request.

        Args:
            product_id: The product's id (a UUID or any text).
            body: The movement to record; None = read the stock.

        Returns:
            The test-client response.
        """
        path = f"/api/staff/products/{product_id}/stock"
        if body is None:
            return staff_client.get(path)
        return staff_client.post(path, json=body, headers=csrf(staff_client))

    return call


@pytest.mark.parametrize(
    ("quantity", "threshold", "expected"),
    [(None, None, None), (None, 5, None), (0, None, "out"), (0, 5, "out"), (3, None, "in"), (5, 5, "low"), (6, 5, "in")],
)
def test_stock_status(quantity, threshold, expected):
    assert stock_status(quantity, threshold) == expected


@pytest.mark.parametrize(
    ("current", "kind", "quantity", "expected"),
    [
        (10, "received", 5, (5, 15)),
        (10, "returned", 2, (2, 12)),
        (10, "removed", 10, (-10, 0)),
        (10, "count", 7, (-3, 7)),
        (10, "count", 10, (0, 10)),
        (None, "count", 0, (0, 0)),  # a count starts tracking, even at 0 units
        (None, "count", 12, (12, 12)),
    ],
)
def test_each_kind_changes_the_units_on_hand(current, kind, quantity, expected):
    assert apply_movement(current, kind, quantity) == expected


@pytest.mark.parametrize(
    ("current", "kind", "quantity", "code"),
    [
        (10, "received", 0, "invalid_quantity"),
        (10, "removed", -1, "invalid_quantity"),
        (10, "count", -1, "invalid_quantity"),
        (None, "received", 5, "untracked"),
        (None, "removed", 1, "untracked"),
        (3, "removed", 4, "insufficient_stock"),
    ],
)
def test_refused_movements(current, kind, quantity, code):
    with pytest.raises(StockError) as error:
        apply_movement(current, kind, quantity)
    assert error.value.code == code


def test_the_stock_routes_need_a_staff_sign_in(client, product):
    assert client.get(f"/api/staff/products/{product.id}/stock").status_code == 401
    assert client.post(f"/api/staff/products/{product.id}/stock", json={"kind": "count", "quantity": 1}).status_code == 401


def test_customers_cannot_reach_the_stock_routes(customer_client, product):
    assert customer_client.get(f"/api/staff/products/{product.id}/stock").status_code == 403


def test_a_new_product_is_untracked(stock, product):
    assert stock(product.id).get_json() == {
        "stockQuantity": None, "lowStockThreshold": None, "status": None, "movementCount": 0, "movements": [],
    }


def test_unknown_products_are_not_found(stock, product):
    assert stock(uuid.uuid4()).status_code == 404
    assert stock("not-a-uuid").status_code == 404
    assert stock(uuid.uuid4(), {"kind": "count", "quantity": 1}).status_code == 404


def test_movements_keep_the_units_on_hand_and_the_history(stock, product, database):
    assert stock(product.id, {"kind": "received", "quantity": 5}).get_json() == {"error": "untracked"}

    started = stock(product.id, {"kind": "count", "quantity": 10, "note": "  first count  "})
    assert started.status_code == 201
    assert (started.get_json()["stockQuantity"], started.get_json()["status"]) == (10, "in")

    stock(product.id, {"kind": "received", "quantity": 48, "note": "Invoice 5512"})
    stock(product.id, {"kind": "removed", "quantity": 3, "note": ""})
    data = stock(product.id, {"kind": "returned", "quantity": 1}).get_json()

    assert (data["stockQuantity"], data["movementCount"]) == (56, 4)
    # Newest first, signed by the staff member; a blank note is no note.
    assert [(m["kind"], m["quantityChange"], m["quantityAfter"], m["note"]) for m in data["movements"]] == [
        ("returned", 1, 56, None),
        ("removed", -3, 55, None),
        ("received", 48, 58, "Invoice 5512"),
        ("count", 10, 10, "first count"),
    ]
    assert {m["createdBy"] for m in data["movements"]} == {"Office Admin"}
    assert all(m["id"] and m["createdAt"] for m in data["movements"])

    database.expire_all()
    assert database.get(Product, product.id).stock_quantity == 56
    assert stock(product.id).get_json() == data


def test_removing_more_than_is_on_hand_changes_nothing(stock, product, database):
    stock(product.id, {"kind": "count", "quantity": 2})
    assert stock(product.id, {"kind": "removed", "quantity": 3}).get_json() == {"error": "insufficient_stock"}
    data = stock(product.id).get_json()
    assert (data["stockQuantity"], data["movementCount"]) == (2, 1)


@pytest.mark.parametrize(
    ("body", "error"),
    [
        ({"quantity": 1}, {"error": "required", "field": "kind"}),
        ({"kind": "order", "quantity": 1}, {"error": "invalid", "field": "kind"}),
        ({"kind": "count"}, {"error": "required", "field": "quantity"}),
        ({"kind": "count", "quantity": "3"}, {"error": "invalid", "field": "quantity"}),
        ({"kind": "count", "quantity": 2.5}, {"error": "invalid", "field": "quantity"}),
        ({"kind": "count", "quantity": True}, {"error": "invalid", "field": "quantity"}),
        ({"kind": "count", "quantity": -1}, {"error": "invalid", "field": "quantity"}),
        ({"kind": "count", "quantity": 1, "note": 5}, {"error": "invalid", "field": "note"}),
        ({"kind": "count", "quantity": 1, "staff": "me"}, {"error": "unknown_field", "field": "staff"}),
    ],
)
def test_a_movement_is_checked(stock, product, body, error):
    response = stock(product.id, body)
    assert (response.status_code, response.get_json()) == (400, error)
    assert stock(product.id).get_json()["movementCount"] == 0


def test_a_movement_needs_a_json_object(stock, product):
    assert stock(product.id, [1]).get_json() == {"error": "invalid_body"}


def test_the_history_shows_the_latest_movements(stock, product):
    for quantity in range(HISTORY_LIMIT + 2):
        stock(product.id, {"kind": "count", "quantity": quantity})
    data = stock(product.id).get_json()
    assert (data["movementCount"], len(data["movements"])) == (HISTORY_LIMIT + 2, HISTORY_LIMIT)
    assert data["movements"][0]["quantityAfter"] == HISTORY_LIMIT + 1


def test_the_products_resource_answers_the_stock_but_never_takes_it(staff_client, csrf, stock, product):
    stock(product.id, {"kind": "count", "quantity": 4})
    path = f"/api/staff/products/{product.id}"
    row = staff_client.get(path).get_json()
    assert (row["stockQuantity"], row["lowStockThreshold"]) == (4, None)

    refused = staff_client.patch(path, json={"stockQuantity": 99}, headers=csrf(staff_client))
    assert refused.get_json() == {"error": "unknown_field", "field": "stockQuantity"}
    changed = staff_client.patch(path, json={"lowStockThreshold": 5}, headers=csrf(staff_client)).get_json()
    assert (changed["stockQuantity"], changed["lowStockThreshold"]) == (4, 5)
    assert stock(product.id).get_json()["status"] == "low"
    negative = staff_client.patch(path, json={"lowStockThreshold": -1}, headers=csrf(staff_client))
    assert negative.get_json() == {"error": "invalid", "constraint": "products_low_stock_threshold_check"}


def test_deleting_a_product_deletes_its_history(staff_client, csrf, stock, product, database):
    stock(product.id, {"kind": "count", "quantity": 4})
    assert staff_client.delete(f"/api/staff/products/{product.id}", headers=csrf(staff_client)).status_code == 204
    assert database.query(StockMovement).count() == 0


def test_customers_see_the_status_of_tracked_active_products(customer_client, product, database):
    category = product.category
    low = Product(slug="low", name={"he": "נמוך"}, category=category, stock_quantity=2, low_stock_threshold=5)
    out = Product(slug="out", name={"he": "אזל"}, category=category, stock_quantity=0)
    hidden = Product(slug="hidden", name={"he": "מוסתר"}, category=category, stock_quantity=0, is_active=False)
    plenty = Product(slug="plenty", name={"he": "הרבה"}, category=category, stock_quantity=50, low_stock_threshold=5)
    database.add_all([low, out, hidden, plenty])
    database.commit()

    # The untracked product and the inactive one are left out; never the units themselves.
    assert customer_client.get("/api/prices").get_json()["stock"] == {
        str(low.id): "low", str(out.id): "out", str(plenty.id): "in",
    }
