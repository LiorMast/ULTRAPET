/**
 * test/api.ts — A fake of the backend API for the Vitest tests, installed as `fetch` by setup.ts.
 *
 * It answers every /api call the site makes (src/api.ts) from the stub fixtures in src/stubs/ — the same files
 * `flask seed` loads into the database — with the server's semantics (backend/app/customers/routes.py): catalog
 * search in every language, category filter, chip counts and paging; brands and articles by slug; sign-in that
 * accepts any credentials except the password WRONG_PASSWORD (the email admin@example.com signs in as the staff
 * user TEST_STAFF, anyone else as the customer TEST_USER). The staff API (backend/app/staff/routes.py) is
 * faked for brands, categories, products and price rules: list/create/update/delete on in-memory copies of the
 * stubs (no price rules at first) with the server's errors (401 signed out, 403 for a customer, 400 required /
 * a failed check / an unknown reference, 409 duplicate or in use, 404) and its cascade (a deleted category's or
 * product's price rules go with it).
 * Unknown paths answer 404. A test can replace one
 * answer with vi.spyOn(globalThis, 'fetch'); setup.ts restores the fake and signs it out after every test.
 */
import type { Brand, Branch, ProductCategory, ProductImage, ProductPage, Stat, User } from '@/api'
import type { Localized } from '@/config'
import articles from '@/stubs/articles.json'
import branches from '@/stubs/branches.json'
import brands from '@/stubs/brands.json'
import categories from '@/stubs/product-categories.json'

/** The password the fake sign-in refuses (401 "invalid_credentials"). */
export const WRONG_PASSWORD = 'wrong-password'

/** The customer the fake sign-in returns (with the typed email). */
export const TEST_USER: User = { kind: 'business', email: 'shop@example.com', fullName: 'Demo Customer', companyName: 'Demo Pet Shop' }

/** The home page figures the fake serves (the values `flask seed` takes from the legacy CMS). */
export const STATS: Stat[] = [
  { id: 'retail', value: 350, suffix: '+' },
  { id: 'partners', value: 15, suffix: '+' },
  { id: 'products', value: 1000, suffix: '+' },
  { id: 'years', value: 12, suffix: '+' },
]

/** A product as stored in stubs/products.json. */
type StubProduct = {
  id: string
  slug: string
  name: Localized<string>
  description: Partial<Record<string, string>>
  category: string
  image: ProductImage | null
}

/** Products per catalog page, and the most a request may ask for (as on the server). */
const PAGE_SIZE = 24
const MAX_PAGE_SIZE = 100

/** The staff user the fake sign-in returns for the email `admin@example.com`. */
export const TEST_STAFF: User = { kind: 'staff', email: 'admin@example.com', fullName: 'Test Admin', companyName: null }

/** Who the fake thinks is signed in (customer or staff, by /api/auth/login), for /api/auth/me and /api/staff/. */
let session: User | null = null

/** A row of a staff table as the staff API returns it: its id, its fields and its timestamps. */
type StaffRow = { id: string; createdAt: string; updatedAt: string } & Record<string, unknown>

/** The staff tables (each a promise, so concurrent first requests share one copy); built from the stubs on first use. */
let staffRows: Partial<Record<string, Promise<StaffRow[]>>> = {}

/** Signs the fake out and forgets staff edits; setup.ts calls it after every test. */
export function resetFakeApi() {
  session = null
  staffRows = {}
}

/**
 * Signs a user in to the fake (renderPage's `staff` option).
 * @param user - The user, e.g. TEST_STAFF.
 */
export function signInFakeUser(user: User) {
  session = user
}

/** When the stub rows were "created" (the seed's timestamps). */
const SEEDED = '2026-11-01T10:00:00+02:00'

/**
 * A fixed id for a seeded row, so tests can predict it.
 * @param table - A number per table: brands 0, categories 1, products 2.
 * @param index - The row's position in its stub file.
 * @returns A UUID, e.g. "00000000-0000-4000-8001-000000000003".
 */
