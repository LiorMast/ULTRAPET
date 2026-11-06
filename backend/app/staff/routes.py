"""routes.py — Blueprint `staff` (prefix /api/staff): the staff panel API.

Staff sign in through the shared /api/auth/* routes (blueprint `customers`; JWT cookies, see app/auth.py). Every
route here requires a signed-in staff user: 401 without a valid token, 403 with a customer's.

Create/read/update/delete of the catalog, its price rules (discounts) and the site content, one route set for every
resource in RESOURCES:
    GET /<resource>              every row, in display order
    POST /<resource>             create (201) from a JSON body of the resource's fields
    GET /<resource>/<key>        one row (key = the id; the key text for settings)
    PATCH /<resource>/<key>      change the fields in the body; the others stay as they are
    DELETE /<resource>/<key>     delete (204)
    PUT /<resource>              replace the whole list in one transaction (only resources edited as one ordered
                                 list: `faq-items`, see replace_rows)
JSON keys are camelCase (column `sort_order` -> `sortOrder`); a row also carries `id`, `createdAt`, `updatedAt`.
`page-sections` (the editable home page sections, keyed by the section name) and `faq-items` (the questions of the
home page FAQ) also record who made the last change (`updatedById`).
Uploads: POST /uploads stores a picture (multipart `file` + `folder`) in the file storage (app/storage.py, an S3
stub for now) and returns its URL, which the staff panel then saves in a row (e.g. a category's imageUrl).
Each field checks its JSON type here; the database's constraints (create-tables.sql) do the rest of the validation,
and their errors become 400 (a failed check, a missing required field, an unknown reference) or 409 (a duplicate,
or deleting a row others still use, e.g. a category with products).
"""
import re
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, NoReturn

from flask import Blueprint, Response, abort, jsonify, request
from flask_jwt_extended import current_user
from sqlalchemy import select
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import selectinload

from app import storage
from app.auth import require_user
from app.database.db import db
from app.database.models.catalog import Brand, Category, Product, ProductImage
from app.database.models.content import Article, FaqItem, PageSection, Reseller
from app.database.models.price_rules import PriceRule
from app.database.models.settings import Setting
from app.pricing import ISRAEL

bp = Blueprint("staff", __name__, url_prefix="/api/staff")


class Invalid(ValueError):
    """A field's JSON value has the wrong type or form."""


def fail(status: int, **body: Any) -> NoReturn:
    """Stops the request with a JSON error.

    Args:
        status: The HTTP status, e.g. 400.
        **body: The error fields, e.g. error="invalid", field="sortOrder".

    Raises:
        HTTPException: Always (Flask's abort with the JSON response).
    """
    response = jsonify(body)
    response.status_code = status
    abort(response)


# Field converters: each takes the JSON value and returns what the model column takes, or raises Invalid. None
# (JSON null) passes through every one of them; the database refuses it where the column is required.


def text(value: Any) -> str | None:
    """A text field.

    Args:
        value: The JSON value.

    Returns:
        The string, or None.

    Raises:
        Invalid: The value has another type or form.
    """
    if value is None or isinstance(value, str):
        return value
    raise Invalid


def localized(value: Any) -> dict[str, str] | None:
    """A translated text field, {"he": ..., "en": ...}.

    Args:
        value: The JSON value.

    Returns:
        The object, or None.

    Raises:
        Invalid: The value has another type or form.
    """
    if value is None or (isinstance(value, dict) and all(isinstance(v, str) for v in value.values())):
        return value
    raise Invalid


def integer(value: Any) -> int | None:
    """A whole-number field (true/false are refused).

    Args:
        value: The JSON value.

    Returns:
        The int, or None.

    Raises:
        Invalid: The value has another type or form.
    """
    if value is None or (isinstance(value, int) and not isinstance(value, bool)):
        return value
    raise Invalid


def boolean(value: Any) -> bool | None:
    """A true/false field.

    Args:
        value: The JSON value.

    Returns:
        The bool, or None.

    Raises:
        Invalid: The value has another type or form.
    """
    if value is None or isinstance(value, bool):
        return value
    raise Invalid


def number(value: Any) -> float | None:
    """A number field (coordinates).

    Args:
        value: The JSON value.

    Returns:
        The float, or None.

    Raises:
        Invalid: The value has another type or form.
    """
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    raise Invalid


def money(value: Any) -> Decimal | None:
    """An amount in shekels: a JSON number or numeric text such as "303.90".

    Args:
        value: The JSON value.

    Returns:
        The exact Decimal, or None.

    Raises:
        Invalid: The value has another type or form.
    """
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise Invalid
    try:
        return Decimal(str(value))
    except InvalidOperation as error:
        raise Invalid from error


