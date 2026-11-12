"""catalog_pdf.py — Builds the downloadable PDF catalog (no prices) from the database, one file per site language.

The catalog used to be a hand-made file copied from the old WordPress site. This module draws the same anatomy from
the current products: a cover (logo, "Premium quality pet products"), a title page per category, product pages (the
category's name and the logo on top, the products' photos in a grid, a red band under each row with their names) and
a back page with the contact details. A4 landscape, drawn with fpdf2 (its text shaping gives Hebrew its right-to-left
order), photos downscaled with Pillow; the fonts and the logo are the files in app/catalog_assets/.

Three settings (table `settings`) hold everything:
    catalog_pdf_options   what staff chose in the "PDF catalog" dialog of /admin/products (see DEFAULT_OPTIONS)
    catalog_pdf_files     {"he": <object key>, "en": <object key>}: the current files in the storage (app/storage.py)
    catalog_pdf_status    {"state": "building" | "ready" | "failed", "startedAt", "builtAt", "fingerprint", "pages",
                          "products", "error"}
A build writes new objects (`catalog/ultrapet-catalog-<language>-<UTC timestamp>.pdf`: a stored key never changes
its content, since the files are cached for a year), points catalog_pdf_files at them and deletes the ones it
replaced. GET /api/catalog.pdf?lang= (app/customers/routes.py) redirects to them.

Who builds:
    `flask build-catalog [--force]`             the script (after `flask seed` and `flask import-media`)
    request_rebuild()                           after staff change a product, category, brand or contact detail
                                                (the staff blueprint's after_request), in a background thread
    POST /api/staff/catalog-pdf                 "Generate now" in the dialog: saves the options and forces a build
A build that would produce the same catalog (same products, options and template: the fingerprint) is skipped unless
forced. Builds never overlap: a Postgres advisory lock queues them, and each reads the data after it got the lock,
so the last change always ends up in the file.
"""
import hashlib
import io
import json
import math
import threading
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import click
from flask import Flask, current_app
from fpdf import FPDF
from PIL import Image
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app import storage
from app.database.db import db
from app.database.models.catalog import Category, Product
from app.database.models.settings import Setting, get_setting

ASSETS_DIR = Path(__file__).resolve().parent / "catalog_assets"
LOGO = ASSETS_DIR / "logo.svg"
# The logo's width / height (its viewBox).
LOGO_RATIO = 1350.3 / 322.7

OPTIONS_KEY = "catalog_pdf_options"
FILES_KEY = "catalog_pdf_files"
STATUS_KEY = "catalog_pdf_status"
SETTING_DESCRIPTIONS = {
    OPTIONS_KEY: "Layout options of the generated PDF catalog (the PDF catalog dialog of /admin/products)",
    FILES_KEY: "Object keys of the generated PDF catalogs per language; /api/catalog.pdf redirects to them",
    STATUS_KEY: "State of the last PDF catalog build (building / ready / failed, when, pages, products)",
}

# What staff can set. perPage: products on a page (1-12); categoryPages: a title page before each category;
# showBrand / showSku / showBarcode: extra lines under a product's name; autoRebuild: rebuild after every change.
DEFAULT_OPTIONS: dict[str, Any] = {
    "perPage": 3,
    "categoryPages": True,
    "showBrand": False,
    "showSku": False,
    "showBarcode": False,
    "autoRebuild": True,
}
MIN_PER_PAGE, MAX_PER_PAGE = 1, 12
# Bump when the drawing changes, so the next build is not skipped as "same catalog".
TEMPLATE_VERSION = 1
# The languages a catalog is built in, and the direction each is written in.
LOCALES = {"he": "rtl", "en": "ltr"}
# A build that reports "building" for longer than this died (the process stopped): shown as failed.
STALE_AFTER = timedelta(minutes=15)
# The key of the Postgres advisory lock one build holds (any fixed number of our own).
LOCK_ID = 5568_2026

# The page (millimetres) and the brand colors (index.css: brand-red, brand-charcoal, brand-charcoal-muted).
PAGE_W, PAGE_H = 297.0, 210.0
MARGIN = 12.0
HEADER_H = 34.0
FOOTER_H = 9.0
ROW_GAP = 3.0
RED = (190, 30, 36)
CHARCOAL = (26, 26, 26)
MUTED = (107, 107, 107)
WHITE = (255, 255, 255)
# Photos are stored in the PDF at this resolution (dots per inch of their box), as JPEG.
PHOTO_DPI = 100
JPEG_QUALITY = 76
POINT = 0.3528  # one typographic point in millimetres

