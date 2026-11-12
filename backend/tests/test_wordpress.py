"""test_wordpress.py — `flask export-wordpress` (app/database/wordpress.py): sanitizing the old site's HTML, reading item
codes, barcodes and brands from product names, object keys of new photos, splitting variable products, merging into
the stubs (keeping the English) and the paged reads, with a fake fetch (the tests never reach the network).
"""
import json
from pathlib import Path

import pytest

from app.database.wordpress import (
    PAGES_API,
    STORE_PRODUCTS,
    barcode_of,
    brand_of,
    build_pages,
    build_products,
    export_wordpress,
    fetch_all,
    item_code,
    media_key,
    sanitize_html,
)

UPLOADS = "https://www.ultrapet.co.il/wp-content/uploads/"


def store_image(name: str, alt: str = "") -> dict:
    """A Store API photo with its 300 / 500 / 768 / 1024 px copies.

    Args:
        name: The file name without extension, under 2026/05.
        alt: Its alt text in WordPress.

    Returns:
        The image as the Store API returns it.
    """
    base = f"{UPLOADS}2026/05/{name}"
    sizes = ", ".join(f"{base}-{w}x{w}.jpg {w}w" for w in (300, 1024, 768, 500))
    return {"src": f"{base}.jpg", "thumbnail": f"{base}-300x300.jpg", "srcset": f"{base}.jpg 1500w, {sizes}", "alt": alt}


def store_product(pid: int, name: str, **extra) -> dict:
    """A published simple product as the Store API returns it.

    Args:
        pid: Its WooCommerce id.
        name: Its Hebrew name (HTML-escaped like the API).
        **extra: Fields to override (type, variations, images, descriptions, ...).

    Returns:
        The product.
    """
    return {
        "id": pid,
        "name": name,
        "slug": f"p{pid}",
        "type": "simple",
        "permalink": f"https://www.ultrapet.co.il/product/p{pid}/",
        "short_description": "<p>תיאור</p>",
        "description": "",
        "categories": [{"slug": "%d7%9b%d7%9c%d7%91%d7%99%d7%9d"}],
        "images": [store_image(f"photo{pid}")],
        "variations": [],
        **extra,
    }


CATEGORIES = [{"slug": "dry-dog-food", "name": {"he": "מזון יבש לכלבים", "en": "Dry Dog Food"}, "legacyPath": "/product-category/כלבים/"}]


def test_sanitize_keeps_structure_and_drops_the_rest():
    source = (
        '<div class="x"><h1 style="a">כותרת</h1><div>שורה <b>מודגשת</b><br> ועוד</div>'
        "<script>alert(1)</script><p></p><p>&nbsp;</p>"
        '<ul><li><span>אחד</span></li><li></li><li>שניים<ul><li>פנימי</li></ul></li></ul>'
        '<table class="t"><thead><tr><th>משקל</th><th>כמות</th></tr></thead><tbody><tr><td>2 ק"ג</td><td>30 גרם</td></tr>'
        "<tr><td></td><td> </td></tr></tbody></table><a href='https://x'>קישור</a> &lt;tag&gt;</div>"
    )
    assert sanitize_html(source) == "\n".join([
        "<h2>כותרת</h2>",
        "<p>שורה <strong>מודגשת</strong><br> ועוד</p>",
        "<ul><li>אחד</li><li>שניים<ul><li>פנימי</li></ul></li></ul>",
        '<table><thead><tr><th>משקל</th><th>כמות</th></tr></thead><tbody><tr><td>2 ק"ג</td><td>30 גרם</td></tr></tbody></table>',
        "<p>קישור &lt;tag&gt;</p>",
    ])
    assert sanitize_html("") == ""
    assert sanitize_html("<style>p{}</style><div> </div>") == ""


