<!--
WORDPRESS.md — What the old WordPress / WooCommerce site (www.ultrapet.co.il) holds, what was imported into the new
site and how, what could not be imported and why, and what the old site teaches us for the new one. Written from a
read-only audit of the WordPress admin (7 Nov 2026: admin screens and the authenticated REST API, GET only) and of
its public APIs. Read it before touching the import (`flask export-wordpress`, backend/app/database/wordpress.py).
-->

# The old WordPress site (www.ultrapet.co.il)

An audit of the live site, done read-only on 7 Nov 2026. Nothing on WordPress was changed: only admin screens and
GET requests were used.

## 1. Platform

| Item | Value |
|---|---|
| Core | WordPress (he_IL, timezone Asia/Jerusalem), custom theme **"Ultrapet"** built by Feels (Bootstrap) |
| Shop | WooCommerce 11.2.2, currency ILS, 2 decimals, no tax rates |
| Mode | **YITH Catalog Mode**: shop disabled, Add to Cart hidden on every page. The site is a catalog only and has never taken an order. |
| Database | about 21 MB (13.6 MB data, 7.9 MB indexes) |
| Media | 690 attachments, about 323 MB (521 JPEG, 164 PNG, 4 WebP, 1 PDF: the catalog) |

**Active plugins:**
- ACF Pro 6.3.12: 4 options pages, see section 6.
- YITH Catalog Mode, and YITH Role Based Prices Premium (installed, **no rules**).
- Yoast SEO 28.8.
- WPForms Lite 2.0.4 (1 form, the contact form) and WP Mail SMTP 4.10.3, **with no mailer set up**.
- Members 3.3.1, UpdraftPlus 1.26.13 (backups).
- Site Kit by Google, Google for WooCommerce.
- "Web Accessibility" (ea11y widget), Side Cart.

**Inactive plugins:** Akismet, Hello Dolly, Regenerate Thumbnails.

## 2. Catalog

