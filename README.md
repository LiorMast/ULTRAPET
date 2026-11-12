# Ultra Pet Israel — website

The new corporate and B2B website of **Ultra Pet Israel (אולטרה פט ישראל בע"מ)**, a national importer and
distributor of premium pet food and pet supplies. Ultra Pet sells **wholesale only**, so the site is aimed at pet
stores, retail chains, distributors and wholesalers.

It replaces two older sites: the WordPress/WooCommerce site at [ultrapet.co.il](https://www.ultrapet.co.il) and a
Bolt-generated React + Supabase prototype (kept in `legacy/` as a reference). The site is Hebrew-first (right-to-left)
with an English version, and Russian and Arabic are planned.

## Status

Phase 1 (the frontend, on static data) is in progress:

| Done | Still to come |
|---|---|
| Header with menu, language switcher and login popover | Footer and floating WhatsApp button |
| Home page: Hero, Stats, Brands, Categories, About, Contact | Home page: Private Label, Business Customers |
| Where to Buy: store search, nearest store, map of 124 resellers | Brand, category, product and legal pages |
| Articles: list and article pages, with SEO tags, JSON-LD and a sitemap | |
| Catalog: 400 products, category filter, search, pagination; prices only after login | Real prices from Rivhit (Phase 4) |

Phase 2 (the backend) is in progress: a PostgreSQL database with the full data model (users, catalog, suppliers,
per-customer pricing, orders, articles, resellers) and a Flask API. The site now loads all its data from the API:
catalog (searched and paged on the server), brands, stats, articles and resellers. Business customers sign in with
JWTs in HttpOnly cookies and see their own prices; staff have a sign-in and a create/edit/delete API for the
catalog and the site content, and the downloadable PDF catalog is generated from the products (`flask build-catalog`;
rebuilt after every product change, layout set in the "PDF catalog" dialog of `/admin/products`). Still to come:
lead and contact endpoints.

Later phases: an admin CMS (the staff UI), and the B2B portal (cart, checkout, sync with Rivhit).
[CLAUDE.md](CLAUDE.md) has the full roadmap and requirements.

## Getting started

You need Docker with Compose, Node 22 and npm. The site gets its data from the backend, so start that first, from
the repository root:

```bash
cp .env.example .env                        # then set POSTGRES_PASSWORD, SECRET_KEY and SEED_CUSTOMER_* (see the file)
docker compose up -d --build                # PostgreSQL on 127.0.0.1:5433, Flask on http://localhost:5000 (BACKEND_PORT in .env)
docker compose exec backend flask seed      # load the catalog, brands, stats, articles, resellers and the demo users
docker compose exec backend flask import-media   # copy the product photos into the file storage (once, about 215 MB)
docker compose exec backend flask build-catalog  # generate the downloadable PDF catalog (Hebrew + English)
curl localhost:5000/api/health              # {"status": "ok"}
```

Then the frontend, from `frontend/`:

```bash
cd frontend
npm ci
npx playwright install --only-shell chromium   # once, for the end-to-end tests
npm run dev                                    # http://localhost:5173
```

Hebrew pages have no prefix (`/where-to-buy`); English pages are under `/en` (`/en/where-to-buy`). The Vite dev
server forwards `/api` (and `/sitemap.xml`) to Flask, so the site calls the API on its own origin. Sign in with the
`SEED_CUSTOMER_EMAIL` / `SEED_CUSTOMER_PASSWORD` from `.env` to see prices in the catalog.

### Backend

| Command (from the repo root) | What it does |
|---|---|
| `docker compose exec backend pytest` | Backend tests, on a separate `content_test` database |
| `docker compose exec backend flask seed` | Fill an empty database from `frontend/src/stubs/` (plus the demo users from `.env`) |
| `docker compose exec backend flask reset-db --yes` | Drop and recreate every table (all data is lost) |

The database schema is written by hand in two files, both commented table by table and column by column:
[backend/app/database/create-tables.sql](backend/app/database/create-tables.sql) creates every table, and
[backend/app/database/drop-tables.sql](backend/app/database/drop-tables.sql) drops them in dependency order. The Python models mirror
create-tables.sql, and a test checks that the two always match.

The API has two blueprints: `backend/app/customers/routes.py` (prefix `/api`: what the public site and the
business customers call) and `backend/app/staff/routes.py` (prefix `/api/staff`: staff sign-in and
create/read/update/delete of brands, categories, products, settings, articles and resellers). Sign-in for both is
in `backend/app/auth.py`.

## Commands

Run these in `frontend/`:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run check` | Lint (oxlint), typecheck and unit tests (Vitest) |
| `npm run test:e2e` | Playwright tests in Chromium (desktop and phone) against the seeded backend: user flows, layout, accessibility, screenshots |
| `npm run test:e2e -- --update-snapshots` | Refresh the screenshot baselines after an intended visual change, then review the images |
| `npm run build` | Typecheck and production build into `dist/` (the sitemap is served by the backend) |

The screenshot baselines (`e2e/*-snapshots/`) are git-ignored. Each machine creates its own on the first run. The
end-to-end tests need the backend running with seeded data and `SEED_CUSTOMER_*` set in `.env` (Playwright starts
`docker compose up` when the backend is not running, and reads `.env` for the demo customer).

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Router (file-based routes), shadcn/ui on Radix,
  lucide-react icons, self-hosted fonts.
- **Tests:** Vitest + React Testing Library; Playwright + axe-core.
- **Backend:** Flask (blueprints), Flask-SQLAlchemy (SQLAlchemy 2), Flask-JWT-Extended, psycopg 3, PostgreSQL 17,
  pytest, Docker Compose.

## Project layout

```
README.md  CLAUDE.md     this file; the detailed conventions, requirements and roadmap
compose.yaml             local services: PostgreSQL and the Flask backend (secrets in .env, see .env.example)
backend/
  app/                   the Flask app
    auth.py              sign-in with JWTs in HttpOnly cookies, shared by both blueprints
    customers/routes.py  blueprint /api: public content, customer sign-in, the customer's prices, the sitemap
    staff/routes.py      blueprint /api/staff: staff sign-in and CRUD of the catalog and the site content
    database/            create-tables.sql (the schema, every table and column explained), drop-tables.sql (drops
                         every table, children first), models/ (users, catalog, price rules, orders, settings,
                         content), seed
    pricing.py           the customer's price from the price rules
  tests/                 pytest
legacy/                  the old React + Supabase site: reference only, never edited
requirements/            the original requirement prompts: never edited
frontend/
  e2e/                   Playwright specs
  public/                favicon, robots.txt
  src/
    main.tsx  router.ts  entry point; router with the /en prefix rewrite
    api.ts               the one API layer: every call to the backend, with the types of what it returns
    config.ts            menu, home page categories, contact details and the photos bundled with the site
    seo.ts               per-page <head> tags: title, description, canonical, hreflang, Open Graph, JSON-LD
    i18n/                languages and URL helpers, he.ts and en.ts dictionaries
    routes/              one file per page
    components/          site components and their tests; ui/ holds the restyled shadcn primitives
    auth.tsx             the business-customer session (sign-in through the API)
    stubs/               the backend's seed data and the fixtures of the unit tests' fake API (test/api.ts)
    assets/              logos and photos
```

## Editing content

The catalog, brands, stats, articles and resellers live in the database. Until the admin CMS exists, staff change
them through the staff API (`/api/staff/...`, see `backend/app/staff/routes.py`). A fresh database is filled from
the files in `frontend/src/stubs/` by `flask seed`:

- **Catalog:** `products.json` and `product-categories.json` (exported from the WooCommerce store by
  `flask export-wordpress`; [WORDPRESS.md](WORDPRESS.md) documents the old site and the import). Every product's
  name and description has a Hebrew and an English translation (`{ he, en }`). `prices.json` holds **placeholder**
  prices, shown only to signed-in customers.
- **Articles:** `articles.json`; each article's photo is bundled with the site in `frontend/src/assets/articles/`,
  named after the article's slug.
- **Resellers (Where to Buy):** `branches.json`.

The rest lives in the repository:

- **Text in the interface:** `frontend/src/i18n/he.ts` and `en.ts`. Both files must have the same keys (TypeScript
  checks this).
- **Menu:** `MAIN_NAV` in `frontend/src/config.ts`.
- **Hero photos:** drop images into `frontend/src/assets/hero/` (see the README there).

## Conventions

The working rules are in [CLAUDE.md](CLAUDE.md). The main ones:

- RTL-first styling with logical classes only (`ms`/`me`/`start`/`end`, never `ml`/`mr`/`left`/`right`).
- No hard-coded interface text: every string comes from the dictionaries.
- Accessibility to WCAG 2.1 AA (IS 5568, required by Israeli law).
- Every file has a header comment, and every function has a JSDoc comment (Python: a docstring).
- The database SQL files and the backend models always change together.
- Every component ships with a co-located Vitest test and Playwright coverage.
- Before committing, `npm run check`, `npm run test:e2e` and `npm run build` must all pass, and so must the backend's
  `pytest`.
