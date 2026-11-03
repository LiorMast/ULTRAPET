# UltraPet Israel — website rebuild

Corporate + B2B website for **Ultra Pet Israel (אולטרה פט ישראל בע"מ)**, a national importer and distributor of
premium pet food and pet supplies. **Wholesale only** (מכירה סיטונאית בלבד): the customers are pet stores, retail
chains, distributors and wholesalers.

We are rebuilding two existing sites into one new stack, **step by step, frontend first**:

| Source | Use it for |
|---|---|
| `legacy/` | Bolt-generated React 18 + Supabase site. **Reference only — never edit.** Port its design, copy and behavior. |
| https://www.ultrapet.co.il | Live WordPress/WooCommerce site: the real content (menu, categories, contact details, policies, reseller list, PDF catalog). |
| `requirements/` | The original prompts (`prompts.txt` English, `ULTRAPET.txt` Hebrew), fully merged into "Product requirements" below. **Never edit.** |

## Stack

- **Frontend** (`frontend/`): React 19 + TypeScript 6, Vite 8, Tailwind CSS v4 (tokens in `src/index.css`),
  TanStack Router (file-based, `src/routes/`), shadcn/ui on Radix (`radix-ui`), lucide-react icons,
  self-hosted fonts (`@fontsource-variable/*`), oxlint.
- **Tests**: Vitest 5 + React Testing Library (jsdom); Playwright (Chromium) + `@axe-core/playwright`.
- **Backend** (`backend/`): Flask 3 (app factory, one monolith, routes in two blueprints), Flask-SQLAlchemy on
  SQLAlchemy 2.1 (typed models), Flask-JWT-Extended (sign-in), psycopg 3, PostgreSQL 17, pytest. The schema is `backend/app/database/create-tables.sql` (working rule 5): no Alembic migrations
  until there is production data (Alembic is only a test library). Docker Compose (`compose.yaml`) runs Postgres +
  Flask; Vite proxies `/api` to Flask in dev.

## Layout

```
README.md  CLAUDE.md
compose.yaml            dev services: postgres + backend (project `ultrapet`)
.env.example            template of the git-ignored .env (database password, secrets)
legacy/                 reference only (old site; supabase-export/ = seed data and media)
requirements/           original prompts
frontend/
  index.html  vite.config.ts  playwright.config.ts  components.json  .oxlintrc.json
  public/favicon.svg
  e2e/                  Playwright specs (+ *-snapshots/ screenshot baselines); utils.ts = shared helpers
  src/
    main.tsx            entry: locale from the URL -> <html lang/dir>, providers, router
    router.ts           createAppRouter(): /en prefix rewrite, route staticData types
    index.css           Tailwind + brand tokens + base styles
    api.ts              the one API layer: every backend call (typed), CSRF header, refresh-and-retry on token_expired
    config.ts           menu (MAIN_NAV), home page category cards, stat labels, header buttons, external links,
                        bundled photos (brandLogo, articleImage)
    seo.ts              pageHead(): per-route title, description, canonical, hreflang, Open Graph, JSON-LD
    auth.tsx            AuthProvider/useAuth: the business-customer session (sign-in through the API, JWT cookies)
    i18n/               index.tsx (locales, URL helpers, LocaleProvider, useI18n), he.ts, en.ts
    routes/             one file per page; __root.tsx = layout (skip link, Navbar, <main>) + 404;
                        admin.tsx = staff panel layout (staff sign-in gate), admin.<resource>.tsx = one table each
    components/         site components (Navbar, MobileMenu, LanguageSwitcher, LoginPopover, LoginForm, Logo,
                        Brands, Stats, Categories, About, Contact, Hero, ...) + their tests
    components/ui/      shadcn primitives (button, dialog, dropdown-menu, popover, sheet), restyled for the brand
    stubs/              the backend's seed data (`flask seed`) and the fixtures of the tests' fake API; app code never
                        imports them (oxlint no-restricted-imports)
    assets/             logo SVGs; hero/ = the home hero photos (drop images in, no code changes)
    test/               setup.ts (jsdom polyfills, fake fetch), utils.tsx (renderPage), api.ts (fake backend API)
backend/
  Dockerfile  requirements.txt  pyproject.toml (pytest config)
  app/
    __init__.py         create_app(): config from the environment, JWT, JSON errors, CLI commands, blueprints, /api/health
    auth.py             JWT sign-in in HttpOnly cookies (CSRF double-submit, 15 min access + 30 day refresh): authenticate,
                        issue_tokens, refresh_access, clear_tokens, require_user(kind)
    customers/routes.py blueprint `customers` (/api): categories, products (server-side search + paging), brands, stats,
                        articles, resellers, sitemap.xml, customer auth (login/refresh/logout/me), prices
    staff/routes.py     blueprint `staff` (/api/staff): staff auth + generic CRUD (RESOURCES: brands, categories,
                        products+images, settings, articles, resellers); DB constraint errors -> 400/409
    pricing.py          the customer's price from the price rules (pick_rule, resolve_price, customer_prices)
    database/           everything about the database
      create-tables.sql   the schema: every table and column, explained (source of truth, working rule 5)
      drop-tables.sql     drops every table, children first
      db.py               `db`, the declarative base (naming convention, column types), TimestampMixin
      seed.py             `flask reset-db --yes`, `flask seed` (from the frontend stubs)
      models/             the SQLAlchemy models, one module per area (importing the package registers them all):
        users.py            AppUser -> StaffUser / BusinessUser (joined-table inheritance), BusinessLead
        catalog.py          Supplier, Brand, Category, Product, ProductImage, ProductSupplier (junction)
        price_rules.py      PriceRule
        orders.py           PaymentMethod, Order, OrderItem
        settings.py         Setting + get_setting()
        content.py          Article, Reseller (the public site's articles and Where to Buy stores)
  tests/                pytest on the `content_test` database (conftest.py builds it from the SQL files)
```

## Commands (run in `frontend/`)

- `npm run dev` — dev server at http://localhost:5173 (`/` = Hebrew, `/en` = English).
- `npm run check` — lint + typecheck + unit tests.
- `npm run test:e2e` — Playwright against the seeded backend (reuses or starts `docker compose up` and the dev server;
  reads `../.env` for the demo customer `SEED_CUSTOMER_EMAIL`/`PASSWORD`). After an intended visual change:
  `npm run test:e2e -- --update-snapshots`, then look at the changed PNGs.
- `npm run build` — typecheck + production build.
- From the repo root: `codegraph sync` after changing files.

## Commands (backend, from the repo root)

- `docker compose up -d --build` — Postgres (127.0.0.1:5433) + the Flask dev server (http://localhost:5000, reloads
  on change). Needs `.env` (copy `.env.example`).
- `docker compose exec backend pytest` — backend tests (database `content_test`; the dev data is never touched).
- `docker compose exec backend flask seed` — fill an empty database from the frontend stubs (plus the staff admin and
  the demo customer when SEED_ADMIN_* / SEED_CUSTOMER_* are set in `.env`).
- `docker compose exec backend flask reset-db --yes` — drop and recreate every table (all data is lost); then `seed`.
- A fresh volume runs `create-tables.sql` by itself; after a schema change run `reset-db` (there are no migrations).

## Working rules (mandatory)

### 1. Keep the structure as simple as possible
- Flat folders, few files, one obvious place for everything (see Layout).
- Don't add layers until something is genuinely reused by a second caller: no barrel files that only re-export,
  no `hooks/`, `types/`, `services/` or `utils/` folders, no wrapper components.
- A helper or type used by one file lives in that file (e.g. `DesktopNavItem` lives in `Navbar.tsx`).
- Prefer one clear file over several tiny ones; split a file only when it gets hard to read (~250+ lines).
- The backend follows the same rule: one `backend/app/` package; split modules only when they grow large.

### 2. Document every file and every function
- **Every file starts with a header comment** explaining its purpose: what it contains, why it exists, who uses it.
- **Every function has a comment directly above it** (in Python: a docstring) explaining its purpose,
  **each parameter** and the **return value**. That includes components, hooks, helpers, route handlers,
  Flask views, class methods and named handlers (`const handleSelect = ...`).
- TS/TSX: JSDoc `/** ... */` with `@param` (components: `@param props.x` for each prop) and `@returns`.
  Python: a module docstring plus Google-style `Args:` / `Returns:` docstrings.
- CSS, HTML and SVG files get a `/* ... */` or `<!-- ... -->` header.
- Keep the comments accurate whenever the code changes.
- Exempt: inline anonymous callbacks (JSX handlers, `.map` callbacks, test `it()` bodies), JSON files, and
  machine-generated files (`src/routeTree.gen.ts`, lockfiles). shadcn files in `components/ui/` are our code:
  document them when they are added.

```tsx
/**
 * PriceTag.tsx — Shows a product price with the customer's discount applied.
 * Used by the B2B catalog table and the cart.
 */

/**
 * Renders a price, struck through when a discount applies.
 * @param props.price - List price in shekels.
 * @param props.discountPercent - The customer's discount, 0-100.
 * @returns The formatted price element.
 */
export function PriceTag({ price, discountPercent }: { price: number; discountPercent: number }) { ... }
```

```python
"""orders.py — Order endpoints of the B2B portal (create, list) and the Rivhit sync trigger."""

def create_order(customer_id: int, lines: list[OrderLine]) -> Order:
    """Create an order and queue it for Rivhit.

    Args:
        customer_id: The ordering business customer.
        lines: The products and quantities.

    Returns:
        The saved order.
    """
```

### 3. Use CodeGraph first
- Before Grep/Read, use the `codegraph_explore` MCP tool with `projectPath: /home/lior/Code_Projects/ULTRAPET`
  (CLI fallback: `codegraph explore "<symbols or question>"`), for legacy and new code alike.
- Before changing a shared component, check who uses it: `codegraph impact <Symbol>`.
- **Run `codegraph sync` (repo root) after creating or changing files.**

### 4. Build step by step, with tests
- One component or section per step. Read the legacy version via codegraph, keep its look and behavior,
  and fix the legacy bugs (see "Legacy pitfalls").
- Every component ships with tests: co-located Vitest tests (`*.test.tsx`) that render the real app with
  `renderPage(url)` from `src/test/utils.tsx`, plus Playwright specs for user flows, layout overflow, axe and
  screenshots.
- A step is done only when `npm run check`, `npm run test:e2e` and `npm run build` all pass and changed
  screenshots were reviewed. Never weaken or delete a test to make it pass.
- **Test scope during work:** after a small change, run only the tests that cover the changed code (e.g. the
  matching `*.test.tsx` file and the related e2e spec), not the whole suite every time.
- **Full gate before committing:** run `npm run check` and `npm run test:e2e` in full before any commit.
- **Commit only when the user says so.** Never commit on your own initiative.
- Never edit `legacy/` or `requirements/`.

### 5. Keep the database SQL files in sync with the models
- `backend/app/database/create-tables.sql` and `drop-tables.sql` hold every SQL command needed to drop and recreate the
  database. `create-tables.sql` is the source of truth; the models in `backend/app/database/models/` mirror it. A fresh Postgres
  volume runs create-tables.sql; `flask reset-db --yes` runs both files.
- Every table has a comment block above its `CREATE TABLE` that starts `-- <table> — ` (what it stores, who writes
  it), and every column, key and constraint line an inline `--` comment (meaning, units, allowed values, what NULL
  means).
- A model change (`backend/app/database/models/*.py`) updates create-tables.sql in the same step (and the other way round). Adding or removing a table or
  a foreign key also updates drop-tables.sql.
- drop-tables.sql drops children first: a table is dropped before every table it references. Never use CASCADE (it
  hides a wrong order). Each DROP line names the tables that reference it.
- Constraint and index names are the Postgres defaults (`<table>_pkey`, `<table>_<columns>_fkey` / `_key` / `_idx`,
  `<table>_<column>_check`); multi-column checks are named `<table>_<name>_check` in both places. The models' naming
  convention (`app/database/db.py`) produces the same names.
- `backend/tests/test_schema.py` proves all of this (models == the database built from the SQL, drop order, every
  table and column commented). Run it after any schema change.

## Frontend conventions

- **Data-driven components**: components take data through props, with defaults from `src/config.ts`; changing the
  menu is a config change. Internal links are built with TanStack `linkOptions(...)`, so a link to a route that
  doesn't exist is a type error.
- **Data comes from the API**: everything stored in the database (catalog, brands, stats, articles, resellers,
  prices) is fetched through `src/api.ts` (one typed function per call), in **route loaders** (`loader` +
  `abortController.signal`; `loaderDeps` for URL state; `rethrowNotFound` turns a 404 into the not-found page),
  and passed to components as props. Components never fetch. A failed load shows `LoadError` (the router's
  `defaultErrorComponent`). Never hardcode such data in components; static copy stays in the dictionaries
  (`he.ts` / `en.ts`). `src/stubs/` holds the seed data and test fixtures only: the Vitest fake API
  (`src/test/api.ts`) answers `/api` from them with the server's semantics, so keep it in step with
  `backend/app/customers/routes.py`.
- **Modular, reusable components**: build every component to be reused as much as possible. Each component does one
  job; split out a piece (a card, a heading block, a CTA row, a list item) as soon as it could appear in another place.
  Vary it through props with sensible defaults and `cva` variants, never by copying it. No page-specific or
  section-specific logic inside shared components. A component used by one caller may stay in that caller's file (see
  rule 1), but write it as if it will be reused. When a second caller appears, move it to its own file in
  `components/` instead of duplicating it.
