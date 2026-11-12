"""wordpress.py — `flask export-wordpress`: refreshes the seed stubs (frontend/src/stubs/) from the old WordPress /
WooCommerce site, www.ultrapet.co.il, through its public read-only endpoints.

The first export (Oct 2026) kept one photo per product, a shortened plain-text description and no variations. This
command fills those gaps (see WORDPRESS.md at the repository root for everything the old site holds):
- every photo of a product's gallery, in WordPress order (each with its sized copies, as object keys of our file
  storage; new files are added to legacy-media.json, so `flask import-media` copies them);
- the full description, as sanitized HTML (the headings, lists and feeding tables of the WordPress product page);
- one product per variation of the variable products (e.g. Greenheart 3 kg and 12 kg; scratching posts in grey and
  beige): the first variation keeps the parent's WooCommerce id, slug and old URL, the others get the variation's id;
- the brand (a keyword map over the product name) and the item code ("מק"ט 941", a trailing "(1128149)" or
  "- 08396") as the sku, and the package barcode a description mentions ("ברקוד מוצר: 7290011072026");
- the legal and about pages, as sanitized HTML (pages.json, for the legal pages; not seeded yet).

It only sends GET requests to public URLs (the WooCommerce Store API, the WordPress pages API): nothing is written on
the old site and no credentials are needed. The stubs are merged, not overwritten: English texts are kept while their
Hebrew source is unchanged; the command prints the products whose English needs a new translation (it keeps the old
English meanwhile). The backend container mounts the stubs read-only, so it runs with `--out <dir>` there and the
files are copied over (see WORDPRESS.md).
"""
import hashlib
import html
import json
import re
from collections.abc import Callable
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urlsplit, urlunsplit
from urllib.request import Request, urlopen

import click

from app.database.seed import STUBS_DIR, read_json

SITE = "https://www.ultrapet.co.il"
STORE_PRODUCTS = SITE + "/wp-json/wc/store/v1/products"
PAGES_API = SITE + "/wp-json/wp/v2/pages"
UPLOADS = SITE + "/wp-content/uploads/"
# A generic client name for the old site's server logs.
USER_AGENT = "UltraPetImport/1.0"
TIMEOUT_SECONDS = 60
# The sized copies the stubs keep in a photo's srcset (WordPress makes more; the catalog needs these).
SRCSET_WIDTHS = (300, 768, 500)

# The brand of a product, from its name: (brand slug, pattern), the first match wins (Ultra Clean before Ultra Pet).
BRAND_PATTERNS = [
    ("ultra-clean", r"ULTRA ?CLEAN|אולטרה ?קלין"),
    ("ultra-pet", r"ULTRA ?PET|אולטרה"),
    ("jr-farm", r"\bJR\b"),
    ("paw", r"\bPAW\b"),
    ("internutri", r"INTERNUTRI|אינטר ?נוטרי"),
    ("greenheart", r"GREEN ?HEART|גרין ?הארט"),
    ("lino", r"\bLINO\b"),
    ("yagu", r"\bYAGU\b"),
    ("pet-fan", r"PET ?FAN|פט ?פאן"),
    ("lizi", r"LIZI|ליזי"),
    ("specialcan", r"\bSPECIALCAN\b"),
    ("petpall", r"\bPETPALL\b"),
]

# The item code inside a product name: "מק"ט 941", a trailing "(1128149)" / "(P0314)", or a trailing "- 08396".
ITEM_CODE = re.compile(
    r'מק"ט\s*:?\s*([A-Za-z]?\d[\dA-Za-z-]*)|\(\s*([A-Za-z]?\d[\dA-Za-z]*)\s*\)\s*$|[-–]\s*(\d{4,7})\s*$'
)

# The barcode written in a description: an 8-14 digit number shortly after "ברקוד" / "barcode" / "EAN".
BARCODE = re.compile(r"(?:ברקוד|barcode|EAN)[^0-9<]{0,25}(\d{8,14})(?!\d)", re.IGNORECASE)