function seedId(table: number, index: number): string {
  return `00000000-0000-4000-800${table}-${String(index + 1).padStart(12, '0')}`
}

/**
 * One staff table of the fake, mirroring RESOURCES in backend/app/staff/routes.py and the table's constraints.
 * - `fields`: the JSON keys a request may send. `required`: the NOT NULL ones. `numeric`: money fields (the form
 *   sends text such as "303.90"; the server answers a number). `defaults`: the database defaults.
 * - `seed`: the rows `flask seed` would store. `check`: the table's other constraints (null = valid).
 * - `order`: the list order. `inUse`: the foreign key that keeps a row from being deleted, if any applies.
 */
type FakeTable = {
  fields: string[]
  required: string[]
  numeric?: string[]
  defaults: Record<string, unknown>
  seed: () => StaffRow[] | Promise<StaffRow[]>
  check: (row: StaffRow, others: StaffRow[]) => Response | null | Promise<Response | null>
  order: (a: StaffRow, b: StaffRow) => number
  inUse?: (row: StaffRow) => Promise<string | null>
}

/**
 * The rows of a staff table, seeding it on first use.
 * @param resource - The table, e.g. "categories".
 * @returns The in-memory rows (changed in place by the fake's create/update/delete).
 */
function tableRows(resource: string): Promise<StaffRow[]> {
  staffRows[resource] ??= Promise.resolve(STAFF_TABLES[resource].seed())
  return staffRows[resource]
}

/**
 * The answer of a failed check constraint.
 * @param constraint - Its name, e.g. "brands_slug_check".
 * @returns The 400 answer.
 */
const invalid = (constraint: string) => json({ error: 'invalid', constraint }, 400)

/**
 * The answer when another row already has a unique value.
 * @param row - The row being saved.
 * @param others - The other rows.
 * @param field - The unique field, e.g. "slug".
 * @param constraint - The unique key's name, e.g. "brands_slug_key".
 * @returns The 409 answer, or null when the value is free (or empty).
 */
function duplicate(row: StaffRow, others: StaffRow[], field: string, constraint: string): Response | null {
  return row[field] !== null && others.some((other) => other[field] === row[field]) ? json({ error: 'duplicate', constraint }, 409) : null
}

/**
 * Whether a translated text lacks its Hebrew (the tables' `coalesce(x ->> 'he', '') <> ''` checks).
 * @param value - The { he, en } value, or null.
 * @returns True when given without Hebrew.
 */