def reference(value: Any) -> uuid.UUID | None:
    """The id of another row (a UUID in text).

    Args:
        value: The JSON value.

    Returns:
        The UUID, or None.

    Raises:
        Invalid: The value has another type or form.
    """
    if value is None:
        return None
    try:
        return uuid.UUID(value)
    except (TypeError, ValueError, AttributeError) as error:
        raise Invalid from error


def timestamp(value: Any) -> datetime | None:
    """An ISO 8601 date and time; one without a UTC offset is read as Israel time.

    Args:
        value: The JSON value.

    Returns:
        An aware datetime, or None.

    Raises:
        Invalid: The value has another type or form.
    """
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError) as error:
        raise Invalid from error
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=ISRAEL)


def day(value: Any) -> date | None:
    """A calendar date in ISO form, e.g. "2026-11-03" (price rule periods, counted in Israel dates).

    Args:
        value: The JSON value.

    Returns:
        The date, or None.

    Raises:
        Invalid: The value has another type or form.
    """
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError) as error:
        raise Invalid from error


def json_value(value: Any) -> Any:
    """Any JSON value (setting values).

    Args:
        value: The JSON value.

    Returns:
        The value, unchanged.
    """
    return value


def json_object(value: Any) -> dict[str, Any] | None:
    """A JSON object (article bodies).

    Args:
        value: The JSON value.

    Returns:
        The dict, or None.

    Raises:
        Invalid: The value has another type or form.
    """
    if value is None or isinstance(value, dict):
        return value
    raise Invalid


def text_list(value: Any) -> list[str] | None:
    """A list of strings.

    Args:
        value: The JSON value.

    Returns:
        The list, or None.

    Raises:
        Invalid: The value has another type or form.
    """
    if value is None or (isinstance(value, list) and all(isinstance(v, str) for v in value)):
        return value
    raise Invalid


def images(value: Any) -> list[ProductImage]:
    """A product's photos, replacing the current ones: [{url, thumbnailUrl, srcset, alt}], main photo first.

    Args:
        value: The JSON list (null = no photos).

    Returns:
        New ProductImage rows, numbered by their position.
    """
    if value is None:
        return []
    if not isinstance(value, list) or not all(isinstance(item, dict) for item in value):
        raise Invalid
    return [
        ProductImage(
            url=text(item.get("url")),
            thumbnail_url=text(item.get("thumbnailUrl")),
            srcset=text(item.get("srcset")),
            alt=localized(item.get("alt")),
            sort_order=position,
        )
        for position, item in enumerate(value)
    ]


def image_json(image: ProductImage) -> dict[str, Any]:
    """Shapes a product photo the way `images` reads it.

    Args:
        image: The photo.

    Returns:
        {url, thumbnailUrl, srcset, alt}.
    """
    return {"url": image.url, "thumbnailUrl": image.thumbnail_url, "srcset": image.srcset, "alt": image.alt}


@dataclass(frozen=True)
class Resource:
    """A table staff edit: its model, its editable columns (name -> converter), list order and key column.

    `options` are loader options for every query; `stamp_creator` records the signed-in staff member in the new row's
    `created_by_id`; `stamp_editor` records them in `updated_by_id` on every create and update (the last change).
    `replaceable` allows PUT of the whole list (replace_rows): for a resource staff edit as one ordered list, keyed by
    a generated id and ordered by a `sort_order` column.
    """

    model: type[db.Model]
    fields: dict[str, Callable[[Any], Any]]
    order_by: tuple[Any, ...]
    key: str = "id"
    options: tuple[Any, ...] = field(default=())
    stamp_creator: bool = False
    stamp_editor: bool = False
    replaceable: bool = False