# English for the variation values (attribute value -> English), used to name the split products.
VARIATION_EN = {"אפור": "Grey", "בז'": "Beige", '3 ק"ג': "3 kg", '12 ק"ג': "12 kg", "10L": "10 L", "20L": "20 L"}
# The English endings a split product's name gets (" – 3 kg"), recognized so a later export does not add another.
VARIATION_SUFFIXES = tuple(f" – {value}" for value in (*VARIATION_EN.values(), *VARIATION_EN))

# The WordPress pages copied into pages.json: WordPress slug (decoded) -> our key.
PAGES = {
    "אודות": "about",
    "תקנון-ותנאי-שימוש": "terms",
    "הצהרת-נגישות": "accessibility",
    "refund_returns": "refund-returns",
    "privacy-policy": "privacy",
}

# Sanitized HTML: the tags kept (no attributes), the ones renamed, and the ones dropped with their content.
TEXT_BLOCKS = {"p", "h2", "h3", "h4"}
INLINE = {"strong", "em", "br"}
CELLS = {"th", "td"}
KEPT = TEXT_BLOCKS | INLINE | CELLS | {"ul", "ol", "li", "table", "thead", "tbody", "tr"}
RENAMED = {"h1": "h2", "h5": "h4", "h6": "h4", "b": "strong", "i": "em"}
DROPPED = {"script", "style", "noscript", "svg", "iframe", "form", "button", "select", "textarea", "template"}
# Unknown tags that end a paragraph (their inline content becomes its own paragraph); other unknown tags are unwrapped.
BREAKING = {"div", "section", "article", "header", "footer", "main", "aside", "blockquote", "figure", "figcaption",
            "pre", "address", "center", "hr", "dl", "dt", "dd"}


