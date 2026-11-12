"""routes.py — Blueprint `customers` (prefix /api): everything the public site and the business customers call.

Public, no sign-in (/products also reads an optional customer sign-in for its price sorts and price range):
    GET /categories, /products, /products/<slug>, /brands, /brands/<slug>, /stats, /contact, /sections, /sections/<key>, /faq,
    /articles, /articles/<slug>, /resellers, /sitemap.xml, /media/<key> (stored files: the S3 stub's objects),
    /catalog.pdf?lang= (redirects to the generated PDF catalog in the file storage, see app/catalog_pdf.py)
Sign-in, shared by business customers and staff (JWT cookies, see app/auth.py):
    POST /auth/login, /auth/refresh, /auth/logout; GET /auth/me
Business customers only:
    GET /prices

JSON keys are camelCase, in the shapes the frontend types in src/api.ts (the same shapes as its stub fixtures).
Only active rows are shown. Pictures are stored as object keys and answered as URLs (storage.url_of /
storage.srcset_urls). The public routes never return a price: prices come only from /prices, computed for
the signed-in customer by app.pricing (with the stock status of the tracked products, app.inventory).
"""
import math
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import quote
from xml.sax.saxutils import escape

from flask import Blueprint, Response, abort, current_app, jsonify, redirect, request
from flask_jwt_extended import current_user, get_jwt, verify_jwt_in_request
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import contains_eager, selectinload

from app import inventory, storage
from app.auth import authenticate, clear_tokens, issue_tokens, read_credentials, refresh_access, require_user, user_type
from app.database.db import db
from app.database.models.catalog import Brand, Category, Product, ProductImage
from app.database.models.content import Article, FaqItem, PageSection, Reseller
from app.database.models.settings import Setting, get_setting
from app.database.models.users import AppUser, BusinessUser
from app.database.wordpress import sanitize_html
from app.pricing import ISRAEL, customer_prices

bp = Blueprint("customers", __name__, url_prefix="/api")

# Languages a translated field may hold; the catalog search looks in all of them.
LOCALES = ("he", "en", "ru", "ar")
# Products per catalog page: the default and the most a client may ask for.
PAGE_SIZE = 24
MAX_PAGE_SIZE = 100
# The catalog's sort orders (absent = the staff order); the price ones need a signed-in business customer.
SORTS = ("name-asc", "name-desc", "newest", "price-asc", "price-desc")
PRICE_SORTS = ("price-asc", "price-desc")
# The home page figures, in display order; each reads the settings stat_<id>_value and stat_<id>_suffix.
STAT_IDS = ("retail", "partners", "products", "years")
# The contact details, each read from the setting contact_<field>.
CONTACT_FIELDS = ("phone", "whatsapp", "email")
# Product page: how many other products of its category it suggests ("You may also like").
RELATED_COUNT = 4
# Sitemap: the URL prefix of each served language (Hebrew, the default, has none) and the pages always listed.
SITEMAP_LOCALES = {"he": "", "en": "/en"}
SITEMAP_PAGES = ("/", "/where-to-buy", "/catalog", "/articles")


def image_json(image: ProductImage) -> dict[str, str]:
    """Shapes a product photo for the catalog cards.

    Args:
        image: The photo.

    Returns:
        {src, thumbnail, srcSet}: the URLs of the stored pictures (the row holds their keys); the thumbnail falls back
        to the full image, the srcset to "".
    """
    return {
        "src": storage.public_url(image.url),
        "thumbnail": storage.public_url(image.thumbnail_url or image.url),
        "srcSet": storage.srcset_urls(image.srcset) or "",
    }


def product_json(product: Product) -> dict[str, Any]:
    """Shapes a product for the catalog list (no price, no description).

    Args:
        product: The product, with its category and images loaded.

    Returns:
        {id, slug, name, category (slug), image (the main photo, or null)}.
    """
    return {
        "id": product.id,
        "slug": product.slug,
        "name": product.name,
        "category": product.category.slug,
        "image": image_json(product.images[0]) if product.images else None,
    }