- **401 products**: 400 published and 1 draft (#1085 "Internutri turkey 14 kg", not imported).
  - 388 are simple products. 13 are variable, with 21 variations:
    - Greenheart Medium Sensitive fish / lamb: 3 kg and 12 kg.
    - Scratching posts UP56, UP100, UP114, UP141, UP148, UP170: grey and beige. Both colours share one photo in WordPress.
    - 5 PET FAN litters: 10 L. Each has a single variation; the 20 L option is listed but not sold.
- **Empty fields on every product** (nothing to import):
  - prices: 246 products have "0" and the rest are empty;
  - SKU, stock (not managed; every product is "in stock"), weight, dimensions, GTIN;
  - tags, the brands taxonomy, global attributes, shipping classes;
  - upsells, cross-sells, reviews, sales.
- **What the product records do hold:**
  - **Photos.** A gallery of 1 to 5 photos: 285 products have 1, 88 have 2, 23 have 3 and 12 have 4–5. Each variation
    has its own photo. Only 5 of the 690 media items have alt text.
  - **Descriptions.** 385 products have a rich *short description*: product title, ✔ benefits, then sections such as
    Composition, Analytical Constituents, Nutritional Additives per kg and a Daily Feeding Guide (9 with tables).
    Twenty also have a long description. Most texts were pasted from ChatGPT, with its wrapper `<div>`s.
  - **Item codes in names.** 203 names contain one: `- 08396` (JR Farm), `(1128149)` (YAGU), `(P0314)` (Specialcan),
    `מק"ט 941` (LINO). One code, 1128070, is on two products.
  - **Barcodes in descriptions.** 108 descriptions contain an EAN-13 ("ברקוד מוצר : 7290011072026"). One barcode is
    on two products.
  - **Brands in names:**

    | Brand | Products |
    |---|---|
    | YAGU | 87 |
    | Ultra Pet | 78 |
    | JR Farm | 75 |
    | Greenheart | 25 |
    | Specialcan | 22 |
    | LINO | 9 |
    | Paw | 9 |
    | Internutri | 8 |
    | Pet Fan | 8 |
    | Lizi | 5 |
    | Ultra Clean | 4 |
    | Petpall | 1 |
    | none recognized | 77 |

  - **SEO.** Yoast meta descriptions on 14 products; Yoast's primary category on all of them.
- **Categories**: 15, flat, plus an empty "כללי" ("General"). None has an image or a description. The order is the top menu's
  (the same as `stubs/product-categories.json`). Product counts:

  | Category | Products |
  |---|---|
  | beds | 84 |
  | rodents | 60 |
  | dog treats | 54 |
  | dry dog food | 27 |
  | cat cans | 26 |
  | grooming | 23 |
  | plastics | 23 |
  | cat treats | 22 |
  | cat litter | 20 |
  | dry cat food | 13 |
  | dog cans | 13 |
  | birds | 13 |
  | scratchers | 10 |
  | collars | 9 |
  | equipment | 6 |

## 3. Users, customers, orders

- **Users: only 2, both administrators** (the owner's and the developer's). There are no business customers, no
  `customer` users and no custom roles. The roles are the WordPress, WooCommerce and Yoast defaults; Members adds none.
- **Orders: 0. Coupons: none readable.** All payment gateways (bank transfer, cheque, cash on delivery) are disabled.
  Shipping has one zone, "Israel".
- **Comments:** 131 pending, **all spam** (casino ads on the 4 posts); 0 approved. Do not import them.
- **Contact form (WPForms Lite):** fields are full name, mobile and message. **Lite never stores entries**, and WP Mail
  SMTP has no mailer configured, so form submissions were probably never delivered. **Tell the owner.** The new
  site's `business_leads` table fixes this.

## 4. Pages, posts, menus

- **Posts:** the 4 articles, already imported (`stubs/articles.json`).
- **Pages:**
  - about (316 words, updated 2025-07);
  - contact (the form);
  - terms and conditions (2,491 words), accessibility statement, refund and returns policy, privacy policy (the
    WordPress template, still about comments);
  - articles index; resellers (the ACF table);
  - "card-instructions-sand" (**empty**; maybe the target of a QR code on the tofu litter carton, so keep the URL alive
    with a redirect);
  - the WooCommerce shop, cart, checkout and my-account pages, and the sample page.
- **Menus:**
  - Top: About, All products (the 15 categories), Full catalog (PDF), Resellers, Articles, Contact.
  - Footer "about": About, Contact, Full catalog, Terms, Accessibility, Refunds and returns, Privacy.
  - Footer "site": Shop, Articles, 5 categories, Resellers.
- **Footer:**
  - company name, phone 1700-55-99-92;
  - hours: Sun–Thu 09:00–16:00, Fridays and holiday eves closed;
  - the three menus, "Follow us", and "© Ultrapet 2026, built by Feels".

## 5. Product page (what to port)

The page is laid out top to bottom like this:

1. Breadcrumb (home > category > product).
2. H1.
3. Gallery.
4. The short description, with all its sections.
5. "Product description" (the long one).
6. **Shipping:** "up to 3 business days".
7. **Returns:** "according to the returns policy, through the agent". Items 6 and 7 come from the ACF general options.
8. "You may also like" (related products).
9. Footer.

The structured data is Yoast's WebPage, BreadcrumbList and WebSite graph. There is no Product or Organization schema.

## 6. ACF options pages (the theme's CMS)

- **Home ("דף בית")**: title "UltraPet", subtitle "אולטרה פט ישראל" (Ultra Pet Israel), intro text, 6 category
  teasers (category + text + image), a "Products" block ("among our leading brands") with **4 featured products**,
  and a banner slider.
- **General settings ("הגדרות כלליות")**:
  - social links: Facebook and Instagram are both the placeholder `https://facebook.com`; WhatsApp `972522142410+`;
  - footer text and phone;
  - hours "09:00–16:00", holidays "closed";
  - an image of the payment methods;
  - 4 "search products";
  - shipping policy "up to 3 business days"; returns policy "through the agent".
- **Home design ("עיצוב דף בית")**: 4 colour themes, each with a banner image, main and light colours, a secondary
  colour, and page and footer backgrounds (#851811, #be7916, #163a4a, #b54f51 …).
- **Resellers ("משווקים")**: 126 rows of name, address, city, phone and link. Some rows are duplicates; they reduce
  to the **124 stores already imported** (`stubs/branches.json`). Verified: none is missing.

## 7. SEO and URLs

- Yoast title pattern: `<page> - UltraPet - יבוא מזון לבעלי חיים`. The site tagline is "מזון טוב לבעלי חיים. #1 בעולם"
  ("Good food for animals. #1 in the world"). Yoast Redirects is the Premium upsell, so **no redirects exist**.
- These old URLs need 301 redirects (Phase 5):

  | Kind | Old URL | Where the new site keeps it |
  |---|---|---|
  | Product | `/product/<hebrew slug>/` | `legacyPath` in products.json |
  | Category | `/product-category/<slug>/` | `legacyPath` in product-categories.json |
  | Post | `/<hebrew slug>/` | `legacyPath` in articles.json |
  | Page | `/אודות/`, `/צור-קשר/`, `/משווקים/`, `/מאמרים/`, `/תקנון-ותנאי-שימוש/`, `/הצהרת-נגישות/`, `/refund_returns/`, `/privacy-policy/`, `/shop/`, `/card-instructions-sand/`, `/my-account/` | (none yet) |
  | PDF | `/wp-content/uploads/2025/03/ultrapetcatalog.pdf` (linked from both menus) | (none yet) |

## 8. What was imported, and how

The import reads only **public** endpoints, so it needs no credentials:
- the WooCommerce Store API, `/wp-json/wc/store/v1/products` and `/products/<variation id>`;
- the WordPress pages API.

`flask export-wordpress` (`backend/app/database/wordpress.py`) merges what it reads into the seed stubs:

```bash
docker compose exec backend flask export-wordpress --out /tmp/wp     # the stubs are mounted read-only in the container
docker compose cp backend:/tmp/wp /tmp/wp && cp /tmp/wp/*.json frontend/src/stubs/
docker compose exec backend flask import-media                       # copies the new photo files into the storage
docker compose exec backend flask reset-db --yes && docker compose exec backend flask seed   # dev data is lost
```

The command is idempotent: an unchanged site gives byte-identical stubs. It keeps every English text whose Hebrew is
unchanged, and prints the ids of the products whose English must be translated again.

| Data | Where it went | Notes |
|---|---|---|
| 400 products → **408** | `products.json` → `products` | Each Greenheart and scratching-post variation is its own product (first keeps the parent's id, slug and old URL; the second gets the variation's id and the parent's placeholder price). The PET FAN litters stay single. |
| Full descriptions | `description {he, en}` | Sanitized HTML: p, h2–h4, ul/ol/li, table, strong/em, br; no attributes. English translated for all 382 distinct texts. Search ignores the tags. |
| Gallery photos (584 rows) | `images[]` → `product_images` (order, alt) | 558 new files (1,925 objects in all) copied by `import-media`. Alt text = WordPress alt, else the product name. |
| Item codes (201) | `sku` → `products.sku` | Codes on two products are dropped. **Confirm with the owner that they are the Rivhit item numbers.** |
| Barcodes (106) | `barcode` → `products.barcode` | From "ברקוד" in the description; duplicates dropped. |
| Brands (331 products) | `brand` → `products.brand_id` | YAGU, LINO, Pet Fan, Lizi, Specialcan and Petpall are new brands with `active: false`: they stay off the public site until the owner confirms them and supplies logos. |
| Hours | `contact.json` `hours` → setting `contact_hours` | For the footer. |
| About and legal pages | `pages.json` (Hebrew HTML + legacyPath) | Not seeded: for the legal pages step. Needs an English translation and a legal review (the privacy page is the WordPress template). |

**Not imported, and why:**
- Prices: all 0 or empty. The placeholders stay until Rivhit provides real ones.
- Stock, weight, dimensions, tags, reviews: empty.
- Users and customers: only 2 administrators.
- Orders and coupons: none.
- Comments: spam.
- Form entries: never stored.
- The draft product #1085.
- The ACF home texts, featured products and colour themes: they are WordPress-only design. The new site has its own
  home sections.

**Source quirks the translators kept as written (owner to review):**
- #1083 says "made in Portugal" while #1081 says Spain.
- #723 has potassium sorbate at "01%" (probably 0.1%).
- Several JR texts say "no grains" next to grain ingredients.
- #730 has a garbled phone line "700-55-99-92-1.".
- #644 and #1292 repeat their text.
- #944 and #947 have "Plastic-Fruit".

## 9. Ideas for the new site, from the old one

- **Product page** (done: `/products/$slug`): the anatomy in section 5, with the sanitized description sections, the
  shipping and returns notes, related products, and Product + Breadcrumb JSON-LD. The old `/product/<slug>/` URLs
  still need their 301s (`legacyPath`, Phase 5).
- **Home**: a "featured products" strip (the old site had 4 hand-picked ones). Category teaser texts.
- **Footer** (roadmap): hours (`contact_hours`), the three link groups, the catalog PDF, and the legal pages. Real
  social links are needed; the old ones are placeholders.
- **Leads**: store every form in `business_leads` and send mail through a real SMTP or API provider. The old site
  lost them.
- **Articles**: no comments (the old ones attracted only spam).
- **Brands**: confirm the 6 new brands, get their logos, and consider brand filters in the catalog.
- **Accessibility**: the old site relied on an overlay widget; the new one is accessible natively (IS 5568). Keep it
  that way.
- **Images**: WordPress kept huge originals (up to 2560 px "-scaled", about 323 MB). Convert to WebP/AVIF when real
  S3 arrives.