def fetch_json(url: str) -> Any:
    """Fetches one public JSON document from the old site (GET only).

    Args:
        url: The URL; a Hebrew path is percent-encoded here.

    Returns:
        The parsed JSON.

    Raises:
        OSError: The request failed (urllib's errors are OSErrors).
    """
    parts = urlsplit(url)
    request = Request(urlunsplit(parts._replace(path=quote(unquote(parts.path)))), headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310 (https URLs of the old site only)
        return json.load(response)


def fetch_all(url: str, fetch: Callable[[str], Any]) -> list[Any]:
    """Reads every page of a paged WordPress / WooCommerce list (100 per page) until an empty page.

    Args:
        url: The list URL without paging parameters.
        fetch: Fetches one URL as JSON (fetch_json, or a fake in the tests).

    Returns:
        All the items, in the API's order.
    """
    items: list[Any] = []
    page = 1
    while True:
        batch = fetch(f"{url}{'&' if '?' in url else '?'}per_page=100&page={page}")
        if not batch:
            return items
        items.extend(batch)
        if len(batch) < 100:
            return items
        page += 1


class _Node:
    """One element of the parsed HTML: a tag name (or None for the root) and its children (nodes and strings)."""

    def __init__(self, tag: str | None) -> None:
        """Creates an empty element.

        Args:
            tag: The kept tag name, "break" for a paragraph-ending unknown tag, or None for the root.
        """
        self.tag = tag
        self.children: list["_Node | str"] = []


class _TreeBuilder(HTMLParser):
    """Parses HTML into a tree of the kept tags only (see sanitize_html)."""

    def __init__(self) -> None:
        """Starts with an empty root."""
        super().__init__(convert_charrefs=True)
        self.root = _Node(None)
        self.stack = [self.root]
        self.skipping = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        """Opens a kept or paragraph-ending element; skips dropped ones with their content.

        Args:
            tag: The tag name.
            attrs: Its attributes (all dropped).
        """
        if self.skipping or tag in DROPPED:
            self.skipping += tag in DROPPED and tag not in {"br", "hr"}
            return
        tag = RENAMED.get(tag, tag)
        if tag in {"br", "hr"}:
            self.stack[-1].children.append(_Node("br" if tag == "br" else "break"))
            return
        if tag in KEPT or tag in BREAKING:
            node = _Node(tag if tag in KEPT else "break")
            self.stack[-1].children.append(node)
            self.stack.append(node)

    def handle_endtag(self, tag: str) -> None:
        """Closes the innermost open element of that tag (and any left open inside it).

        Args:
            tag: The tag name.
        """
        if self.skipping:
            self.skipping -= tag in DROPPED
            return
        tag = RENAMED.get(tag, tag)
        name = tag if tag in KEPT else "break" if tag in BREAKING else None
        if name is None or tag == "br":
            return
        for depth in range(len(self.stack) - 1, 0, -1):
            if self.stack[depth].tag == name:
                del self.stack[depth:]
                return

    def handle_data(self, data: str) -> None:
        """Adds text to the open element.

        Args:
            data: The text, entities already decoded.
        """
        if not self.skipping:
            self.stack[-1].children.append(data)


def _inline(children: list["_Node | str"]) -> str:
    """Renders content as inline HTML: escaped text, <strong>, <em>, <br>; any block inside is flattened to its text.

    Args:
        children: The nodes.

    Returns:
        The HTML, whitespace collapsed (not trimmed).
    """
    out = []
    for child in children:
        if isinstance(child, str):
            out.append(html.escape(re.sub(r"\s+", " ", child.replace("\xa0", " ")), quote=False))
        elif child.tag == "br":
            out.append("<br>")
        elif child.tag in {"strong", "em"}:
            inner = _inline(child.children)
            if inner.strip():
                out.append(f"<{child.tag}>{inner}</{child.tag}>")
            else:
                out.append(inner)
        else:
            out.append(" " + _inline(child.children) + " ")
    return "".join(out)


def _trim(fragment: str) -> str:
    """Trims an inline fragment: outer whitespace, leading and trailing <br>, doubled spaces.

    Args:
        fragment: Inline HTML from _inline.

    Returns:
        The trimmed fragment ("" when it holds no text).
    """
    fragment = re.sub(r" {2,}", " ", fragment)
    fragment = re.sub(r"^(\s|<br>)+|(\s|<br>)+$", "", fragment)
    return fragment if re.sub(r"<[^>]+>", "", fragment).strip() else ""


def _list(node: _Node) -> str:
    """Renders a <ul>/<ol>: one <li> per item (stray text becomes an item), nested lists kept.

    Args:
        node: The list element.

    Returns:
        The HTML, or "" when it has no item with text.
    """
    items = []
    for child in node.children:
        children = child.children if isinstance(child, _Node) and child.tag == "li" else [child]
        text = _trim(_inline([c for c in children if not (isinstance(c, _Node) and c.tag in {"ul", "ol"})]))
        nested = "".join(_list(c) for c in children if isinstance(c, _Node) and c.tag in {"ul", "ol"})
        if text or nested:
            items.append(f"<li>{text}{nested}</li>")
    return f"<{node.tag}>{''.join(items)}</{node.tag}>" if items else ""


def _rows(node: _Node) -> list[str]:
    """Renders the rows under a table part (tr anywhere inside it).

    Args:
        node: A table, thead or tbody element.

    Returns:
        The <tr> HTML of each row with at least one non-empty cell.
    """
    rows = []
    for child in node.children:
        if not isinstance(child, _Node):
            continue
        if child.tag == "tr":
            cells = [c for c in child.children if isinstance(c, _Node) and c.tag in CELLS]
            rendered = [f"<{c.tag}>{_trim(_inline(c.children))}</{c.tag}>" for c in cells]
            if any(_trim(_inline(c.children)) for c in cells):
                rows.append(f"<tr>{''.join(rendered)}</tr>")
        elif child.tag not in {"thead", "tbody"}:
            rows.extend(_rows(child))
    return rows


def _table(node: _Node) -> str:
    """Renders a table with its header and body rows.

    Args:
        node: The table element.

    Returns:
        The HTML, or "" when it has no row with text.
    """
    head = [r for c in node.children if isinstance(c, _Node) and c.tag == "thead" for r in _rows(c)]
    body = _rows(node) + [r for c in node.children if isinstance(c, _Node) and c.tag == "tbody" for r in _rows(c)]
    if not head and not body:
        return ""
    return "<table>" + (f"<thead>{''.join(head)}</thead>" if head else "") + (f"<tbody>{''.join(body)}</tbody>" if body else "") + "</table>"


def _blocks(children: list["_Node | str"], wrap: str = "p") -> list[str]:
    """Renders content as block HTML: runs of inline content become <wrap> elements, blocks render themselves.

    Args:
        children: The nodes.
        wrap: The tag that wraps a run of inline content ("p", or the heading a run belongs to).

    Returns:
        The HTML of each block, in order.
    """
    out: list[str] = []
    run: list["_Node | str"] = []

    def flush() -> None:
        """Wraps the pending inline run, if it holds text."""
        text = _trim(_inline(run))
        if text:
            out.append(f"<{wrap}>{text}</{wrap}>")
        run.clear()

    for child in children:
        if isinstance(child, str) or child.tag in INLINE:
            run.append(child)
            continue
        flush()
        if child.tag in TEXT_BLOCKS:
            out.extend(_blocks(child.children, child.tag))
        elif child.tag in {"ul", "ol"}:
            out.append(_list(child))
        elif child.tag == "table":
            out.append(_table(child))
        else:
            out.extend(_blocks(child.children, wrap))
    flush()
    return [block for block in out if block]


def sanitize_html(source: str) -> str:
    """Turns WordPress HTML into the small HTML subset the new site stores and renders.

    Kept: p, h2-h4 (h1 -> h2, h5/h6 -> h4), ul/ol/li, table/thead/tbody/tr/th/td, strong/em (b/i renamed), br; no
    attributes. Scripts, styles, forms and the like are dropped with their content; other tags are unwrapped (divs and
    other block tags end a paragraph). Empty elements are removed and whitespace is collapsed.

    Args:
        source: The HTML (e.g. a product's description from the Store API).

    Returns:
        The sanitized HTML, one block per line ("" when there is no text).
    """
    builder = _TreeBuilder()
    builder.feed(source or "")
    builder.close()
    return "\n".join(_blocks(builder.root.children))


def html_text(fragment: str) -> str:
    """The plain text of an HTML fragment (tags removed, entities decoded, whitespace collapsed).

    Args:
        fragment: HTML.

    Returns:
        The text.
    """
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment or ""))).strip()