def escape_like(word: str) -> str:
    """Escapes the LIKE wildcards in a search word, so it matches literally.

    Args:
        word: One word typed in the search box.

    Returns:
        The word with backslash, % and _ escaped (escape character: backslash).
    """
    return word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_conditions(q: str) -> list[ColumnElement[bool]]:
    """Builds the catalog search: every word must appear in the product's name or description, in any language.

    The description is HTML (sanitized, see app/database/wordpress.py): its tags are replaced by spaces, so a word
    matches the text and never a tag name such as "strong" or "table".

    Args:
        q: The search text; words are separated by whitespace. Case is ignored.

    Returns:
        One condition per word (none for an empty text).
    """
    descriptions = (func.regexp_replace(Product.description[locale].astext, "<[^>]*>", " ", "g") for locale in LOCALES)
    text = func.concat_ws(" ", *(Product.name[locale].astext for locale in LOCALES), *descriptions)
    return [text.ilike(f"%{escape_like(word)}%", escape="\\") for word in q.split()]


@bp.get("/categories")
def list_categories() -> list[dict[str, Any]]:
    """The catalog categories (the store's 15), for the catalog's filter chips, the header's Products menu and the
    home page's category cards.

    Returns:
        [{slug, name, legacyPath, imageUrl}] in display order; imageUrl is the URL of the card photo staff set (the row
        stores its object key; None = none).
    """
    categories = db.session.scalars(select(Category).where(Category.is_active).order_by(Category.sort_order, Category.slug))
    return [{"slug": c.slug, "name": c.name, "legacyPath": c.legacy_path, "imageUrl": storage.url_of(c.image_url)} for c in categories]


def signed_in_customer() -> BusinessUser | None:
    """Reads the optional sign-in of a public route: the business customer whose valid access token came along.

    Returns:
        The signed-in business customer, or None for a visitor or a staff member. An expired or invalid token is
        still answered 401 (the client refreshes it and asks again).
    """
    verify_jwt_in_request(optional=True)
    return current_user if get_jwt().get("user_type") == "business" else None


def read_amount(name: str) -> Decimal | None:
    """Reads a shekel amount from the query string (the catalog's price range).

    Args:
        name: The query arg, "min" or "max".

    Returns:
        The amount, or None when it is absent, not a number, negative or not finite.
    """
    try:
        amount = Decimal(request.args.get(name, ""))
    except InvalidOperation:
        return None
    return amount if amount.is_finite() and amount >= 0 else None


def count_matches(column: Any, conditions: list[ColumnElement[bool]]) -> dict[Any, int]:
    """Counts the catalog matches per value of a column (the numbers of the category chips and brand filter).

    Args:
        column: What to group by, e.g. Category.slug or Brand.slug (products without a brand count under None).
        conditions: The filters to count under.

    Returns:
        Column value -> number of matching products.
    """
    query = (
        select(column, func.count(Product.id))
        .select_from(Product)
        .join(Product.category)
        .outerjoin(Product.brand)
        .where(*conditions)
        .group_by(column)
    )
    return dict(db.session.execute(query).all())


def catalog_order(sort: str | None, lang: str) -> tuple[Any, ...]:
    """The ORDER BY of a catalog sort that the database can do (every sort but the price ones).

    Args:
        sort: One of SORTS without the price sorts, or None for the staff order.
        lang: The language whose names the name sorts compare (falls back to Hebrew, which every product has).

    Returns:
        The order clauses, ending with the id so equal values keep a stable order.
    """
    name = func.lower(func.coalesce(Product.name[lang].astext, Product.name["he"].astext))
    if sort == "name-asc":
        return name, Product.id
    if sort == "name-desc":
        return name.desc(), Product.id
    if sort == "newest":
        # Seeded rows share one timestamp: their WooCommerce id keeps the old store's order of creation.
        return Product.created_at.desc(), Product.woocommerce_id.desc().nulls_last(), Product.id
    return Product.sort_order, Product.id