- **No hardcoded UI strings**: all text comes from the dictionaries via `useI18n().t` (brand names excepted).
- **RTL-first**: logical classes only (`ms/me/ps/pe/start/end/text-start/border-s`), never
  `ml/mr/pl/pr/left/right/text-left`. Use `rtl:`/`ltr:` variants for unavoidable direction tweaks (e.g. icon flips).
  Radix components get the direction from `LocaleProvider`.
- **Real links**: navigate with `<Link>` / `<a href>` (crawlable), never `button onClick` + `scrollIntoView`.
  Home sections are `#id` anchors; `scroll-padding-top` in `index.css` keeps them clear of the fixed header.
- **Styling**: Tailwind utilities with the brand tokens; variants with `cva`; merge classes with `cn` (from the `cn`
  package). Restyle the shadcn primitives in `components/ui/` instead of wrapping them.
- **Admin tables** (`DataTable` + `RecordDialog`, on DataTables 3 via `datatables.net-react`, free core only): a staff
  page = a route `admin.<resource>.tsx` whose loader calls `fetchStaffRows` and a `DataColumn[]` config (key = the
  staff API's camelCase field, `type`, `required`, `pattern`, `ltr`, `inTable`/`inForm`). The same config drives the
  cells, sorting/search and the generated edit form; editing is our Radix dialog (not the paid DataTables Editor);
  omit `onCreate`/`onUpdate`/`onDelete` for read-only. Columns and options are read once at mount (DataTables' rule).
  DataTables' CSS loads with the admin chunk; the brand overrides live in `index.css` under `.data-table`.
- **Discounts** (`DiscountDialog`): one dialog for every discount (category, product, customer, payment method):
  percent/amount switch, a signed value (negative = surcharge), start date, end date or "no end date". It returns a
  `DiscountValue` ({ type, value, startsOn, endsOn: null = open-ended }) and the caller stores it. **Not yet stored:**
  `price_rules` holds only positive percents (+ `increase` per customer) and `payment_methods.discount_percent` has no
  dates; amounts, general surcharges and dated payment discounts need a schema change when the pages are built.
- **Header dropdowns are non-modal** (`<DropdownMenu modal={false}>`): no scroll lock, the page stays accessible.
- **Accessibility** (IS 5568 / WCAG 2.1 AA — legally required in Israel): landmarks, a skip link, labelled
  controls, `aria-current`, visible focus rings, full keyboard support, contrast >= 4.5:1, `prefers-reduced-motion`
  (global rule in `index.css`). An accessible name must contain the visible label (WCAG 2.5.3); avoid building
  names from several spans that rely on whitespace.
- **Icons**: lucide-react only; logos are SVG assets.
- **Images**: SVG / WebP / AVIF with explicit sizes; lazy-load below the fold.

## i18n

- `src/i18n/index.tsx` holds the `LOCALES` registry: `he` (default, RTL) and `en` are enabled; `ru` (LTR) and `ar`
  (RTL) are registered but disabled and shown as "coming soon". Enabling one = add its dictionary + `enabled: true`.
- **URLs**: Hebrew pages are unprefixed (`/where-to-buy`), other languages are prefixed (`/en/where-to-buy`).
  The router's `rewrite` option (`src/router.ts`) strips and adds the prefix, so route files never mention
  languages. Disabled or unknown prefixes show the 404 page.
- The language is fixed for a page load; switching is a plain link to the other URL (a full page load, and
  hreflang links for crawlers). `main.tsx` sets `<html lang dir>`; `html:lang(he)` in `index.css` swaps the fonts.
- Dictionaries: `he.ts` defines `Dictionary = typeof he`, and `en.ts` must match it. Port strings from
  `legacy/src/lib/translations/{he,en}.ts` as sections are built; the CMS will later override strings
  (like legacy `cms_text_blocks`).
- SEO: routes set their head tags with `pageHead()` (`src/seo.ts`) in their `head` option (from `loaderData`) — title,
  description, canonical, hreflang alternates, Open Graph, JSON-LD; the root route sets the defaults. `sitemap.xml` is
  built by the backend from the database (`/api/sitemap.xml`; add new public pages to `SITEMAP_PAGES` in
  `backend/app/customers/routes.py`); Vite proxies `/sitemap.xml` to it, and the production server must too. The site is still a client-rendered SPA:
  prerendering the public pages is the next big SEO step.

## Design system

Tokens live in `src/index.css` (ported from legacy `tailwind.config.js` and `src/index.css`):
- **Colors**: `brand-red` #BE1E24 (`-dark` #96181D, `-light` #D42830, `-muted` #F5E8E8); `brand-charcoal` #1A1A1A
  (`-2` #2A2A2A, `-3` #3A3A3A, `-muted` #6B6B6B); the legacy neutral scale (`neutral-50` #FAFAFA, `neutral-150`
  #EFEFEF ... `neutral-900` #181818). White backgrounds.
- **Fonts**: Inter (body), Montserrat (`font-heading`: uppercase labels with `tracking-widest` = 0.25em),
  Inter at bold weights (`font-display`, English display headings and stats numbers; was Playfair Display), Heebo (all Hebrew: `html:lang(he)` swaps every font
  token to Heebo and tightens the tracking to 0.02em).
- `text-2xs` (0.65rem); shadows `shadow-premium`, `shadow-premium-sm`, `shadow-red`; square corners (`--radius: 0`).
- **Buttons**: `<Button>` default variant = legacy `.btn-primary` (red, uppercase, lifts with a red glow on hover);
  `size="sm"` for the header.
- **Logo**: `<Logo className="h-14" />` — horizontal lockup traced from `legacy/public/UltraPet_Logo.pdf`.
- **Header**: a translucent white material (`material-bar` in `index.css`: 85% white + backdrop blur; solid white
  for reduced transparency / more contrast), 88px tall (`py-4` + 56px logo); pages use `pt-22` to clear it. No
  transparent or scroll-driven states. On the home page the menu is a scrollspy (`useScrollSpy` in `Navbar.tsx`): the URL
  hash follows the `<section id>` being read (history replace; none on the hero), so `includeHash` links light up.
- **Motion** (Apple fluid-interface rules): every transition uses `--ease-spring` (a critically damped spring as CSS
  `linear()`, the Tailwind default timing function). Controls react on press (`active:scale-[0.97]
  active:duration-100`); clickable cards lift on hover and settle on press (`transition-[box-shadow,translate,scale]`;
  Tailwind v4 moves with `translate`/`scale`, so `transition-[transform]` would not animate them). The mobile drawer
  can be swiped closed (`onSwipeClose` on `SheetContent`). Reduced motion keeps fades and drops movement (see the
  `prefers-reduced-motion` block in `index.css`).
- **Type**: Inter with optical sizing (`opsz`); sizes from `text-xl` up carry size-specific negative tracking
  (`--text-*--letter-spacing`, milder in Hebrew); `tracking-display` for the hero headline; headings balance.
- **Header layout**: the desktop menu shows from `xl` (1280px); between `xl` and `2xl` it is compacted (16px gaps,
  short language label "EN"/"עב"); English menu labels use 0.1em tracking (not `tracking-widest`) so they fit; the header container is `max-w-screen-2xl`. Re-run the e2e overflow test
  after adding menu items.
- **Look and feel**: like Royal Canin / Purina / Hill's / Hamilton — a large international distributor, **not a pet
  shop**. Clean, minimal and premium; large typography, high-end photography, elegant animations; beautiful and
  production-grade, never cookie-cutter. Mobile-first and fast.

## Product requirements (merged from `requirements/`)

Where the prompts conflict, the later prompt wins, and CMS data from the legacy export wins over prompt numbers.

### Public corporate site (Hebrew-first, bilingual)
Home page sections, in order:
1. **Hero** — full-width banner slider with premium pet food brands. Headline "Ultra Pet"; subheadline "Import and
   Distribution of Pet Food and Pet Supplies"; "Supplying premium pet brands to retailers, chains and distributors
   across Israel." Buttons: "Our Brands", "Become a Business Customer".
2. **Stats** — large company figures, CMS-editable, seeded from `cms_settings.json`: 350+ retail locations,
   15+ manufacturing partners, 1000+ products, 12+ years (the prompts also mention 150+/300+ locations and
   6+ import countries).
3. **Brands** — premium logo grid: Ultra Pet, Internutri, Greenheart Premiums, Paw, JR Farm, Ultra Clean; each brand
   has a dedicated page.
4. **Product categories** — modern cards: Dog Food, Cat Food, Wet Food & Treats, Cat Litter, Small Animals, Birds;
   plus a categories page and category pages.
5. **Private Label** — one of the most important business lines; large premium section. "Ultra Pet develops and
   manufactures private label products through more than 15 international factories with strict quality control
   standards." Categories: Dry Food, Wet Food, Treats, Cat Litter. Process timeline: Product Selection -> Formula
   Development -> Packaging Design -> Production -> Quality Control -> International Shipping -> Nationwide
   Distribution. Professional icons and graphics.
6. **Business Customers** — professional B2B lead generation. Audience: Pet Stores, Retail Chains, Distributors,
   Wholesalers. Form: Company Name, Contact Person, Phone, Email, City. CTA "Open Business Account". Trust
   indicators: distribution to 300+ retail locations, international manufacturing partners, premium quality
   standards, nationwide logistics network.
7. **About** — Ultra Pet as a national importer and distributor with extensive pet-industry experience.
8. **Contact** — phone, email, WhatsApp, contact form.

Global: sticky header (done), modern navigation (done), language switcher "🌐 עברית | English" (done), professional
footer, floating WhatsApp customer-service button, SEO, fast loading, mobile-first.

Other pages: brand, category and product pages; **Where to Buy** (משווקים: the reseller directory — about 127 shops
on the WordPress site — plus a **map of branches**); articles (מאמרים); legal pages: terms (תקנון), accessibility
statement (הצהרת נגישות), refund/returns policy, privacy policy.

### B2B portal (registered customers) — from `ULTRAPET.txt`
- A downloadable **PDF catalog without prices** (public).
- A catalog **with prices and quantity selection only for logged-in customers**; the public site never shows prices.
- **Discounts per customer and per category**; an admin customer-edit screen sets all of a customer's discounts.
- Checkout by **credit card, Bit or bank transfer**, with an optional % discount per payment method (set in the admin).
- **Minimum order ₪2,000.**
- **Decided pricing rules** (table `price_rules`, logic in `backend/app/pricing.py`): staff set discounts on a category
  or a product for all customers, and discounts, price increases or (on a product) a fixed price for one customer,
  each for a period or open-ended. In each layer (the customer's rules, the general rules) a product rule beats a
  category rule and the rule that started last wins. The layers **stack**: list price x (1 -/+ customer percent) x
  (1 - general discount), rounded half-up to agorot; a customer fixed price is final.
- Submitted orders are written directly to **Rivhit (רווחית)** through its API.
- A product upload page; an API for pulling product images (later).
- "WooCommerce-ready architecture" means our own e-commerce-ready data model (products, SKUs, prices, customers,
  orders) — not WooCommerce. Keep the design ready for a full product catalog and business-customer portal.

### Admin / CMS
Port the legacy admin (`legacy/src/admin/`): dashboard, hero banners, stats, brands, categories, products (images,
videos, descriptions, details, files, SEO), text blocks (bilingual string overrides), contact info, section
visibility and order, media library. Add: customers and their discounts, payment-method discounts, orders, product
upload.

### Languages
Hebrew (default, RTL) and English now; Russian and Arabic later (Arabic is RTL). Every menu, button and piece of
content exists in each language, and the layout flips direction automatically.

## Content and data sources

- **Copy**: `legacy/src/lib/translations/{he,en}.ts`, with CMS overrides in `legacy/supabase-export/cms_text_blocks.json`.
- **Postgres seed** (`backend/app/database/seed.py`): the catalog from `frontend/src/stubs/` (categories, products with their
  WooCommerce id in `products.woocommerce_id`, their stub order in `sort_order` and their images, placeholder prices into
  `products.list_price`, brands), the articles and resellers, the home stats from
  `legacy/supabase-export/cms_settings.json`, and optionally a staff admin and a demo customer (`SEED_ADMIN_*`,
  `SEED_CUSTOMER_*`). The rest of the export (hero banners, contact, sections, text blocks,
  media and `legacy/supabase-export/media/`) waits for the CMS tables (Phase 3); schema hints in
  `legacy/supabase/migrations/`.
- **Real contact facts** (from the live site; legacy CMS values such as `+972 3 000 0000` are placeholders):
  phone **1700-55-99-92**, WhatsApp **+972 52-214-2410**, hours Sun–Thu 09:00–16:00, closed Fridays and holiday eves.
  Email is unconfirmed (the legacy CMS says office@ultrapet.co.il) — ask the owner.
- **PDF catalog**: https://www.ultrapet.co.il/wp-content/uploads/2025/03/ultrapetcatalog.pdf (`CATALOG_PDF_URL` in
  `config.ts` until the backend serves it).
- **WordPress product categories (15)**: dry cat food, dry dog food, cat cans & treats, dog cans & treats, cat
  snacks, dog snacks & bones, cat litter, beds & mattresses, grooming & hygiene, cat scratchers, rodents, birds,
  plastics, collars & leashes, equipment. **Decided:** the catalog uses these 15 (`stubs/product-categories.json`);
  legacy's 6 categories stay as the home page's marketing cards.
- **Ids**: every table's primary key is a UUID generated by the database (`gen_random_uuid()`, helper `uuid_pk()` in
  `app/database/db.py`); only `settings` and `payment_methods` use a text key. The API returns the UUIDs (prices are
  keyed by product UUID); the stubs' product `id` is the WooCommerce id, kept in `products.woocommerce_id`.
- **Products**: the 400 products of the WooCommerce Store API (`/wp-json/wc/store/v1/products`) are in
  `stubs/products.json` (images still hot-linked from WordPress — move them to the backend in Phase 2). Each product's
  `name` / `description` holds one translation per language (`{ he, en }`, the DB's product translations; Hebrew from
  the store, English translated for all 400; add `ru` / `ar` the same way); catalog search matches every language. The store
  publishes no prices: `stubs/prices.json` holds **placeholder** prices until real ones come from Rivhit/the admin.
- **SEO migration**: 301-redirect the old WordPress URLs (Hebrew slugs such as `/אודות/`, `/משווקים/`, `/מאמרים/`,
  `/צור-קשר/`, `/product-category/<slug>/`, `/product/<slug>/`, `/shop/`) to the new routes.

## Legacy pitfalls (don't port these)

- Navigation through `button onClick` + `scrollIntoView` (not crawlable) -> links.
- Physical `left/right/text-left` classes (break RTL) -> logical classes.
- Menus and drawers without focus management, English-only aria-labels -> Radix primitives + translated labels.
- Regex routing in `App.tsx` -> TanStack Router routes.
- Supabase queries inside components -> one API layer (Phase 2); components get data through props/hooks.
- Language stored only in localStorage (not crawlable) -> language in the URL.
- A 910 KB PNG logo and low-contrast greys (`neutral-300/400` text on white) -> SVG logo, contrast >= 4.5:1.

## Roadmap

**Phase 1 — Frontend (static data first)**
- [x] Scaffold: Vite, Tailwind tokens, TanStack Router, i18n, shadcn/ui, Vitest + Playwright
- [x] Navbar (`Navbar`, `MobileMenu`, `LanguageSwitcher`, `Logo`), with the login popover (`LoginPopover`, `LoginForm`:
      email, password, remember me; signs in through the API) — the mobile drawer links to `/login`, which shows the same form
- [ ] Footer + floating WhatsApp button
- [x] Hero (`Hero`) — photos come from the folder `frontend/src/assets/hero/` (drop files in; see its README)
- [x] Home sections: Stats, Brands, Categories, About, Contact (`Contact` = contact cards + a form that opens a
      prefilled mailto: until Phase 2 lead endpoints exist)
- [ ] Home section: Private Label, Business Customers (each still a placeholder block in `routes/index.tsx`)
- [x] Where to Buy (`WhereToBuy`, `BranchMap`): search, nearest store, Leaflet map, 124 resellers (table `resellers`, geocoded once)
- [x] Articles (`/articles`, `/articles/$slug`; `ArticleCard`, `Breadcrumbs`): the 4 WordPress posts (table `articles`;
      Hebrew verbatim + English translation), head tags via `seo.ts` + `<HeadContent />`, BlogPosting/Breadcrumb
      JSON-LD, `sitemap.xml` (backend) + `robots.txt`; each post keeps its WordPress `legacyPath` for the 301s
- [x] Catalog (`/catalog`; `Catalog`, `CatalogCard`, `Pagination`, `AccountPanel`, `src/auth.tsx`): 400 store products,
      category chips, search (on the server, every language), 24 per page, all state in the URL; prices only for
      signed-in customers (real sign-in, placeholder prices from the price API), "log in to see the price" for visitors
- [ ] Pages: brand, category, product, legal; per-route SEO head tags (use `pageHead()` from `seo.ts`)

**Phase 2 — Backend**
- [x] compose (Postgres + Flask); the schema (`create-tables.sql` / `drop-tables.sql`, 17 tables: users with staff and
      business subtypes, leads, suppliers, brands, categories, products, images, product-supplier junction, price
      rules, settings, payment methods, orders, order items, articles, resellers); models; price resolution (`pricing.py`); seed from the
      stubs; `/api/health`; Vite `/api` proxy
- [x] public content API (blueprint `customers`: categories, products, brands, stats, articles, resellers, sitemap);
      the frontend loads everything through `src/api.ts` (stubs are seed data + test fixtures)
- [x] auth (JWT sign-in for staff and business users, `app/auth.py`) and the customer price API (`/api/prices`)
- [x] staff API (blueprint `staff`): CRUD of brands, categories, products + images, settings, articles, resellers
- [ ] staff API for customers, price rules, leads, payment methods and orders (with the admin UI, Phase 3)
- [ ] lead/contact endpoints (`business_leads`); serve the PDF catalog

**Phase 3 — Admin CMS**: port the legacy admin.
- [x] Reusable admin table (`DataTable`, `RecordDialog`, `ui/dialog`), staff sign-in at `/admin`, `/admin/brands`
- [ ] Tables for categories, products (+ images), settings, articles, resellers (a column config + route each)
- [x] `DiscountDialog` (UI only); [ ] schema + staff API for amount/signed/dated discounts, then the discount pages

**Phase 4 — B2B portal**: auth, price catalog, per-customer/category discounts, cart + checkout (minimum ₪2,000;
card / Bit / bank transfer), Rivhit sync, generated PDF catalog.

**Phase 5**: Russian + Arabic, branch map, image API, performance and SEO hardening, WordPress 301 redirects.

## Environment notes

- Node 22, npm 12, Python 3.12, Docker Compose v5, codegraph 1.6. Not installed: `uv`, `psql`.
- Playwright runs the Chromium headless shell (install with `npx playwright install --only-shell chromium`).
- `.mcp.json` (git-ignored, because it holds a local dev database password) defines the MCP servers: playwright,
  postgres, shadcn, atlassian. The postgres MCP expects the compose network **`ultrapet_internal`** and database
  **`content`**. Keep passwords out of tracked files: compose should read them from `.env`, which is git-ignored.
- `compose.yaml` (project `ultrapet`) owns the containers `ultrapet-postgres-1` and `ultrapet-backend-1`, the volume
  `ultrapet_pgdata` and the network `ultrapet_internal` (the leftovers of an earlier attempt were removed on
  2026-11-02). Database and user `content`; the password is in `.env` and must match `.mcp.json`.
  `docker compose down -v` deletes the data volume: ask first.
- Every Claude Code session starts a `crystaldba/postgres-mcp` container (from `.mcp.json`) that keeps running after
  the session ends, so they pile up (`docker ps --filter ancestor=crystaldba/postgres-mcp`). Ask before removing them.