def full_description(product: dict[str, Any]) -> str:
    """A product's whole description: the short description (the main text of the old product page) followed by the
    long one when it adds text the short one does not already hold.

    Args:
        product: A Store API product.

    Returns:
        Sanitized HTML ("" when the product has no description).
    """
    short = sanitize_html(product.get("short_description", ""))
    long = sanitize_html(product.get("description", ""))
    if long and html_text(long) not in html_text(short):
        return f"{short}\n{long}".strip()
    return short


def brand_of(name: str) -> str | None:
    """Finds the brand of a product from its name (BRAND_PATTERNS).

    Args:
        name: The product's Hebrew name.

    Returns:
        The brand slug, or None when no pattern matches.
    """
    for slug, pattern in BRAND_PATTERNS:
        if re.search(pattern, name, re.IGNORECASE):
            return slug
    return None


def item_code(name: str) -> str | None:
    """Finds the item code written in a product name (ITEM_CODE).

    Args:
        name: The product's Hebrew name.

    Returns:
        The code (e.g. "08396", "1128149", "P0314"), or None.
    """
    match = ITEM_CODE.search(name.replace("‏", "").strip())
    return next((group for group in match.groups() if group), None) if match else None


def barcode_of(description: str) -> str | None:
    """Finds the package barcode written in a product description (BARCODE).

    Args:
        description: The description (HTML or text).

    Returns:
        The first barcode (e.g. "7290011072026"), or None.
    """
    match = BARCODE.search(html_text(description))
    return match.group(1) if match else None


def unique_only(products: list[dict[str, Any]], field: str) -> None:
    """Clears a code that more than one product carries (it cannot identify either of them).

    Args:
        products: The stub products; changed in place.
        field: "sku" or "barcode".
    """
    counts: dict[str, int] = {}
    for item in products:
        if item[field]:
            counts[item[field]] = counts.get(item[field], 0) + 1
    for item in products:
        if item[field] and counts[item[field]] > 1:
            item[field] = None