# The catalog's own words (the site's dictionaries live in the frontend).
TEXTS = {
    "he": {
        "title": "קטלוג מוצרים",
        "products": "מוצרים",
        "sku": "מק״ט",
        "barcode": "ברקוד",
        "website": "אתר אינטרנט",
        "phone": "שירות לקוחות",
        "email": "דוא״ל",
    },
    "en": {
        "title": "Product catalog",
        "products": "products",
        "sku": "Item code",
        "barcode": "Barcode",
        "website": "Website",
        "phone": "Customer service",
        "email": "Email",
    },
}
TAGLINE = "PREMIUM QUALITY PET PRODUCTS"
COMPANY = ("Ultra Pet Israel Ltd", "אולטרה פט ישראל בע״מ")

# True while a background rebuild of this process waits for its turn: further changes need no thread of their own.
_queued = False
_queued_lock = threading.Lock()


def clean_options(raw: Any) -> dict[str, Any]:
    """Checks the options staff send and fills the ones left out.

    Args:
        raw: The submitted (or stored) options: any subset of DEFAULT_OPTIONS' keys.

    Returns:
        Every option, valid.

    Raises:
        ValueError: An option has a wrong type or range; its message is the option's name.
    """
    if not isinstance(raw, dict):
        raise ValueError("options")
    options = DEFAULT_OPTIONS | {key: value for key, value in raw.items() if key in DEFAULT_OPTIONS}
    per_page = options["perPage"]
    if isinstance(per_page, bool) or not isinstance(per_page, int) or not MIN_PER_PAGE <= per_page <= MAX_PER_PAGE:
        raise ValueError("perPage")
    for key, value in options.items():
        if key != "perPage" and not isinstance(value, bool):
            raise ValueError(key)
    return options


def stored_options() -> dict[str, Any]:
    """The saved options, with the defaults for anything missing or no longer valid.

    Returns:
        Every option (see DEFAULT_OPTIONS).
    """
    try:
        return clean_options(get_setting(OPTIONS_KEY) or {})
    except ValueError:
        return dict(DEFAULT_OPTIONS)


def put_setting(key: str, value: Any) -> None:
    """Sets one of the catalog's settings in the session (the caller commits).

    Args:
        key: OPTIONS_KEY, FILES_KEY or STATUS_KEY.
        value: The JSON value to store.
    """
    setting = db.session.get(Setting, key)
    if setting is None:
        db.session.add(Setting(key=key, value=value, description=SETTING_DESCRIPTIONS[key]))
    else:
        setting.value = value


def now_text() -> str:
    """The current moment for a status.

    Returns:
        UTC, ISO 8601, to the second, e.g. "2026-11-12T10:15:00+00:00".
    """
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def catalog_data() -> dict[str, Any]:
    """Reads what the catalog shows: the active categories in their order, each with its active products in theirs,
    and the contact details of the back page.

    Returns:
        {"categories": [{"name": {he, en}, "image": key | None, "products": [{"name": {he, en}, "brand", "sku",
        "barcode", "image": key | None}]}], "contact": {"website", "phone", "email"}}; categories without products
        are left out. Plain JSON, so its hash is the catalog's fingerprint.
    """
    products = db.session.scalars(
        select(Product)
        .where(Product.is_active)
        .options(selectinload(Product.images), selectinload(Product.brand))
        .order_by(Product.sort_order, Product.id)
    )
    by_category: dict[Any, list[dict[str, Any]]] = {}
    for product in products:
        by_category.setdefault(product.category_id, []).append(
            {
                "name": product.name,
                "brand": product.brand.name if product.brand else None,
                "sku": product.sku,
                "barcode": product.barcode,
                "image": product.images[0].url if product.images else None,
            }
        )
    categories = db.session.scalars(select(Category).where(Category.is_active).order_by(Category.sort_order, Category.slug))
    site = str(current_app.config.get("SITE_URL", "")).split("://")[-1].strip("/")
    return {
        "categories": [
            {"name": category.name, "image": category.image_url, "products": by_category[category.id]}
            for category in categories
            if category.id in by_category
        ],
        "contact": {
            "website": site,
            "phone": str(get_setting("contact_phone") or ""),
            "email": str(get_setting("contact_email") or ""),
        },
    }