RESOURCES: dict[str, Resource] = {
    "brands": Resource(
        Brand,
        {"slug": text, "name": text, "tagline": localized, "description": localized, "accent_color": text,
         "logo_url": text, "sort_order": integer, "is_active": boolean},
        (Brand.sort_order, Brand.name),
    ),
    "categories": Resource(
        Category,
        {"slug": text, "name": localized, "image_url": text, "legacy_path": text, "sort_order": integer,
         "is_active": boolean},
        (Category.sort_order, Category.slug),
    ),
    "products": Resource(
        Product,
        {"woocommerce_id": integer, "slug": text, "sku": text, "barcode": text, "name": localized,
         "description": localized, "category_id": reference, "brand_id": reference, "list_price": money,
         "sort_order": integer, "is_active": boolean, "legacy_path": text, "images": images},
        (Product.sort_order, Product.id),
        options=(selectinload(Product.images),),
    ),
    "price-rules": Resource(
        PriceRule,
        {"business_user_id": reference, "category_id": reference, "product_id": reference, "kind": text,
         "value": money, "starts_on": day, "ends_on": day, "is_active": boolean, "note": text},
        (PriceRule.created_at, PriceRule.id),
        stamp_creator=True,
    ),
    "settings": Resource(Setting, {"key": text, "value": json_value, "description": text}, (Setting.key,), key="key"),
    "articles": Resource(
        Article,
        {"slug": text, "topic": text, "title": localized, "description": localized, "image_alt": localized,
         "body": json_object, "related_categories": text_list, "legacy_path": text, "published_at": timestamp},
        (Article.published_at.desc().nulls_first(), Article.slug),
    ),
    "resellers": Resource(
        Reseller,
        {"name": text, "address": text, "city": text, "phone": text, "website": text, "latitude": number,
         "longitude": number, "approximate_location": boolean, "is_active": boolean},
        (Reseller.city, Reseller.name),
    ),
    "page-sections": Resource(
        PageSection, {"key": text, "content": json_object}, (PageSection.key,), key="key", stamp_editor=True
    ),
    "faq-items": Resource(
        FaqItem,
        {"question": localized, "answer": localized, "sort_order": integer},
        (FaqItem.sort_order, FaqItem.created_at, FaqItem.id),
        stamp_editor=True,
        replaceable=True,
    ),
}

# URL part matching the resource names only, so any other name is a 404 (quoted: "price-rules" has a hyphen).
RESOURCE_PATH = f"<any({', '.join(repr(name) for name in RESOURCES)}):resource>"


def camel(name: str) -> str:
    """Turns a column name into its JSON key.

    Args:
        name: E.g. "sort_order".

    Returns:
        E.g. "sortOrder".
    """
    return re.sub(r"_([a-z])", lambda match: match.group(1).upper(), name)


def row_json(resource: Resource, row: Any) -> dict[str, Any]:
    """Shapes a row for the staff panel.

    Args:
        resource: The row's resource.
        row: The model instance.

    Returns:
        `id` (tables with a generated id), every editable field, `updatedById` (resources that stamp the editor) and
        `createdAt` / `updatedAt`.
    """
    data: dict[str, Any] = {"id": row.id} if resource.key == "id" else {}
    for column in resource.fields:
        value = getattr(row, column)
        data[camel(column)] = [image_json(image) for image in value] if column == "images" else value
    if resource.stamp_editor:
        data["updatedById"] = row.updated_by_id
    return {**data, "createdAt": row.created_at, "updatedAt": row.updated_at}


def read_fields(resource: Resource) -> dict[str, Any]:
    """Reads and converts the fields of a JSON request body.

    Args:
        resource: The resource being created or changed.

    Returns:
        Column name -> converted value, for the fields present in the body.

    Raises:
        400 {"error": "invalid_body"} for a body that is not an object; 415 for a non-JSON body; see convert_fields.
    """
    data = request.get_json()
    if not isinstance(data, dict):
        fail(400, error="invalid_body")
    return convert_fields(resource, data)


def convert_fields(resource: Resource, data: dict[str, Any]) -> dict[str, Any]:
    """Converts the fields of one JSON row (a request body, or one item of a replaced list).

    Args:
        resource: The resource being created or changed.
        data: The row's JSON object, camelCase keys.

    Returns:
        Column name -> converted value, for the fields present in the object.

    Raises:
        400 {"error": "unknown_field" | "invalid", "field"} for a key that is not a field or a value of the wrong
        type.
    """
    columns = {camel(column): column for column in resource.fields}
    values = {}
    for key, value in data.items():
        if key not in columns:
            fail(400, error="unknown_field", field=key)
        try:
            values[columns[key]] = resource.fields[columns[key]](value)
        except Invalid:
            fail(400, error="invalid", field=key)
    return values


def find_row(resource: Resource, key: str) -> Any:
    """Loads one row by its key.

    Args:
        resource: The resource.
        key: The id (a UUID in text) or, for settings, the setting key.

    Returns:
        The row.

    Raises:
        404 when no row has that key.
    """
    if resource.key == "id":
        try:
            key = uuid.UUID(key)
        except ValueError:
            abort(404)
    row = db.session.get(resource.model, key, options=resource.options)
    if row is None:
        abort(404)
    return row