const noHebrew = (value: unknown) => value !== null && !(value as Partial<Localized<string>>).he

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** The staff tables the fake serves, by their URL name. */
const STAFF_TABLES: Record<string, FakeTable> = {
  brands: {
    fields: ['slug', 'name', 'tagline', 'description', 'accentColor', 'logoUrl', 'sortOrder', 'isActive'],
    required: ['name', 'slug', 'sortOrder', 'isActive'],
    defaults: { tagline: null, description: null, accentColor: null, logoUrl: null, sortOrder: 0, isActive: true },
    seed: () =>
      brands.map((brand, index) => ({
        id: seedId(0, index),
        slug: brand.slug,
        name: brand.name,
        tagline: brand.tagline,
        description: null,
        accentColor: brand.accent,
        logoUrl: null,
        sortOrder: index + 1,
        isActive: true,
        createdAt: SEEDED,
        updatedAt: SEEDED,
      })),
    check: (brand, others) => {
      if (!SLUG.test(String(brand.slug))) return invalid('brands_slug_check')
      if (brand.accentColor !== null && !/^#[0-9A-Fa-f]{6}$/.test(String(brand.accentColor))) return invalid('brands_accent_color_check')
      return duplicate(brand, others, 'slug', 'brands_slug_key')
    },
    order: (a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name)),
  },
  categories: {
    fields: ['slug', 'name', 'imageUrl', 'legacyPath', 'sortOrder', 'isActive'],
    required: ['slug', 'name', 'sortOrder', 'isActive'],
    defaults: { imageUrl: null, legacyPath: null, sortOrder: 0, isActive: true },
    seed: () =>
      categories.map((category, index) => ({
        id: seedId(1, index),
        slug: category.slug,
        name: category.name,
        imageUrl: null,
        legacyPath: category.legacyPath,
        sortOrder: index,
        isActive: true,
        createdAt: SEEDED,
        updatedAt: SEEDED,
      })),
    check: (category, others) => {
      if (!SLUG.test(String(category.slug))) return invalid('categories_slug_check')
      if (noHebrew(category.name)) return invalid('categories_name_check')
      return duplicate(category, others, 'slug', 'categories_slug_key')
    },
    order: (a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.slug).localeCompare(String(b.slug)),
    inUse: async (category) => ((await tableRows('products')).some((product) => product.categoryId === category.id) ? 'products_category_id_fkey' : null),
  },
  products: {
    fields: ['woocommerceId', 'slug', 'sku', 'barcode', 'name', 'description', 'categoryId', 'brandId', 'listPrice', 'sortOrder', 'isActive', 'legacyPath', 'images'],
    required: ['slug', 'name', 'categoryId', 'sortOrder', 'isActive'],
    numeric: ['listPrice'],
    defaults: { woocommerceId: null, sku: null, barcode: null, description: null, brandId: null, listPrice: null, sortOrder: 0, isActive: true, legacyPath: null, images: [] },
    seed: async () => {
      const [{ default: products }, { default: prices }, categoryRows] = await Promise.all([
        import('@/stubs/products.json') as Promise<{ default: StubProduct[] }>,
        import('@/stubs/prices.json') as Promise<{ default: { prices: Record<string, number> } }>,
        tableRows('categories'),
      ])
      return products.map((product, index) => ({
        id: seedId(2, index),
        woocommerceId: Number(product.id),
        slug: product.slug,
        sku: null,
        barcode: null,
        name: product.name,
        description: product.description.he ? product.description : null,
        categoryId: categoryRows.find((category) => category.slug === product.category)?.id,
        brandId: null,
        listPrice: prices.prices[product.id] ?? null,
        sortOrder: index,
        isActive: true,
        legacyPath: null,
        images: product.image ? [{ url: product.image.src, thumbnailUrl: product.image.thumbnail, srcset: product.image.srcSet, alt: null }] : [],
        createdAt: SEEDED,
        updatedAt: SEEDED,
      }))
    },
    check: async (product, others) => {
      if (noHebrew(product.name)) return invalid('products_name_check')
      if (product.listPrice !== null && Number(product.listPrice) < 0) return invalid('products_list_price_check')
      if (!(await tableRows('categories')).some((category) => category.id === product.categoryId)) {
        return json({ error: 'invalid_reference', constraint: 'products_category_id_fkey' }, 400)
      }
      if (product.brandId !== null && !(await tableRows('brands')).some((brand) => brand.id === product.brandId)) {
        return json({ error: 'invalid_reference', constraint: 'products_brand_id_fkey' }, 400)
      }
      return duplicate(product, others, 'slug', 'products_slug_key') ?? duplicate(product, others, 'sku', 'products_sku_key')
    },
    order: (a, b) => Number(a.sortOrder) - Number(b.sortOrder) || a.id.localeCompare(b.id),
  },
  'price-rules': {
    fields: ['businessUserId', 'categoryId', 'productId', 'kind', 'value', 'startsOn', 'endsOn', 'isActive', 'note'],
    required: ['kind', 'value', 'isActive'],
    numeric: ['value'],
    defaults: { businessUserId: null, categoryId: null, productId: null, startsOn: null, endsOn: null, isActive: true, note: null },
    seed: () => [],
    check: (rule) => {
      if (!['percent', 'amount', 'fixed_price'].includes(String(rule.kind))) return invalid('price_rules_kind_check')
      if (Number(rule.value) <= 0) return invalid('price_rules_value_check')
      if ((rule.categoryId === null) === (rule.productId === null)) return invalid('price_rules_one_target_check')
      if (rule.kind === 'percent' && Number(rule.value) > 100) return invalid('price_rules_percent_max_check')
      if (rule.kind === 'fixed_price' && (rule.productId === null || rule.businessUserId === null)) return invalid('price_rules_fixed_price_target_check')
      if (rule.startsOn !== null && rule.endsOn !== null && String(rule.endsOn) < String(rule.startsOn)) return invalid('price_rules_dates_check')
      return null
    },
    order: (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  },
}

/**
 * Checks a row the way the database does: its required fields, then its table's constraints.
 * @param table - The table.
 * @param row - The row as it would be saved.
 * @param others - The table's other rows.
 * @returns The server's error answer, or null when the row is valid.
 */
async function refusal(table: FakeTable, row: StaffRow, others: StaffRow[]): Promise<Response | null> {
  const missing = table.required.find((field) => row[field] === null || row[field] === undefined)
  if (missing) return json({ error: 'required', field: missing }, 400)
  return table.check(row, others)
}

/**
 * Answers /api/staff/<resource>[/<id>] like the server's generic staff CRUD.
 * @param resource - The table's URL name, e.g. "price-rules".
 * @param method - The HTTP method.
 * @param id - The row id from the path, or null for the collection.
 * @param body - The request body (create/update).
 * @returns The answer.
 */
async function staffAnswer(resource: string, method: string, id: string | null, body: BodyInit | null | undefined): Promise<Response> {
  if (session?.kind !== 'staff') return json({ error: session ? 'forbidden' : 'unauthorized' }, session ? 403 : 401)
  const table = STAFF_TABLES[resource]
  if (!table) return json({ error: 'not_found' }, 404)
  const rows = await tableRows(resource)
  const values = body ? (JSON.parse(String(body)) as Record<string, unknown>) : {}
  const unknown = Object.keys(values).find((key) => !table.fields.includes(key))
  if (unknown) return json({ error: 'unknown_field', field: unknown }, 400)
  for (const key of table.numeric ?? []) if (typeof values[key] === 'string') values[key] = Number(values[key])
  const now = new Date().toISOString()
  if (id === null) {
    if (method === 'GET') return json([...rows].sort(table.order))
    if (method !== 'POST') return json({ error: 'not_found' }, 404)
    const row = { ...table.defaults, ...values, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as StaffRow
    const refused = await refusal(table, row, rows)
    if (refused) return refused
    rows.push(row)
    return json(row, 201)
  }
  const index = rows.findIndex((row) => row.id === id)
  if (index < 0) return json({ error: 'not_found' }, 404)
  if (method === 'GET') return json(rows[index])
  if (method === 'DELETE') {
    const constraint = await table.inUse?.(rows[index])
    if (constraint) return json({ error: 'in_use', constraint }, 409)
    rows.splice(index, 1)
    // A deleted category's or product's price rules go with it (ON DELETE CASCADE).
    const rules = await staffRows['price-rules']
    if (rules) rules.splice(0, rules.length, ...rules.filter((rule) => rule.categoryId !== id && rule.productId !== id))
    return json(undefined, 204)
  }
  if (method !== 'PATCH') return json({ error: 'not_found' }, 404)
  const row = { ...rows[index], ...values, updatedAt: now }
  const refused = await refusal(table, row, rows.filter((_, i) => i !== index))
  if (refused) return refused
  rows[index] = row
  return json(row)
}

/**
 * Builds a JSON answer.
 * @param body - The JSON body (undefined = no body).
 * @param status - The HTTP status; default 200.
 * @returns The response.
 */
function json(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/**
 * Answers /api/products like the server: search words must all appear in the name or description (any
 * language, any case), then the category filter, chip counts and a clamped page.
 * @param params - The query string.
 * @returns One page of results.
 */
async function productPage(params: URLSearchParams): Promise<ProductPage> {
  const { default: products } = (await import('@/stubs/products.json')) as { default: StubProduct[] }
  const words = (params.get('q') ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  const matching = products.filter((product) => {
    const text = [...Object.values(product.name), ...Object.values(product.description)].join(' ').toLowerCase()
    return words.every((word) => text.includes(word))
  })
  const categoryCounts = Object.fromEntries(categories.map((c) => [c.slug, matching.filter((p) => p.category === c.slug).length]))
  const requested = params.get('category')
  const applied = requested && requested in categoryCounts ? requested : null
  const shown = applied ? matching.filter((p) => p.category === applied) : matching
  const pageSize = Math.min(Math.max(Number(params.get('pageSize')) || PAGE_SIZE, 1), MAX_PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize))
  const page = Math.min(Math.max(Math.trunc(Number(params.get('page'))) || 1, 1), pageCount)
  const items = shown.slice((page - 1) * pageSize, page * pageSize).map(({ id, slug, name, category, image }) => ({ id, slug, name, category, image }))
  return { items, page, pageSize, pageCount, total: shown.length, category: applied, categoryCounts }
}

/**
 * Shapes a stub brand the way the server returns it.
 * @param brand - The brand from stubs/brands.json.
 * @returns The API brand.
 */
function brandJson(brand: (typeof brands)[number]): Brand {
  return { ...brand, description: null, logoUrl: null }
}

/** The articles, newest first (the server's order). */
const publishedArticles = [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

/**
 * The fake `fetch`: routes a request to the answer the backend would give.
 * @param input - The URL (relative URLs are read against http://localhost).
 * @param init - Method, body and abort signal.
 * @returns The response; rejects with an AbortError when the signal is already aborted.
 */
export async function fakeFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  if (init.signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError')
  const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost')
  const method = (init.method ?? 'GET').toUpperCase()
  const path = url.pathname
  /**
   * Reads the slug of a detail path, e.g. "/api/brands/paw" with prefix "/api/brands/" -> "paw".
   * @param prefix - The collection path with a trailing slash.
   * @returns The slug, or null when the path is not under the prefix.
   */
  const slug = (prefix: string) => (path.startsWith(prefix) ? decodeURIComponent(path.slice(prefix.length)) : null)

  const staff = /^\/api\/staff\/([a-z-]+)(?:\/(.+))?$/.exec(path)
  if (staff) return staffAnswer(staff[1], method, staff[2] ? decodeURIComponent(staff[2]) : null, init.body)

  if (method === 'GET') {
    if (path === '/api/categories') return json(categories satisfies ProductCategory[])
    if (path === '/api/products') return json(await productPage(url.searchParams))
    if (path === '/api/brands') return json(brands.map(brandJson))
    const brand = brands.find((b) => b.slug === slug('/api/brands/'))
    if (brand) return json(brandJson(brand))
    if (path === '/api/stats') return json(STATS)
    if (path === '/api/articles') return json(publishedArticles)
    const article = articles.find((a) => a.slug === slug('/api/articles/'))
    if (article) return json(article)
    if (path === '/api/resellers') return json(branches.map((b) => ({ approximate: false, ...b })) satisfies Branch[])
    if (path === '/api/prices') {
      const { default: prices } = await import('@/stubs/prices.json')
      return json({ currency: prices.currency, prices: prices.prices })
    }
    if (path === '/api/auth/me') return session ? json({ user: session }) : json({ error: 'unauthorized' }, 401)
  }
  if (method === 'POST') {
    if (path === '/api/auth/login') {
      const { email, password } = JSON.parse(String(init.body)) as { email: string; password: string }
      if (password === WRONG_PASSWORD) return json({ error: 'invalid_credentials' }, 401)
      session = { ...(email.toLowerCase() === TEST_STAFF.email ? TEST_STAFF : TEST_USER), email: email.toLowerCase() }
      return json({ user: session })
    }
    if (path === '/api/auth/logout') {
      session = null
      return json(undefined, 204)
    }
  }
  return json({ error: 'not_found' }, 404)
}