@bp.get("/products")
def list_products() -> dict[str, Any]:
    """One page of the catalog, filtered, searched and sorted.

    Query args: `category` (a category slug; unknown slugs are ignored), `brand` (comma-separated brand slugs, any of
    them; unknown or inactive ones are ignored), `q` (search text), `sort` (one of SORTS; absent or unknown = the staff
    order), `lang` (the language of the name sorts, default he), `min` / `max` (a price range in shekels), `page` (from
    1; clamped to the last page), `pageSize` (1-100, default 24). The price sorts and the price range apply only for a
    signed-in business customer (their own prices, see app.pricing); for anyone else they are ignored, so the order
    and the matches never reveal a price.

    Returns:
        {items, page, pageSize, pageCount, total, category, brands, sort, priceRange, priceBounds, categoryCounts,
        brandCounts}: `items` is the page in the applied order (a price sort puts the products without a price last);
        `total` counts every match; `category`, `brands`, `sort` and `priceRange` ({min, max}, either may be null) are
        what was applied (null / [] = none); `priceBounds` is {min, max} of the customer's prices among the matches
        before the price range (null for visitors, or when none has a price); `categoryCounts` maps every active
        category slug to its matches of every filter but the category, `brandCounts` every active brand slug to its
        matches of every filter but the brand.
    """
    page_size = min(max(request.args.get("pageSize", PAGE_SIZE, type=int), 1), MAX_PAGE_SIZE)
    customer = signed_in_customer()
    prices = customer_prices(customer.id) if customer else None
    base = [Product.is_active, Category.is_active, *search_conditions(request.args.get("q", ""))]

    category_slugs = db.session.scalars(select(Category.slug).where(Category.is_active).order_by(Category.sort_order, Category.slug))
    brand_slugs = db.session.scalars(select(Brand.slug).where(Brand.is_active).order_by(Brand.sort_order, Brand.name))
    category_counts = dict.fromkeys(category_slugs, 0)
    brand_counts = dict.fromkeys(brand_slugs, 0)

    category = request.args.get("category")
    if category not in category_counts:
        category = None
    brands = [slug for slug in brand_counts if slug in request.args.get("brand", "").split(",")]
    category_condition = [Category.slug == category] if category else []
    brand_condition = [Brand.slug.in_(brands)] if brands else []

    price_range = None
    price_condition: list[ColumnElement[bool]] = []
    price_bounds = None
    if prices is not None:
        low, high = read_amount("min"), read_amount("max")
        if low is not None and high is not None and low > high:
            low, high = high, low
        if low is not None or high is not None:
            price_range = {"min": low, "max": high}
            in_range = [pid for pid, price in prices.items() if (low is None or price >= low) and (high is None or price <= high)]
            price_condition = [Product.id.in_(in_range)]
        matched = db.session.scalars(
            select(Product.id).join(Product.category).outerjoin(Product.brand).where(*base, *category_condition, *brand_condition)
        )
        matched_prices = [prices[pid] for pid in matched if pid in prices]
        if matched_prices:
            price_bounds = {"min": min(matched_prices), "max": max(matched_prices)}

    category_counts.update(count_matches(Category.slug, [*base, *brand_condition, *price_condition]))
    brand_counts.update(
        (slug, n) for slug, n in count_matches(Brand.slug, [*base, *category_condition, *price_condition]).items() if slug in brand_counts
    )
    total = category_counts[category] if category else sum(category_counts.values())
    page_count = max(1, math.ceil(total / page_size))
    page = min(max(request.args.get("page", 1, type=int), 1), page_count)
    offset = (page - 1) * page_size

    sort = request.args.get("sort")
    if sort not in SORTS or (sort in PRICE_SORTS and prices is None):
        sort = None
    lang = request.args.get("lang", "he")
    if lang not in LOCALES:
        lang = "he"
    conditions = [*base, *category_condition, *brand_condition, *price_condition]
    query = (
        select(Product)
        .join(Product.category)
        .outerjoin(Product.brand)
        .options(contains_eager(Product.category), selectinload(Product.images))
    )
    if sort in PRICE_SORTS:
        # The prices are computed in Python (app.pricing): sort the matching ids here, then load one page of them.
        ids = db.session.scalars(select(Product.id).join(Product.category).outerjoin(Product.brand).where(*conditions).order_by(*catalog_order(None, lang))).all()
        priced = sorted((pid for pid in ids if pid in prices), key=lambda pid: prices[pid], reverse=sort == "price-desc")
        page_ids = (priced + [pid for pid in ids if pid not in prices])[offset:offset + page_size]
        loaded = {product.id: product for product in db.session.scalars(query.where(Product.id.in_(page_ids)))}
        products = [loaded[pid] for pid in page_ids]
    else:
        products = list(db.session.scalars(query.where(*conditions).order_by(*catalog_order(sort, lang)).offset(offset).limit(page_size)))
    return {
        "items": [product_json(product) for product in products],
        "page": page,
        "pageSize": page_size,
        "pageCount": page_count,
        "total": total,
        "category": category,
        "brands": brands,
        "sort": sort,
        "priceRange": price_range,
        "priceBounds": price_bounds,
        "categoryCounts": category_counts,
        "brandCounts": brand_counts,
    }