def commit() -> None:
    """Commits the session, turning a refused change into a JSON error.

    Raises:
        409 {"error": "duplicate", "constraint"} for a unique key that is taken; 409 {"error": "in_use"} when a
        deleted row is still referenced; 400 {"error": "required", "field"} for a missing required field;
        400 {"error": "invalid_reference"} for an id that does not exist; 400 {"error": "invalid", "constraint"}
        for a failed check; 400 {"error": "invalid_value"} for a value the column cannot hold.
    """
    try:
        db.session.commit()
    except IntegrityError as error:
        db.session.rollback()
        sqlstate, diag = error.orig.sqlstate, error.orig.diag
        if sqlstate == "23505":
            fail(409, error="duplicate", constraint=diag.constraint_name)
        if sqlstate == "23503":
            if request.method == "DELETE":
                fail(409, error="in_use", constraint=diag.constraint_name)
            fail(400, error="invalid_reference", constraint=diag.constraint_name)
        if sqlstate == "23502":
            fail(400, error="required", field=camel(diag.column_name or ""))
        fail(400, error="invalid", constraint=diag.constraint_name)
    except DataError:
        db.session.rollback()
        fail(400, error="invalid_value")


@bp.before_request
def require_staff() -> None:
    """Lets only signed-in staff reach the staff API.

    Raises:
        401 without a valid access token, 403 with a customer's token (see app.auth.require_user).
    """
    require_user("staff")


@bp.get(f"/{RESOURCE_PATH}")
def list_rows(resource: str) -> list[dict[str, Any]]:
    """Every row of a resource, active or not, in display order.

    Args:
        resource: The resource name, e.g. "brands".

    Returns:
        The rows (see row_json).
    """
    spec = RESOURCES[resource]
    rows = db.session.scalars(select(spec.model).options(*spec.options).order_by(*spec.order_by))
    return [row_json(spec, row) for row in rows]


@bp.post(f"/{RESOURCE_PATH}")
def create_row(resource: str) -> tuple[dict[str, Any], int]:
    """Creates a row from the JSON body; omitted fields take their database default.

    Args:
        resource: The resource name.

    Returns:
        The new row with 201 (errors: see read_fields and commit).
    """
    spec = RESOURCES[resource]
    row = spec.model(**read_fields(spec))
    if spec.stamp_creator:
        row.created_by_id = current_user.id
    if spec.stamp_editor:
        row.updated_by_id = current_user.id
    db.session.add(row)
    commit()
    return row_json(spec, row), 201


@bp.get(f"/{RESOURCE_PATH}/<key>")
def get_row(resource: str, key: str) -> dict[str, Any]:
    """One row.

    Args:
        resource: The resource name.
        key: The row's id (the key text for settings).

    Returns:
        The row; 404 when it does not exist.
    """
    spec = RESOURCES[resource]
    return row_json(spec, find_row(spec, key))


@bp.patch(f"/{RESOURCE_PATH}/<key>")
def update_row(resource: str, key: str) -> dict[str, Any]:
    """Changes the fields given in the JSON body (a product's `images` replace all its photos).

    Args:
        resource: The resource name.
        key: The row's id (the key text for settings).

    Returns:
        The updated row; 404 when it does not exist (errors: see read_fields and commit).
    """
    spec = RESOURCES[resource]
    row = find_row(spec, key)
    for column, value in read_fields(spec).items():
        setattr(row, column, value)
    if spec.stamp_editor:
        row.updated_by_id = current_user.id
    commit()
    return row_json(spec, row)


@bp.delete(f"/{RESOURCE_PATH}/<key>")
def delete_row(resource: str, key: str) -> Response:
    """Deletes a row (to hide one from the site instead, PATCH isActive: false where the resource has it).

    Args:
        resource: The resource name.
        key: The row's id (the key text for settings).

    Returns:
        204; 404 when it does not exist, 409 {"error": "in_use"} when other rows still need it.
    """
    spec = RESOURCES[resource]
    db.session.delete(find_row(spec, key))
    commit()
    return Response(status=204)


