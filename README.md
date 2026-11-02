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
| Catalog: 400 products, category filter, search, pagination; prices only after login | Real login and real prices (Phase 4) |

Phase 2 (the backend) has started: a PostgreSQL database and a Flask backend with the full data model (users, catalog,
suppliers, per-customer pricing, orders), seeded from the frontend's data. The frontend does not call it yet.

Later phases: the API, an admin CMS, and the B2B portal (price catalog, per-customer discounts, checkout, sync with
Rivhit). [CLAUDE.md](CLAUDE.md) has the full roadmap and requirements.

## Getting started

You need Node 22 and npm. Everything runs from `frontend/`:

```bash
cd frontend
npm ci
npx playwright install --only-shell chromium   # once, for the end-to-end tests
npm run dev                                    # http://localhost:5173
```

Hebrew pages have no prefix (`/where-to-buy`); English pages are under `/en` (`/en/where-to-buy`).

### Backend

You need Docker with Compose. From the repository root:

```bash
cp .env.example .env                        # then set POSTGRES_PASSWORD and SECRET_KEY
docker compose up -d --build                # PostgreSQL on 127.0.0.1:5433, Flask on http://localhost:5000
docker compose exec backend flask seed      # load the categories, products, prices and brands
curl localhost:5000/api/health              # {"status": "ok"}
```

The Vite dev server forwards `/api` to Flask, so the frontend can call `/api/...` on its own origin.

| Command (from the repo root) | What it does |
|---|---|
| `docker compose exec backend pytest` | Backend tests, on a separate `content_test` database |
| `docker compose exec backend flask seed` | Fill an empty database from `frontend/src/stubs/` |
| `docker compose exec backend flask reset-db --yes` | Drop and recreate every table (all data is lost) |

The database schema is written by hand in two files, both commented table by table and column by column:
[backend/create-tables.sql](backend/create-tables.sql) creates every table, and
[backend/drop-tables.sql](backend/drop-tables.sql) drops them in dependency order. The Python models mirror
create-tables.sql, and a test checks that the two always match.

## Commands

Run these in `frontend/`:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run check` | Lint (oxlint), typecheck and unit tests (Vitest) |
| `npm run test:e2e` | Playwright tests in Chromium (desktop and phone): user flows, layout, accessibility, screenshots |
| `npm run test:e2e -- --update-snapshots` | Refresh the screenshot baselines after an intended visual change, then review the images |
| `npm run build` | Typecheck and production build into `dist/` (including `sitemap.xml`) |

The screenshot baselines (`e2e/*-snapshots/`) are git-ignored. Each machine creates its own on the first run.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Router (file-based routes), shadcn/ui on Radix,
  lucide-react icons, self-hosted fonts.
- **Tests:** Vitest + React Testing Library; Playwright + axe-core.
- **Backend:** Flask, Flask-SQLAlchemy (SQLAlchemy 2), psycopg 3, PostgreSQL 17, pytest, Docker Compose.

## Project layout

```
README.md  CLAUDE.md     this file; the detailed conventions, requirements and roadmap
compose.yaml             local services: PostgreSQL and the Flask backend (secrets in .env, see .env.example)
backend/
  create-tables.sql      the database schema, every table and column explained
  drop-tables.sql        drops every table, children first
  app/                   the Flask app: models/ (users, catalog, price rules, orders, settings), pricing, seed commands
  tests/                 pytest
legacy/                  the old React + Supabase site: reference only, never edited
requirements/            the original requirement prompts: never edited
frontend/
  e2e/                   Playwright specs
  public/                favicon, robots.txt
  src/
    main.tsx  router.ts  entry point; router with the /en prefix rewrite
    config.ts            menu, categories, articles, contact details and other site data
    seo.ts               per-page <head> tags: title, description, canonical, hreflang, Open Graph, JSON-LD
    i18n/                languages and URL helpers, he.ts and en.ts dictionaries
    routes/              one file per page
    components/          site components and their tests; ui/ holds the restyled shadcn primitives
    auth.tsx             the business-customer session (a stub sign-in until the B2B portal exists)
    stubs/               JSON stand-ins for future API data (resellers, articles, products, prices)
    assets/              logos and photos
```

## Editing content

Until the backend and CMS exist, content lives in the repository:

- **Text in the interface:** `frontend/src/i18n/he.ts` and `en.ts`. Both files must have the same keys (TypeScript
  checks this).
- **Menu:** `MAIN_NAV` in `frontend/src/config.ts`.
- **Hero photos:** drop images into `frontend/src/assets/hero/` (see the README there).
- **Articles:** `frontend/src/stubs/articles.json`, with one photo per article in `frontend/src/assets/articles/`,
  named after the article's slug.
- **Resellers (Where to Buy):** `frontend/src/stubs/branches.json`.
- **Catalog:** `frontend/src/stubs/products.json` and `product-categories.json` (exported from the WooCommerce
  store). Every product's name and description has a Hebrew and an English translation (`{ he, en }`). `prices.json` holds **placeholder** prices, shown only to signed-in customers. Login is a stub for now:
  any valid email and password signs in.

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