def related_products(product: Product) -> list[Product]:
    """The products a product page suggests: the next active ones of its category in catalog order, wrapping round.

    Args:
        product: The product of the page (its category is active).

    Returns:
        Up to RELATED_COUNT other active products of the same category, with their category and images loaded.
    """
    siblings = list(
        db.session.scalars(
            select(Product)
            .where(Product.category_id == product.category_id, Product.is_active)
            .options(selectinload(Product.category), selectinload(Product.images))
            .order_by(Product.sort_order, Product.id)
        )
    )
    index = next(i for i, sibling in enumerate(siblings) if sibling.id == product.id)
    return (siblings[index + 1:] + siblings[:index])[:RELATED_COUNT]


def product_detail_json(product: Product) -> dict[str, Any]:
    """Shapes a product for its own page (still no price: prices come only from /prices).

    Args:
        product: An active product of an active category, with its category, brand and images loaded.

    Returns:
        {id, slug, name, description, sku, barcode, legacyPath, updatedAt, category {slug, name}, brand {slug, name} or
        null (none, or an inactive brand), images [{src, thumbnail, srcSet, alt}] in gallery order, related (catalog
        list items, see product_json)}. Each description is sanitized again on the way out (sanitize_html), so HTML
        typed in the admin can only use the small safe subset; an empty text is left out.
    """
    description = {
        locale: clean
        for locale, html in (product.description or {}).items()
        if html and (clean := sanitize_html(html))
    }
    brand = product.brand
    return {
        "id": product.id,
        "slug": product.slug,
        "name": product.name,
        "description": description,
        "sku": product.sku,
        "barcode": product.barcode,
        "legacyPath": product.legacy_path,
        "updatedAt": product.updated_at.astimezone(ISRAEL).isoformat(),
        "category": {"slug": product.category.slug, "name": product.category.name},
        "brand": {"slug": brand.slug, "name": brand.name} if brand and brand.is_active else None,
        "images": [{**image_json(image), "alt": image.alt} for image in product.images],
        "related": [product_json(other) for other in related_products(product)],
    }


@bp.get("/products/<slug>")
def get_product(slug: str) -> dict[str, Any]:
    """One product, for its page.

    Args:
        slug: The product's URL name.

    Returns:
        The product (see product_detail_json); 404 when it is unknown, inactive or in an inactive category.
    """
    product = db.session.scalar(
        select(Product)
        .join(Product.category)
        .where(Product.slug == slug, Product.is_active, Category.is_active)
        .options(contains_eager(Product.category), selectinload(Product.brand), selectinload(Product.images))
    )
    if product is None:
        abort(404)
    return product_detail_json(product)


def brand_json(brand: Brand) -> dict[str, Any]:
    """Shapes a brand for the home page and its brand page.

    Args:
        brand: The brand.

    Returns:
        {slug, name, accent, tagline, description, logoUrl}; null accent = the site red; logoUrl = the URL of the logo
        staff uploaded (the row stores its key), null = the frontend's bundled logo (or the name as text).
    """
    return {
        "slug": brand.slug,
        "name": brand.name,
        "accent": brand.accent_color,
        "tagline": brand.tagline,
        "description": brand.description,
        "logoUrl": storage.url_of(brand.logo_url),
    }