@pytest.mark.parametrize(
    ("name", "code"),
    [
        ('JR תערובת מזון לציפורים 1 ק״ג – 08396', "08396"),
        ("מיטה לכלב YAGU 74×60×21 ס״מ (1128149)", "1128149"),
        ("שמפו SPECIALCAN ‏200 מ״ל (P0314)", "P0314"),
        ('רתמת חזה LINO מידה XS – מק"ט 941', "941"),
        ('גרין הארט לחתול קיטן 4 ק"ג', None),
    ],
)
def test_item_code_reads_the_code_in_the_name(name, code):
    assert item_code(name) == code


def test_brand_and_barcode():
    assert brand_of("ULTRA CLEAN חול") == "ultra-clean"
    assert brand_of("אולטרה פט פטה") == "ultra-pet"
    assert brand_of("Paw מזון יבש") == "paw"
    assert brand_of("כף לניקוי ארגז חול") is None
    assert barcode_of("<p>מזון<br> ברקוד מוצר : 7290011072026</p>") == "7290011072026"
    assert barcode_of("<p>30% חלבון</p>") is None


def test_media_key_keeps_known_keys_and_never_collides():
    known = {f"{UPLOADS}2024/03/בקר.png": "products/2024-03-00cf175e.png"}
    assert media_key(f"{UPLOADS}2024/03/בקר.png", known) == "products/2024-03-00cf175e.png"
    assert media_key(f"{UPLOADS}2026/05/8717496739551_1-scaled.jpg", known) == "products/2026-05-8717496739551_1-scaled.jpg"
    first, second = media_key(f"{UPLOADS}2024/03/כבד-300x300.png", known), media_key(f"{UPLOADS}2024/03/עוף-300x300.png", known)
    assert first.startswith("products/2024-03-300x300-") and first.endswith(".png") and first != second


def test_build_products_splits_variations_and_keeps_the_english():
    old = [{
        "id": "10", "slug": "p10", "name": {"he": "גרין הארט דגים", "en": "Greenheart Fish"},
        "description": {"he": "<p>תיאור</p>", "en": "<p>Description</p>"}, "category": "dry-dog-food",
        "legacyPath": "/product/p10/",
    }, {
        "id": "20", "slug": "p20", "name": {"he": "ישן", "en": "Old"}, "description": {"he": "ישן", "en": "Old"},
        "category": "dry-dog-food", "legacyPath": "/product/p20/",
    }]
    store = [
        store_product(20, "JR חטיף – 08396", short_description="<p>חדש</p><p>ברקוד מוצר: 7290011072026</p>",
                      images=[store_image("a", "חזית"), store_image("b")]),
        store_product(10, "גרין הארט דגים", type="variable", images=[store_image("shared"), store_image("v11")],
                      variations=[{"id": 12}, {"id": 11}]),
        store_product(30, "משחק לחתול (145)"),
        store_product(31, "משחק אחר (145)"),
    ]
    variations = {
        11: {"variation": "משקל: 3 ק&quot;ג", "images": [store_image("v11")]},
        12: {"variation": "משקל: 12 ק&quot;ג", "images": [store_image("v12")]},
    }
    manifest: dict[str, str] = {}
    products, needs = build_products(store, variations, old, CATEGORIES, manifest)

    assert [p["id"] for p in products] == ["10", "12", "20", "30", "31"]
    small, large = products[0], products[1]
    assert small["name"] == {"he": 'גרין הארט דגים – 3 ק"ג', "en": "Greenheart Fish – 3 kg"}
    assert large["name"] == {"he": 'גרין הארט דגים – 12 ק"ג', "en": "Greenheart Fish – 12 kg"}
    assert (small["slug"], large["slug"]) == ("p10", "p10-12-ק-ג")
    assert (small["legacyPath"], large["legacyPath"]) == ("/product/p10/", None)
    # Each variation shows its own photo, then the parent's photos that belong to no variation.
    assert [i["src"] for i in small["images"]] == ["products/2026-05-v11.jpg", "products/2026-05-shared.jpg"]
    assert [i["src"] for i in large["images"]] == ["products/2026-05-v12.jpg", "products/2026-05-shared.jpg"]
    assert small["description"] == {"he": "<p>תיאור</p>", "en": "<p>Description</p>"}
    assert (small["brand"], small["sku"]) == ("greenheart", None)

    jr = products[2]
    assert (jr["brand"], jr["sku"], jr["barcode"]) == ("jr-farm", "08396", "7290011072026")
    assert jr["description"]["he"] == "<p>חדש</p>\n<p>ברקוד מוצר: 7290011072026</p>"
    assert jr["images"][0] == {
        "src": "products/2026-05-a.jpg",
        "thumbnail": "products/2026-05-a-300x300.jpg",
        "srcSet": "products/2026-05-a-300x300.jpg 300w, products/2026-05-a-768x768.jpg 768w, products/2026-05-a-500x500.jpg 500w",
        "alt": {"he": "חזית"},
    }
    assert jr["images"][1]["alt"] == {"he": "JR חטיף – 08396"}
    assert manifest["products/2026-05-a-768x768.jpg"] == f"{UPLOADS}2026/05/a-768x768.jpg"
    # A code two products carry identifies neither; a new product gets its category from WordPress.
    assert (products[3]["sku"], products[4]["sku"]) == (None, None)
    assert products[3]["category"] == "dry-dog-food" and products[3]["legacyPath"] == "/product/p30/"
    # The changed (20) and new (30, 31) texts need a translation; the unchanged variation texts do not.
    assert needs == ["20", "30", "31"]
    assert jr["name"] == {"he": "JR חטיף – 08396", "en": "Old"}
    # Exporting again over the result changes nothing (the variation names do not grow another suffix).
    again, _ = build_products(store, variations, products, CATEGORIES, manifest)
    assert again == products