def media_key(url: str, known: dict[str, str]) -> str:
    """The object key a WordPress upload is stored under (the same scheme as the first export).

    A known URL keeps its key. A new one becomes products/<yyyy>-<mm>-<file name> (storage.KEY_PATTERN: letters,
    digits, "_" and "-"; a lowercase extension): other ASCII characters such as dots become "-"; a name with other
    letters (Hebrew) is reduced to its ASCII letters and digits plus the first 8 hex digits of the URL's SHA-1, and so
    is a name whose key another URL already has, so two files never share a key.

    Args:
        url: The upload's URL (https://www.ultrapet.co.il/wp-content/uploads/<yyyy>/<mm>/<file>).
        known: URL -> key of the files already in the manifest.

    Returns:
        The object key.
    """
    if url in known:
        return known[url]
    year, month, name = unquote(url.split("/wp-content/uploads/", 1)[1]).split("/", 2)
    stem, _, ext = name.rpartition(".")
    digest = hashlib.sha1(url.encode()).hexdigest()[:8]
    clean = re.sub(r"[^A-Za-z0-9_-]+", "-", stem).strip("-")
    if not stem.isascii() or not clean:
        clean = re.sub(r"[^A-Za-z0-9]+", "-", stem).strip("-")
        clean = f"{clean}-{digest}" if clean else digest
    key = f"products/{year}-{month}-{clean}.{ext.lower()}"
    if key in known.values():
        key = f"products/{year}-{month}-{clean}-{digest}.{ext.lower()}"
    return key


def image_entry(image: dict[str, Any], name: str, known: dict[str, str], manifest: dict[str, str]) -> dict[str, Any]:
    """Turns a Store API photo into a stub photo of object keys, adding its files to the manifest.

    Args:
        image: The Store API image ({src, thumbnail, srcset, alt}).
        name: The product's Hebrew name (the alt text when WordPress has none).
        known: URL -> key of the files already in the manifest.
        manifest: Key -> URL; the photo's files are added to it.

    Returns:
        {src, thumbnail, srcSet, alt: {he}} with object keys; srcSet keeps the SRCSET_WIDTHS copies.
    """
    def keep(url: str) -> str:
        """Records one file in the manifest.

        Args:
            url: The upload's URL.

        Returns:
            Its object key.
        """
        key = media_key(url, known)
        manifest[key] = url
        known[url] = key
        return key

    srcset = []
    for part in (image.get("srcset") or "").split(","):
        url, _, width = part.strip().rpartition(" ")
        if url and width.rstrip("w").isdigit() and int(width.rstrip("w")) in SRCSET_WIDTHS and url != image["src"]:
            srcset.append(f"{keep(url)} {width}")
    return {
        "src": keep(image["src"]),
        "thumbnail": keep(image["thumbnail"]) if image.get("thumbnail") else None,
        "srcSet": ", ".join(srcset) or None,
        "alt": {"he": html.unescape(image.get("alt") or "") or name},
    }


def localized(he: str, old: dict[str, str] | None, en: str | None = None) -> tuple[dict[str, str], bool]:
    """Builds a {he, en} text, keeping the old English while the Hebrew is unchanged.

    Args:
        he: The Hebrew text from WordPress.
        old: The stub's current {he, en}, or None for a new text.
        en: An English text to use instead (e.g. built for a variation), or None.

    Returns:
        ({he, en}, needs_translation): needs_translation is True when the English is missing or its Hebrew changed
        (the old English is kept meanwhile, when there is one); an empty Hebrew text gets an empty English one.
    """
    if en is not None:
        return {"he": he, "en": en}, False
    if not he:
        return {"he": "", "en": ""}, False
    if old and old.get("he") == he and old.get("en"):
        return {"he": he, "en": old["en"]}, False
    return {"he": he, "en": (old or {}).get("en") or he}, True