@bp.get("/brands")
def list_brands() -> list[dict[str, Any]]:
    """The brands, for the home page.

    Returns:
        Every active brand in display order (see brand_json).
    """
    brands = db.session.scalars(select(Brand).where(Brand.is_active).order_by(Brand.sort_order, Brand.name))
    return [brand_json(brand) for brand in brands]


@bp.get("/brands/<slug>")
def get_brand(slug: str) -> dict[str, Any]:
    """One brand, for its brand page.

    Args:
        slug: The brand's URL name, e.g. "jr-farm".

    Returns:
        The brand (see brand_json); 404 when it is unknown or inactive.
    """
    brand = db.session.scalar(select(Brand).where(Brand.slug == slug, Brand.is_active))
    if brand is None:
        abort(404)
    return brand_json(brand)


@bp.get("/stats")
def list_stats() -> list[dict[str, Any]]:
    """The company figures of the home page's Stats band, from the settings staff edit.

    Returns:
        [{id, value, suffix}] in display order (STAT_IDS); a figure without a value setting is left out, a missing
        suffix is "".
    """
    keys = [f"stat_{stat_id}_{part}" for stat_id in STAT_IDS for part in ("value", "suffix")]
    values = dict(db.session.execute(select(Setting.key, Setting.value).where(Setting.key.in_(keys))).all())
    return [
        {"id": stat_id, "value": values[f"stat_{stat_id}_value"], "suffix": values.get(f"stat_{stat_id}_suffix", "")}
        for stat_id in STAT_IDS
        if f"stat_{stat_id}_value" in values
    ]


@bp.get("/contact")
def get_contact() -> dict[str, str]:
    """The customer-service contact details (the Contact section, the WhatsApp button), from the settings staff edit.

    Returns:
        {phone, whatsapp, email} as shown on the site; a field without its setting is "".
    """
    keys = [f"contact_{field}" for field in CONTACT_FIELDS]
    values = dict(db.session.execute(select(Setting.key, Setting.value).where(Setting.key.in_(keys))).all())
    return {field: str(values.get(f"contact_{field}") or "") for field in CONTACT_FIELDS}


@bp.get("/sections")
def list_sections() -> dict[str, Any]:
    """The content staff saved for every editable home page section, for the home page's one loader call.

    Returns:
        {<key>: content} of every saved section; a section never edited is missing (the site shows its built-in
        texts).
    """
    return {section.key: section.content for section in db.session.scalars(select(PageSection))}


@bp.get("/sections/<key>")
def get_section(key: str) -> dict[str, Any]:
    """The content staff saved for one home page section (e.g. the hero's texts, fonts and sizes).

    Args:
        key: The section name, e.g. "hero".

    Returns:
        {key, content, updatedAt}; 404 when the section was never edited (the site then shows its built-in texts).
    """
    section = db.session.get(PageSection, key)
    if section is None:
        abort(404)
    return {"key": section.key, "content": section.content, "updatedAt": section.updated_at.astimezone(ISRAEL).isoformat()}


@bp.get("/faq")
def list_faq() -> list[dict[str, Any]]:
    """The questions of the home page FAQ section, in display order.

    Returns:
        [{id, question, answer}], each text per language ({"he": ..., "en": ...}); the site shows a question in a
        language only when both its texts have that language.
    """
    items = db.session.scalars(select(FaqItem).order_by(FaqItem.sort_order, FaqItem.created_at, FaqItem.id))
    return [{"id": item.id, "question": item.question, "answer": item.answer} for item in items]


def is_published() -> ColumnElement[bool]:
    """The condition for articles the public may see.

    Returns:
        published_at is set and not in the future.
    """
    return Article.published_at.is_not(None) & (Article.published_at <= func.now())