def test_build_pages_takes_the_listed_pages():
    pages = [
        {"slug": "%d7%90%d7%95%d7%93%d7%95%d7%aa", "title": {"rendered": "אודות"}, "content": {"rendered": "<p>אנחנו</p>"}, "modified": "2025-07-03T19:00:33"},
        {"slug": "sample-page", "title": {"rendered": "דוגמה"}, "content": {"rendered": "<p>x</p>"}, "modified": "2024-03-09T17:27:23"},
    ]
    assert build_pages(pages) == [{
        "key": "about", "title": {"he": "אודות"}, "body": {"he": "<p>אנחנו</p>"}, "updatedAt": "2025-07-03T19:00:33",
        "legacyPath": "/אודות/",
    }]


def test_fetch_all_reads_every_page():
    asked = []

    def fetch(url: str):
        """Answers 100 items on page 1 and 1 on page 2.

        Args:
            url: The paged URL.

        Returns:
            The items of that page.
        """
        asked.append(url)
        return list(range(100)) if url.endswith("page=1") else [100]

    assert len(fetch_all("https://x/list?a=1", fetch)) == 101
    assert asked == ["https://x/list?a=1&per_page=100&page=1", "https://x/list?a=1&per_page=100&page=2"]


def test_export_reads_only_public_get_endpoints(tmp_path: Path):
    for name, content in {
        "legacy-media.json": {},
        "products.json": [],
        "product-categories.json": CATEGORIES,
        "prices.json": {"currency": "ILS", "placeholder": True, "prices": {}},
    }.items():
        (tmp_path / name).write_text(json.dumps(content, ensure_ascii=False), encoding="utf-8")
    asked = []

    def fetch(url: str):
        """Answers the Store API and the pages API from fixtures.

        Args:
            url: The URL.

        Returns:
            Its JSON.
        """
        asked.append(url)
        if url.startswith(STORE_PRODUCTS + "?"):
            return [store_product(1, "מוצר")]
        return []

    result = export_wordpress(fetch, tmp_path)
    assert [p["id"] for p in result["products.json"]] == ["1"]
    assert result["needs_translation"] == ["1"]
    assert result["legacy-media.json"]["products/2026-05-photo1.jpg"] == f"{UPLOADS}2026/05/photo1.jpg"
    assert all(url.startswith((STORE_PRODUCTS, PAGES_API)) for url in asked)