def build_products(
    store: list[dict[str, Any]],
    variations: dict[int, dict[str, Any]],
    old_products: list[dict[str, Any]],
    categories: list[dict[str, Any]],
    manifest: dict[str, str],
) -> tuple[list[dict[str, Any]], list[str]]:
    """Builds the new products.json from the Store API products, merged into the current stub.

    The stub's order and category are kept (new products go last, with the category of their first WordPress
    category); a variable product with two or more variations becomes one product per variation (see the module
    docstring); item codes and barcodes that occur more than once are not used.

    Args:
        store: Every published product of the Store API.
        variations: Variation id -> the Store API variation (images, the "variation" label).
        old_products: The current products.json.
        categories: The current product-categories.json (slug, legacyPath).
        manifest: Key -> URL of the media; every photo used is added to it.

    Returns:
        (products, needs_translation): the stub products, and the ids whose English name or description must be
        translated again.
    """
    known = {url: key for key, url in manifest.items()}
    old = {item["id"]: item for item in old_products}
    by_path = {unquote(c["legacyPath"]): c["slug"] for c in categories if c.get("legacyPath")}
    order = {item["id"]: index for index, item in enumerate(old_products)}
    store = sorted(store, key=lambda p: (order.get(str(p["id"]), len(order)), p["id"]))
    products: list[dict[str, Any]] = []
    needs: list[str] = []

    for product in store:
        pid = str(product["id"])
        previous = old.get(pid)
        he_name = html.unescape(product["name"]).strip()
        category = previous["category"] if previous else next(
            (by_path.get(f"/product-category/{unquote(c['slug'])}/") for c in product.get("categories", [])), None
        )
        description, desc_new = localized(full_description(product), (previous or {}).get("description"))
        base = {
            "category": category,
            "legacyPath": (previous or {}).get("legacyPath") or "/" + unquote(product["permalink"].split(SITE + "/", 1)[1]),
        }
        variants = sorted(product.get("variations") or [], key=lambda v: v["id"])
        if product.get("type") == "variable" and len(variants) >= 2:
            variant_images = {img["src"] for v in variants for img in variations[v["id"]].get("images", [])}
            shared = [img for img in product.get("images", []) if img["src"] not in variant_images]
            for index, variant in enumerate(variants):
                data = variations[variant["id"]]
                value = html.unescape(data.get("variation", "")).split(": ", 1)[-1].strip()
                name_he = f"{he_name} – {value}"
                # The parent's English name; after an earlier export it is the first variation's, so drop its suffix.
                base_en = ((previous or {}).get("name") or {}).get("en") or ""
                while base_en.endswith(VARIATION_SUFFIXES):
                    base_en = base_en.rsplit(" – ", 1)[0]
                name_en = f"{base_en} – {VARIATION_EN.get(value, value)}" if base_en else None
                vid = pid if index == 0 else str(variant["id"])
                vslug = (previous or {}).get("slug") or unquote(product["slug"])
                name, name_new = localized(name_he, old.get(vid, {}).get("name") if index else None, name_en)
                products.append({
                    "id": vid,
                    "slug": vslug if index == 0 else f"{vslug}-{re.sub(r'[^0-9A-Za-zא-ת]+', '-', value).strip('-').lower()}",
                    "name": name,
                    "description": description,
                    "category": base["category"],
                    "brand": brand_of(he_name),
                    "sku": item_code(he_name),
                    "images": [image_entry(img, name_he, known, manifest) for img in data.get("images", []) + shared],
                    "legacyPath": base["legacyPath"] if index == 0 else None,
                })
                if desc_new or name_new:
                    needs.append(vid)
            continue
        name, name_new = localized(he_name, (previous or {}).get("name"))
        products.append({
            "id": pid,
            "slug": (previous or {}).get("slug") or unquote(product["slug"]),
            "name": name,
            "description": description,
            "category": base["category"],
            "brand": brand_of(he_name),
            "sku": item_code(he_name),
            "images": [image_entry(img, he_name, known, manifest) for img in product.get("images", [])],
            "legacyPath": base["legacyPath"],
        })
        if desc_new or name_new:
            needs.append(pid)

    for item in products:
        item["barcode"] = barcode_of(item["description"]["he"])
    unique_only(products, "sku")
    unique_only(products, "barcode")
    return products, needs