def article_json(article: Article) -> dict[str, Any]:
    """Shapes an article for the articles pages.

    Args:
        article: A published article.

    Returns:
        {slug, topic, publishedAt, updatedAt, title, description, imageAlt, body, relatedCategories, legacyPath};
        the dates are ISO 8601 in Israel time.
    """
    return {
        "slug": article.slug,
        "topic": article.topic,
        "publishedAt": article.published_at.astimezone(ISRAEL).isoformat(),
        "updatedAt": article.updated_at.astimezone(ISRAEL).isoformat(),
        "title": article.title,
        "description": article.description,
        "imageAlt": article.image_alt,
        "body": article.body,
        "relatedCategories": article.related_categories,
        "legacyPath": article.legacy_path,
    }


@bp.get("/articles")
def list_articles() -> list[dict[str, Any]]:
    """The published articles, newest first.

    Returns:
        A list of articles (see article_json).
    """
    articles = db.session.scalars(select(Article).where(is_published()).order_by(Article.published_at.desc(), Article.slug))
    return [article_json(article) for article in articles]


@bp.get("/articles/<slug>")
def get_article(slug: str) -> dict[str, Any]:
    """One published article.

    Args:
        slug: The article's URL name.

    Returns:
        The article (see article_json); 404 when it is unknown or not published.
    """
    article = db.session.scalar(select(Article).where(Article.slug == slug, is_published()))
    if article is None:
        abort(404)
    return article_json(article)


@bp.get("/resellers")
def list_resellers() -> list[dict[str, Any]]:
    """The stores that sell Ultra Pet products, for the Where to Buy list and map.

    Returns:
        [{id, name, address, city, phone, website, lat, lng, approximate}] for every active reseller, by city and
        name; `approximate` = the pin sits at the city centre.
    """
    resellers = db.session.scalars(select(Reseller).where(Reseller.is_active).order_by(Reseller.city, Reseller.name))
    return [
        {
            "id": r.id,
            "name": r.name,
            "address": r.address,
            "city": r.city,
            "phone": r.phone,
            "website": r.website,
            "lat": r.latitude,
            "lng": r.longitude,
            "approximate": r.approximate_location,
        }
        for r in resellers
    ]


@bp.get("/media/<path:key>")
def media(key: str) -> Response:
    """Serves a stored file (a category picture, a product photo, the PDF catalog, ...) from the S3 stub; with real S3 the files have S3 URLs and
    this route goes away (see app/storage.py).

    Args:
        key: The object key, e.g. "categories/3f2a....png".

    Returns:
        The file, cached for a year; 404 when there is no such file.
    """
    return storage.send_object(key)


@bp.get("/catalog.pdf")
def catalog_pdf() -> Response:
    """The downloadable PDF catalog (without prices): a redirect to the file in the storage, so links to
    /api/catalog.pdf stay while every build is a new object. The file is the catalog generated from the products
    (app/catalog_pdf.py; setting `catalog_pdf_files`, one per language) in the language of the query parameter `lang`
    ("he" by default; a language without a file gets the Hebrew one); until the first build it is the file copied
    from the old site (setting `catalog_pdf`).

    Returns:
        302 to the file's URL (never cached, so the next download follows a newer build); 404 when there is none.
    """
    files = get_setting("catalog_pdf_files") or {}
    key = files.get(request.args.get("lang", "he")) or files.get("he") or get_setting("catalog_pdf")
    if not key:
        abort(404)
    response = redirect(storage.public_url(key))
    response.headers["Cache-Control"] = "no-store"
    return response