@bp.put(f"/{RESOURCE_PATH}")
def replace_rows(resource: str) -> list[dict[str, Any]]:
    """Replaces the whole list of a resource staff edit as one ordered list (the FAQ), in one transaction, so a refused
    item saves nothing.

    The JSON body is the new list in display order. An item with an `id` keeps that row and changes the fields it
    gives; an item without one is a new row. Rows left out are deleted. Every row's `sort_order` becomes its position
    (0, 1, 2, ...; a `sortOrder` in an item is ignored). Only rows that really changed (or moved) record the signed-in
    staff member as their last editor.

    Args:
        resource: The resource name, e.g. "faq-items".

    Returns:
        The rows in their new order (see row_json). Errors: 405 for a resource that is not replaceable; 400
        {"error": "invalid_body"} for a body that is not a list of objects; 400 {"error": "invalid", "field": "id"}
        for an id that is not in the table (e.g. deleted meanwhile) or appears twice; the field errors of
        convert_fields and the database errors of commit.
    """
    spec = RESOURCES[resource]
    if not spec.replaceable:
        abort(405)
    data = request.get_json()
    if not isinstance(data, list) or not all(isinstance(item, dict) for item in data):
        fail(400, error="invalid_body")
    remaining = {row.id: row for row in db.session.scalars(select(spec.model))}
    rows, changed = [], []
    for position, item in enumerate(data):
        fields = dict(item)
        key = fields.pop("id", None)
        values = convert_fields(spec, fields) | {"sort_order": position}
        if key is None:
            row = spec.model(**values)
            db.session.add(row)
            changed.append(row)
        else:
            try:
                row = remaining.pop(reference(key), None)
            except Invalid:
                row = None
            if row is None:
                fail(400, error="invalid", field="id")
            for column, value in values.items():
                setattr(row, column, value)
            if db.session.is_modified(row):
                changed.append(row)
        rows.append(row)
    for row in remaining.values():
        db.session.delete(row)
    if spec.stamp_editor:
        for row in changed:
            row.updated_by_id = current_user.id
    commit()
    return [row_json(spec, row) for row in rows]


# Uploads (the S3 stub, app/storage.py): the folders staff may upload into (one per kind of picture; add "brands" or
# "products" with their admin fields), the largest file, and the image types by their first bytes: (extension,
# media type, test). SVG is refused on purpose: it can carry scripts, and the files are served from our own origin.
UPLOAD_FOLDERS = frozenset({"categories"})
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
IMAGE_TYPES: tuple[tuple[str, str, Callable[[bytes], bool]], ...] = (
    ("jpg", "image/jpeg", lambda head: head.startswith(b"\xff\xd8\xff")),
    ("png", "image/png", lambda head: head.startswith(b"\x89PNG\r\n\x1a\n")),
    ("webp", "image/webp", lambda head: head[:4] == b"RIFF" and head[8:12] == b"WEBP"),
    ("avif", "image/avif", lambda head: head[4:12] in (b"ftypavif", b"ftypavis")),
)


def image_type(body: bytes) -> tuple[str, str] | None:
    """Recognizes an image by its first bytes (what the file is, whatever its name or the browser claims).

    Args:
        body: The file's bytes.

    Returns:
        (extension, media type) for a JPEG, PNG, WebP or AVIF image; None for anything else.
    """
    return next(((extension, media) for extension, media, test in IMAGE_TYPES if test(body[:16])), None)


@bp.post("/uploads")
def upload() -> tuple[dict[str, str], int]:
    """Stores an uploaded picture (the S3 stub) under a new random key; the caller saves the returned URL in a row
    (e.g. a category's imageUrl).

    The body is multipart/form-data: `file` (the image) and `folder` (one of UPLOAD_FOLDERS).

    Returns:
        {"key", "url"} with 201. Errors: 400 {"error": "invalid", "field": "folder"} for an unknown folder; 400
        {"error": "required", "field": "file"} without a file; 400 {"error": "too_large", "field": "file"} over 5 MB
        (413 "request_entity_too_large" for a body over the app's limit); 400 {"error": "unsupported_type",
        "field": "file"} for anything but a JPEG, PNG, WebP or AVIF image.
    """
    folder = request.form.get("folder", "")
    if folder not in UPLOAD_FOLDERS:
        fail(400, error="invalid", field="folder")
    file = request.files.get("file")
    if file is None:
        fail(400, error="required", field="file")
    body = file.read(MAX_UPLOAD_BYTES + 1)
    if not body:
        fail(400, error="required", field="file")
    if len(body) > MAX_UPLOAD_BYTES:
        fail(400, error="too_large", field="file")
    kind = image_type(body)
    if kind is None:
        fail(400, error="unsupported_type", field="file")
    extension, media_type = kind
    key = f"{folder}/{uuid.uuid4().hex}.{extension}"
    return {"key": key, "url": storage.put_object(key, body, media_type)}, 201