def build_pages(pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Builds pages.json: the about and legal pages of the old site, as sanitized Hebrew HTML.

    Args:
        pages: The WordPress pages API list (slug, title, content, modified, link).

    Returns:
        [{key, title: {he}, body: {he}, updatedAt, legacyPath}] in PAGES order.
    """
    by_slug = {unquote(page["slug"]): page for page in pages}
    out = []
    for slug, key in PAGES.items():
        page = by_slug.get(slug)
        if page:
            out.append({
                "key": key,
                "title": {"he": html.unescape(page["title"]["rendered"]).strip()},
                "body": {"he": sanitize_html(page["content"]["rendered"])},
                "updatedAt": page["modified"],
                "legacyPath": f"/{slug}/",
            })
    return out


def build_prices(prices: dict[str, Any], products: list[dict[str, Any]], old_products: list[dict[str, Any]]) -> dict[str, Any]:
    """Gives every new product (a split variation) the placeholder price of the product it came from.

    Args:
        prices: The current prices.json ({currency, placeholder, prices: {id: price}}).
        products: The new products.
        old_products: The current products.json (to find a variation's parent by its old URL).

    Returns:
        The updated prices.json content.
    """
    by_slug = {item["slug"]: item["id"] for item in old_products}
    table = dict(prices["prices"])
    for item in products:
        if item["id"] not in table:
            parent = next((pid for slug, pid in by_slug.items() if item["slug"].startswith(slug + "-")), None)
            if parent in table:
                table[item["id"]] = table[parent]
    return {**prices, "prices": {item["id"]: table[item["id"]] for item in products if item["id"] in table}}


def export_wordpress(fetch: Callable[[str], Any], stubs: Path) -> dict[str, Any]:
    """Reads the old site and builds the refreshed stubs (nothing is written here).

    Args:
        fetch: Fetches one URL as JSON (fetch_json, or a fake in the tests).
        stubs: The folder of the current stubs.

    Returns:
        {file name: new content} for products.json, prices.json, legacy-media.json and pages.json, plus
        "needs_translation": the product ids whose English must be translated again.
    """
    store = fetch_all(STORE_PRODUCTS, fetch)
    variations = {
        variant["id"]: fetch(f"{STORE_PRODUCTS}/{variant['id']}")
        for product in store
        if product.get("type") == "variable" and len(product.get("variations") or []) >= 2
        for variant in product["variations"]
    }
    manifest = read_json(stubs / "legacy-media.json")
    old_products = read_json(stubs / "products.json")
    products, needs = build_products(store, variations, old_products, read_json(stubs / "product-categories.json"), manifest)
    pages = build_pages(fetch_all(PAGES_API + "?_fields=slug,title,content,modified", fetch))
    return {
        "products.json": products,
        "prices.json": build_prices(read_json(stubs / "prices.json"), products, old_products),
        "legacy-media.json": manifest,
        "pages.json": pages,
        "needs_translation": needs,
    }


@click.command("export-wordpress")
@click.option("--out", "out_dir", type=click.Path(file_okay=False, path_type=Path), default=STUBS_DIR,
              help="Where to write the refreshed stubs (default: frontend/src/stubs; the container mounts it "
                   "read-only, so pass e.g. /tmp/wp there and copy the files over).")
def export_wordpress_command(out_dir: Path) -> None:
    """Refreshes the product, price, media and page stubs from the old WordPress site's public APIs (see
    export_wordpress) and lists the products whose English needs a new translation.

    Args:
        out_dir: The output folder.
    """
    result = export_wordpress(fetch_json, STUBS_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, content in result.items():
        if name.endswith(".json"):
            (out_dir / name).write_text(json.dumps(content, ensure_ascii=False, indent=2 if name == "legacy-media.json" else 1) + "\n", encoding="utf-8")
    products = result["products.json"]
    click.echo(
        f"Wrote {len(products)} products ({sum(len(p['images']) for p in products)} photos, "
        f"{sum(1 for p in products if p['sku'])} skus, {sum(1 for p in products if p['barcode'])} barcodes, {sum(1 for p in products if p['brand'])} brands), "
        f"{len(result['legacy-media.json'])} media files, {len(result['pages.json'])} pages to {out_dir}."
    )
    click.echo(f"English to translate again ({len(result['needs_translation'])}): {' '.join(result['needs_translation'])}")