def fingerprint_of(data: dict[str, Any], options: dict[str, Any]) -> str:
    """Identifies a catalog by everything that decides how it looks.

    Args:
        data: catalog_data().
        options: The layout options (autoRebuild does not change the file and is left out).

    Returns:
        A SHA-256 hex digest; equal for two builds that would draw the same pages.
    """
    layout = {key: value for key, value in options.items() if key != "autoRebuild"}
    # What the options hide is not drawn, so a change to it (e.g. a barcode while barcodes are off) is no new catalog.
    hidden = {field for option, field in (("showBrand", "brand"), ("showSku", "sku"), ("showBarcode", "barcode")) if not options[option]}
    categories = [
        {
            "name": category["name"],
            "image": category["image"] if options["categoryPages"] else None,
            "products": [{key: value for key, value in product.items() if key not in hidden} for product in category["products"]],
        }
        for category in data["categories"]
    ]
    payload = json.dumps([TEMPLATE_VERSION, layout, categories, data["contact"]], sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()


def grid(per_page: int) -> tuple[int, int]:
    """The grid a page's products are laid out in.

    Args:
        per_page: Products on a page, 1-12.

    Returns:
        (columns, rows): one row up to 4 products, two up to 8, three above.
    """
    rows = 1 if per_page <= 4 else 2 if per_page <= 8 else 3
    return math.ceil(per_page / rows), rows


def photo_jpeg(body: bytes, max_px: int) -> tuple[bytes, int, int] | None:
    """Prepares a stored picture for the PDF: on white, no larger than its box needs, as JPEG.

    Args:
        body: The picture's bytes (JPEG, PNG, WebP or AVIF).
        max_px: The longest side to keep, in pixels.

    Returns:
        (JPEG bytes, width, height), or None when the file is not a readable picture.
    """
    try:
        with Image.open(io.BytesIO(body)) as picture:
            rgba = picture.convert("RGBA")
        flat = Image.new("RGB", rgba.size, "white")
        flat.paste(rgba, mask=rgba.getchannel("A"))
        flat.thumbnail((max_px, max_px), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        flat.save(out, "JPEG", quality=JPEG_QUALITY, optimize=True)
        return out.getvalue(), flat.width, flat.height
    except Exception:  # noqa: BLE001 (any unreadable file just leaves its photo out)
        return None


class CatalogPdf(FPDF):
    """One catalog being drawn: an A4 landscape document in one language, with the brand fonts registered."""

    def __init__(self, locale: str) -> None:
        """Starts an empty document.

        Args:
            locale: "he" or "en": the language of the texts and the direction of the layout.
        """
        super().__init__(orientation="L", unit="mm", format="A4")
        self.locale = locale
        self.rtl = LOCALES[locale] == "rtl"
        self.words = TEXTS[locale]
        self.set_auto_page_break(False)
        self.set_margins(0, 0, 0)
        self.c_margin = 0
        self.add_font("Heebo", "", ASSETS_DIR / "Heebo-Regular.ttf")
        self.add_font("Heebo", "B", ASSETS_DIR / "Heebo-Bold.ttf")
        self.set_text_shaping(use_shaping_engine=True, direction=LOCALES[locale])
        self.set_lang(locale)
        self.set_title(f"Ultra Pet — {self.words['title']}")
        self.set_author(COMPANY[0])

    def line_of(self, text_value: str, x: float, y: float, width: float, size: float, color: tuple[int, int, int], bold: bool = False, align: str = "C") -> None:
        """Draws one line of text in a box.

        Args:
            text_value: The text.
            x: The box's left edge (mm).
            y: The box's top edge (mm).
            width: The box's width (mm).
            size: The font size in points (the line is 1.3 times as high).
            color: The text color (RGB).
            bold: Heebo Bold instead of Regular.
            align: "C", "L" or "R".
        """
        self.set_font("Heebo", "B" if bold else "", size)
        self.set_text_color(*color)
        self.set_xy(x, y)
        self.cell(width, size * POINT * 1.3, text_value, align=align)

    def fitted(self, text_value: str, width: float, line_height: float, max_lines: int) -> tuple[str, int]:
        """Shortens a text until it wraps into a box (in the current font), dropping whole words from its end.

        Args:
            text_value: The text.
            width: The box's width (mm).
            line_height: The height of one line (mm).
            max_lines: The most lines the box holds.

        Returns:
            (the text that fits, ending with "…" when shortened; the number of lines it takes).
        """
        words = text_value.split()
        candidate = " ".join(words)
        while True:
            lines = self.multi_cell(width, line_height, candidate, align="C", dry_run=True, output="LINES")
            if len(lines) <= max_lines or len(words) <= 1:
                return candidate, min(len(lines), max_lines)
            words.pop()
            candidate = " ".join(words) + "…"

    def logo(self, x: float, y: float, width: float) -> None:
        """Draws the Ultra Pet logo.

        Args:
            x: Its left edge (mm).
            y: Its top edge (mm).
            width: Its width (mm); the height follows the logo's proportions.
        """
        self.image(LOGO, x=x, y=y, w=width, h=width / LOGO_RATIO)

    def cover(self) -> None:
        """Adds the cover page: the logo, the tagline, the catalog's title and the month it was built."""
        self.add_page()
        width = 150.0
        self.logo((PAGE_W - width) / 2, 62, width)
        self.line_of(TAGLINE, 0, 104, PAGE_W, 15, CHARCOAL, bold=True)
        self.line_of(self.words["title"], 0, 124, PAGE_W, 30, RED, bold=True)
        self.line_of(datetime.now(timezone.utc).strftime("%m.%Y"), 0, 142, PAGE_W, 13, MUTED)
        self.set_fill_color(*RED)
        self.rect(0, PAGE_H - 14, PAGE_W, 14, style="F")

    def category_page(self, name: str, count: int, picture: tuple[bytes, int, int] | None) -> None:
        """Adds a category's title page: its name on red, with the category's picture beside it when it has one.

        Args:
            name: The category's name.
            count: How many products follow.
            picture: The category's prepared picture (photo_jpeg), or None.
        """
        self.add_page()
        self.set_fill_color(*RED)
        self.rect(0, 0, PAGE_W, PAGE_H, style="F")
        x, width = 0.0, PAGE_W
        if picture:
            # The picture fills the half of the page the text does not start at, cropped by the page's edge.
            body, pixels_w, pixels_h = picture
            half = PAGE_W / 2
            scale = max(half / pixels_w, PAGE_H / pixels_h)
            drawn_w, drawn_h = pixels_w * scale, pixels_h * scale
            left = 0.0 if self.rtl else half
            with self.rect_clip(left, 0, half, PAGE_H):
                self.image(io.BytesIO(body), x=left + (half - drawn_w) / 2, y=(PAGE_H - drawn_h) / 2, w=drawn_w, h=drawn_h)
            x, width = (half, half) if self.rtl else (0.0, half)
        self.set_font("Heebo", "B", 54 if picture else 64)
        line_height = self.font_size_pt * POINT * 1.15
        title, lines = self.fitted(name, width - 2 * MARGIN, line_height, 3)
        top = (PAGE_H - lines * line_height - 18) / 2
        self.set_text_color(*WHITE)
        self.set_xy(x + MARGIN, top)
        self.multi_cell(width - 2 * MARGIN, line_height, title, align="C")
        rule_y = top + lines * line_height + 5
        self.set_fill_color(*WHITE)
        self.rect(x + width / 2 - 20, rule_y, 40, 0.8, style="F")
        self.line_of(f"{count} {self.words['products']}", x, rule_y + 5, width, 16, WHITE)
        self.page_number(WHITE)

    def page_number(self, color: tuple[int, int, int]) -> None:
        """Writes the page's number in its bottom corner (as the old catalog did).

        Args:
            color: The text color (white on a red page).
        """
        self.line_of(str(self.page_no()), MARGIN, PAGE_H - FOOTER_H + 1.5, 30, 10, color, align="L")

    def extra_lines(self, product: dict[str, Any], options: dict[str, Any]) -> list[str]:
        """The small lines under a product's name that the options ask for.

        Args:
            product: A product of catalog_data().
            options: The layout options (showBrand, showSku, showBarcode).

        Returns:
            The lines to draw; a product without the value has no such line. Codes are wrapped in direction
            isolates, so "AB-123" keeps its order inside a Hebrew line.
        """
        lines = []
        if options["showBrand"] and product["brand"]:
            lines.append(product["brand"])
        for option, field in (("showSku", "sku"), ("showBarcode", "barcode")):
            if options[option] and product[field]:
                lines.append(f"{self.words[field]}: ⁦{product[field]}⁩")
        return lines

    def product_page(self, title: str, products: list[dict[str, Any]], options: dict[str, Any], photo: Callable[[str | None], tuple[bytes, int, int] | None]) -> None:
        """Adds one page of products: the category's name and the logo on top, then the grid; each row is the
        photos above a red band with the names.

        Args:
            title: The category's name.
            products: The page's products (at most options["perPage"]), in order.
            options: The layout options.
            photo: Gives a product's prepared photo by its object key (None when there is none).
        """
        self.add_page()
        logo_w = 50.0
        self.logo(PAGE_W - MARGIN - logo_w, 10, logo_w)
        self.set_font("Heebo", "B", 26)
        heading, _ = self.fitted(title, PAGE_W - 2 * (MARGIN + logo_w + 6), 14, 1)
        self.line_of(heading, 0, 10, PAGE_W, 26, CHARCOAL, bold=True)

        columns, rows = grid(options["perPage"])
        name_size = {1: 15.0, 2: 11.0, 3: 9.0}[rows] - (1.5 if columns == 4 else 0)
        small_size = name_size * 0.78
        name_lh, small_lh = name_size * POINT * 1.3, small_size * POINT * 1.3
        name_lines = 3 if rows == 1 else 2
        extras = sum(bool(options[key]) for key in ("showBrand", "showSku", "showBarcode"))
        padding = 4.0 if rows == 1 else 2.5
        band_h = name_lines * name_lh + extras * small_lh + 2 * padding
        row_h = (PAGE_H - HEADER_H - FOOTER_H - ROW_GAP * (rows - 1)) / rows
        photo_h = row_h - band_h
        cell_w = (PAGE_W - 2 * MARGIN) / columns
        inset = 3.0

        for row in range(math.ceil(len(products) / columns)):
            in_row = products[row * columns : (row + 1) * columns]
            top = HEADER_H + row * (row_h + ROW_GAP)
            self.set_fill_color(*RED)
            self.rect(0, top + photo_h, PAGE_W, band_h, style="F")
            # A row that is not full is centered; the first product is at the reading direction's start.
            offset = MARGIN + (columns - len(in_row)) * cell_w / 2
            for index, product in enumerate(in_row):
                place = len(in_row) - 1 - index if self.rtl else index
                x = offset + place * cell_w
                picture = photo(product["image"])
                if picture:
                    body, pixels_w, pixels_h = picture
                    scale = min((cell_w - 2 * inset) / pixels_w, (photo_h - 2 * inset) / pixels_h)
                    drawn_w, drawn_h = pixels_w * scale, pixels_h * scale
                    self.image(io.BytesIO(body), x=x + (cell_w - drawn_w) / 2, y=top + photo_h - inset - drawn_h, w=drawn_w, h=drawn_h)
                name = product["name"].get(self.locale) or product["name"].get("he") or ""
                self.set_font("Heebo", "", name_size)
                self.set_text_color(*WHITE)
                caption, used = self.fitted(name, cell_w - 2 * inset, name_lh, name_lines)
                lines = self.extra_lines(product, options)
                y = top + photo_h + (band_h - used * name_lh - len(lines) * small_lh) / 2
                self.set_xy(x + inset, y)
                self.multi_cell(cell_w - 2 * inset, name_lh, caption, align="C")
                for position, line in enumerate(lines):
                    self.line_of(line, x + inset, y + used * name_lh + position * small_lh, cell_w - 2 * inset, small_size, WHITE)
        self.page_number(CHARCOAL)

    def back_page(self, contact: dict[str, str]) -> None:
        """Adds the last page: the logo, and a red band with the company's name and contact details.

        Args:
            contact: {"website", "phone", "email"}; an empty one is left out.
        """
        self.add_page()
        logo_w = 50.0
        self.logo(PAGE_W - MARGIN - logo_w, 10, logo_w)
        lines = [f"{self.words[field]}: ⁦{contact[field]}⁩" for field in ("website", "phone", "email") if contact.get(field)]
        band_h = 44.0 + 8.5 * len(lines)
        top = (PAGE_H - band_h) / 2
        self.set_fill_color(*RED)
        self.rect(0, top, PAGE_W, band_h, style="F")
        first, second = COMPANY if not self.rtl else COMPANY[::-1]
        self.line_of(first, 0, top + 9, PAGE_W, 24, WHITE, bold=True)
        self.line_of(second, 0, top + 21, PAGE_W, 18, WHITE)
        for position, line in enumerate(lines):
            self.line_of(line, 0, top + 36 + 8.5 * position, PAGE_W, 14, WHITE)
        self.page_number(CHARCOAL)


def render(data: dict[str, Any], options: dict[str, Any], locale: str, photo: Callable[[str | None], tuple[bytes, int, int] | None]) -> tuple[bytes, int]:
    """Draws the whole catalog in one language.

    Args:
        data: catalog_data().
        options: The layout options (clean_options).
        locale: "he" or "en".
        photo: Gives a prepared picture (photo_jpeg) by object key, None when there is none.

    Returns:
        (the PDF's bytes, its number of pages).
    """
    pdf = CatalogPdf(locale)
    pdf.cover()
    per_page = options["perPage"]
    for category in data["categories"]:
        name = category["name"].get(locale) or category["name"].get("he") or ""
        products = category["products"]
        if options["categoryPages"]:
            pdf.category_page(name, len(products), photo(category["image"]))
        for start in range(0, len(products), per_page):
            pdf.product_page(name, products[start : start + per_page], options, photo)
    pdf.back_page(data["contact"])
    return bytes(pdf.output()), pdf.page_no()


def photo_loader(options: dict[str, Any]) -> Callable[[str | None], tuple[bytes, int, int] | None]:
    """Makes the function a build reads its pictures with: from the storage, prepared once and kept for the other
    language.

    Args:
        options: The layout options (the grid decides how large a photo is kept).

    Returns:
        photo(key) -> (JPEG bytes, width, height) or None (no key, no such object, not a picture).
    """
    columns, rows = grid(options["perPage"])
    box = max((PAGE_W - 2 * MARGIN) / columns, (PAGE_H - HEADER_H - FOOTER_H) / rows, PAGE_W / 2 if options["categoryPages"] else 0)
    max_px = round(box / 25.4 * PHOTO_DPI)
    kept: dict[str, tuple[bytes, int, int] | None] = {}

    def photo(key: str | None) -> tuple[bytes, int, int] | None:
        """Reads and prepares one picture.

        Args:
            key: Its object key, or None.

        Returns:
            The prepared picture, or None.
        """
        if not key:
            return None
        if key not in kept:
            body = storage.get_object(key)
            kept[key] = photo_jpeg(body, max_px) if body else None
        return kept[key]

    return photo


def build_catalog(force: bool = False, on_start: Callable[[], None] | None = None) -> dict[str, Any]:
    """Builds the catalog in every language and makes it the one customers download; waits for a running build first.

    Args:
        force: Build even when the stored catalog already shows the same products with the same options (e.g. after
            photos were added to the storage).
        on_start: Called once this build has its turn, before it reads the data.

    Returns:
        The new status (see the module docstring); the stored one when the build was skipped.

    Raises:
        Exception: Whatever stopped the build; the status then says "failed" and the previous files stay.
    """
    with db.engine.connect() as lock:
        lock.execute(text("SELECT pg_advisory_lock(:id)"), {"id": LOCK_ID})
        try:
            if on_start:
                on_start()
            return build_now(force)
        finally:
            lock.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": LOCK_ID})


def build_now(force: bool) -> dict[str, Any]:
    """The build itself (build_catalog holds the lock around it).

    Args:
        force: See build_catalog.

    Returns:
        The new status, or the stored one when skipped.
    """
    db.session.rollback()  # a fresh look at the data
    options = stored_options()
    data = catalog_data()
    fingerprint = fingerprint_of(data, options)
    status = get_setting(STATUS_KEY) or {}
    files = get_setting(FILES_KEY) or {}
    current = status.get("fingerprint") == fingerprint and all(storage.object_exists(files.get(locale, "")) for locale in LOCALES)
    if current and not force:
        if status.get("state") != "ready":
            status = status | {"state": "ready", "error": None}
            put_setting(STATUS_KEY, status)
            db.session.commit()
        return status

    put_setting(STATUS_KEY, status | {"state": "building", "startedAt": now_text(), "error": None})
    db.session.commit()
    try:
        photo = photo_loader(options)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        built, pages = {}, 0
        for locale in LOCALES:
            body, pages = render(data, options, locale, photo)
            built[locale] = f"catalog/ultrapet-catalog-{locale}-{stamp}.pdf"
            storage.put_object(built[locale], body, "application/pdf")
    except Exception as error:
        db.session.rollback()
        put_setting(STATUS_KEY, status | {"state": "failed", "error": str(error)[:300]})
        db.session.commit()
        raise
    status = {
        "state": "ready",
        "builtAt": now_text(),
        "fingerprint": fingerprint,
        "pages": pages,
        "products": sum(len(category["products"]) for category in data["categories"]),
        "error": None,
    }
    put_setting(FILES_KEY, built)
    put_setting(STATUS_KEY, status)
    db.session.commit()
    for key in files.values():
        if key not in built.values():
            storage.delete_object(key)
    return status


def run_in_background(app: Flask, force: bool) -> None:
    """A background thread's job: one build in its own app context; a failure is logged (the status keeps it too).

    Args:
        app: The application.
        force: See build_catalog.
    """

    def started() -> None:
        """Lets the next change queue a rebuild of its own: this one reads the data from here on."""
        global _queued
        if not force:
            with _queued_lock:
                _queued = False

    with app.app_context():
        try:
            build_catalog(force, on_start=started)
        except Exception:  # noqa: BLE001
            started()
            app.logger.exception("The PDF catalog build failed")


def request_rebuild(force: bool = False) -> None:
    """Asks for a rebuild after a change (call it after the change is committed).

    The app config CATALOG_REBUILD decides how: "thread" (default) builds in a background thread, so the request
    that made the change answers at once; "inline" builds before returning (tests); "off" does nothing. Without
    `force`, nothing happens when staff switched "rebuild automatically" off, and a burst of changes shares one
    waiting thread.

    Args:
        force: Build even when nothing changed, whatever the autoRebuild option says ("Generate now").
    """
    global _queued
    mode = current_app.config.get("CATALOG_REBUILD", "thread")
    if mode == "off" or (not force and not stored_options()["autoRebuild"]):
        return
    if mode == "inline":
        build_catalog(force)
        return
    if not force:
        with _queued_lock:
            if _queued:
                return
            _queued = True
    app = current_app._get_current_object()  # noqa: SLF001 (the real app, for the thread's own context)
    threading.Thread(target=run_in_background, args=(app, force), daemon=True, name="catalog-pdf").start()


def mark_building() -> None:
    """Records that a build was asked for, so the dialog shows "building" at once (the caller commits)."""
    status = get_setting(STATUS_KEY) or {}
    put_setting(STATUS_KEY, status | {"state": "building", "startedAt": now_text(), "error": None})


def catalog_state() -> dict[str, Any]:
    """What the staff dialog shows.

    Returns:
        {"options": every option, "status": the last build's status ({"state": "none"} before the first; a build
        that has been "building" for too long reads "failed"), "urls": {language: the file's URL} of the files that
        exist}.
    """
    status = dict(get_setting(STATUS_KEY) or {"state": "none"})
    status.pop("fingerprint", None)
    if status.get("state") == "building":
        try:
            started = datetime.fromisoformat(str(status.get("startedAt")))
        except ValueError:
            started = None
        if started is None or datetime.now(timezone.utc) - started > STALE_AFTER:
            status["state"] = "failed"
    files = get_setting(FILES_KEY) or {}
    return {
        "options": stored_options(),
        "status": status,
        "urls": {locale: storage.public_url(files[locale]) for locale in LOCALES if files.get(locale)},
    }


@click.command("build-catalog")
@click.option("--force", is_flag=True, help="Build even when the stored catalog is already up to date.")
def build_catalog_command(force: bool) -> None:
    """Builds the PDF catalog (Hebrew and English) from the database and makes it the downloadable one.

    Args:
        force: The --force flag.
    """
    status = build_catalog(force)
    click.echo(f"PDF catalog ready: {status['products']} products, {status['pages']} pages (built {status['builtAt']}).")