@bp.get("/sitemap.xml")
def sitemap() -> Response:
    """The sitemap for search engines: every public page, published article and product page in each language, with hreflang
    alternates. Served at /sitemap.xml (the Vite dev proxy, and the production server, forward it here).

    Returns:
        The XML document (application/xml).
    """
    site = current_app.config["SITE_URL"]
    articles = db.session.execute(
        select(Article.slug, Article.updated_at).where(is_published()).order_by(Article.published_at.desc())
    )
    products = db.session.execute(
        select(Product.slug, Product.updated_at)
        .join(Product.category)
        .where(Product.is_active, Category.is_active)
        .order_by(Category.sort_order, Product.sort_order, Product.id)
    )
    pages = (
        [(page, None) for page in SITEMAP_PAGES]
        + [(f"/articles/{slug}", updated_at.astimezone(ISRAEL).date().isoformat()) for slug, updated_at in articles]
        # Product slugs keep the old store's Hebrew words: percent-encoded, as a URL in a sitemap must be.
        + [(f"/products/{quote(slug)}", updated_at.astimezone(ISRAEL).date().isoformat()) for slug, updated_at in products]
    )

    def url(page: str, prefix: str) -> str:
        """The absolute URL of a page in one language (the prefixed home page has no trailing slash).

        Args:
            page: The internal path, e.g. "/catalog".
            prefix: The language prefix, e.g. "/en", or "" for Hebrew.

        Returns:
            The escaped absolute URL.
        """
        return escape(f"{site}{prefix}{'' if page == '/' and prefix else page}")

    entries = [
        "\n".join(
            [
                "  <url>",
                f"    <loc>{url(page, prefix)}</loc>",
                *([f"    <lastmod>{lastmod}</lastmod>"] if lastmod else []),
                *(
                    f'    <xhtml:link rel="alternate" hreflang="{lang}" href="{url(page, p)}"/>'
                    for lang, p in SITEMAP_LOCALES.items()
                ),
                f'    <xhtml:link rel="alternate" hreflang="x-default" href="{url(page, "")}"/>',
                "  </url>",
            ]
        )
        for page, lastmod in pages
        for prefix in SITEMAP_LOCALES.values()
    ]
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    return Response(xml, mimetype="application/xml")


def session_json(user: AppUser) -> dict[str, Any]:
    """Shapes the signed-in user (a customer or a staff member) for the frontend's session.

    Args:
        user: The business or staff user.

    Returns:
        {kind, email, fullName, companyName}; kind is "business" or "staff", companyName is null for staff.
    """
    company = user.company_name if isinstance(user, BusinessUser) else None
    return {"kind": user_type(user), "email": user.email, "fullName": user.full_name, "companyName": company}


@bp.post("/auth/login")
def login() -> Response | tuple[Response, int]:
    """Signs a business customer or a staff member in. Body: {email, password, remember}.

    Returns:
        {user} with the JWT cookies set; 401 {"error": "invalid_credentials"} when the email, password or account
        does not match an active user.
    """
    email, password, remember = read_credentials()
    user = authenticate(AppUser, email, password)
    if user is None:
        return jsonify(error="invalid_credentials"), 401
    return issue_tokens(jsonify(user=session_json(user)), user, remember)


@bp.post("/auth/refresh")
def refresh() -> Response:
    """Issues a new access token from the refresh cookie (the frontend calls it after a "token_expired" answer).

    Returns:
        204 with a new access cookie; 401 when the refresh token is missing, expired or the CSRF header is wrong.
    """
    return refresh_access(Response(status=204))


@bp.post("/auth/logout")
def logout() -> Response:
    """Signs out (no token needed, so an expired sign-in can always be cleared).

    Returns:
        204 with every JWT cookie expired.
    """
    return clear_tokens(Response(status=204))


@bp.get("/auth/me")
def me() -> dict[str, Any]:
    """Who is signed in; the frontend asks on every page load.

    Returns:
        {user} for a signed-in customer or staff member; 401 when signed out or expired.
    """
    verify_jwt_in_request()
    return {"user": session_json(current_user)}


@bp.get("/prices")
def prices() -> dict[str, Any]:
    """The signed-in customer's price of every product they can buy (the catalog shows them on the cards), and the
    stock status of the products whose stock is tracked (never the units: see app.inventory).

    Returns:
        {currency, prices: {product id: unit price in shekels before VAT}, stock: {product id: "in" | "low" | "out"}};
        products without a price are left out of `prices`, untracked ones out of `stock` (always orderable).
        401 when signed out, 403 for a staff token.
    """
    user = require_user("business")
    return {
        "currency": get_setting("currency", "ILS"),
        "prices": {str(product_id): price for product_id, price in customer_prices(user.id).items()},
        "stock": {str(product_id): status for product_id, status in inventory.customer_stock().items()},
    }
