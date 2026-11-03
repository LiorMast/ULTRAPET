/**
 * test/api.ts — A fake of the backend API for the Vitest tests, installed as `fetch` by setup.ts.
 *
 * It answers every /api call the site makes (src/api.ts) from the stub fixtures in src/stubs/ — the same files
 * `flask seed` loads into the database — with the server's semantics (backend/app/customers/routes.py): catalog
 * search in every language, category filter, chip counts and paging; brands and articles by slug; sign-in that
 * accepts any credentials except the password WRONG_PASSWORD. The staff API (backend/app/staff/routes.py) is
 * faked for brands: staff sign-in, and list/create/update/delete on an in-memory copy of the brand stubs with
 * the server's errors (401 without a staff sign-in, 400 required / invalid, 409 duplicate slug, 404).
 * Unknown paths answer 404. A test can replace one
 * answer with vi.spyOn(globalThis, 'fetch'); setup.ts restores the fake and signs it out after every test.
 */
import type { Brand, Branch, ProductCategory, ProductImage, ProductPage, StaffBrand, StaffUser, Stat, User } from '@/api'
import type { Localized } from '@/config'
import articles from '@/stubs/articles.json'
import branches from '@/stubs/branches.json'
import brands from '@/stubs/brands.json'
import categories from '@/stubs/product-categories.json'

/** The password the fake sign-in refuses (401 "invalid_credentials"). */
export const WRONG_PASSWORD = 'wrong-password'

/** The customer the fake sign-in returns (with the typed email). */
export const TEST_USER: User = { email: 'shop@example.com', fullName: 'Demo Customer', companyName: 'Demo Pet Shop' }

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

/** The staff user the fake staff sign-in returns (with the typed email). */
export const TEST_STAFF: StaffUser = { email: 'admin@example.com', fullName: 'Test Admin', role: 'admin' }

/** Who the fake thinks is signed in (by /api/auth/login), for /api/auth/me. */
let session: User | null = null

/** The staff user signed in to the fake staff API, for /api/staff/... */
let staffSession: StaffUser | null = null

/** The brands as the staff API stores them; rebuilt from the stubs on first use after every reset. */
let staffBrands: StaffBrand[] | null = null

/** Signs the fake out and forgets staff edits; setup.ts calls it after every test. */
export function resetFakeApi() {
  session = null
  staffSession = null
  staffBrands = null
}

/**
 * Signs a staff user in to the fake (renderPage's `staff` option).
 * @param user - The staff user.
 */
export function signInFakeStaff(user: StaffUser) {
  staffSession = user
}

/**
 * The staff brands, built from stubs/brands.json the way `flask seed` stores them.
 * @returns The in-memory rows (changed in place by the fake's create/update/delete).
 */
function brandRows(): StaffBrand[] {
  staffBrands ??= brands.map((brand, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    slug: brand.slug,
    name: brand.name,
    tagline: brand.tagline,
    description: null,
    accentColor: brand.accent,
    logoUrl: null,
    sortOrder: index + 1,
    isActive: true,
    createdAt: '2026-11-01T10:00:00+02:00',
    updatedAt: '2026-11-01T10:00:00+02:00',
  }))
  return staffBrands
}

/** The fields a staff brand request may send (the server's RESOURCES["brands"]). */
const BRAND_FIELDS = ['slug', 'name', 'tagline', 'description', 'accentColor', 'logoUrl', 'sortOrder', 'isActive']

/**
 * Checks a brand the way the database's constraints do (create-tables.sql).
 * @param brand - The brand as it would be saved.
 * @param others - The other brands (for the unique slug).
 * @returns The server's error answer, or null when the brand is valid.
 */
function brandError(brand: StaffBrand, others: StaffBrand[]): Response | null {
  for (const field of ['name', 'slug', 'sortOrder', 'isActive'] as const) {
    if (brand[field] === null || brand[field] === undefined) return json({ error: 'required', field }, 400)
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(brand.slug)) return json({ error: 'invalid', constraint: 'brands_slug_check' }, 400)
  if (brand.accentColor !== null && !/^#[0-9A-Fa-f]{6}$/.test(brand.accentColor)) return json({ error: 'invalid', constraint: 'brands_accent_color_check' }, 400)
  if (others.some((other) => other.slug === brand.slug)) return json({ error: 'duplicate', constraint: 'brands_slug_key' }, 409)
  return null
}

/**
 * Answers /api/staff/brands[/<id>] like the server's generic staff CRUD.
 * @param method - The HTTP method.
 * @param id - The row id from the path, or null for the collection.
 * @param body - The request body (create/update).
 * @returns The answer.
 */
function staffBrandsAnswer(method: string, id: string | null, body: BodyInit | null | undefined): Response {
  if (!staffSession) return json({ error: 'unauthorized' }, 401)
  const rows = brandRows()
  const values = body ? (JSON.parse(String(body)) as Record<string, unknown>) : {}
  const unknown = Object.keys(values).find((key) => !BRAND_FIELDS.includes(key))
  if (unknown) return json({ error: 'unknown_field', field: unknown }, 400)
  const now = new Date().toISOString()
  if (id === null) {
    if (method === 'GET') return json([...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)))
    if (method !== 'POST') return json({ error: 'not_found' }, 404)
    const brand = { tagline: null, description: null, accentColor: null, logoUrl: null, sortOrder: 0, isActive: true, ...values, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as StaffBrand
    const refused = brandError(brand, rows)
    if (refused) return refused
    rows.push(brand)
    return json(brand, 201)
  }
  const index = rows.findIndex((row) => row.id === id)
  if (index < 0) return json({ error: 'not_found' }, 404)
  if (method === 'GET') return json(rows[index])
  if (method === 'DELETE') {
    rows.splice(index, 1)
    return json(undefined, 204)
  }
  if (method !== 'PATCH') return json({ error: 'not_found' }, 404)
  const brand = { ...rows[index], ...values, updatedAt: now } as StaffBrand
  const refused = brandError(brand, rows.filter((_, i) => i !== index))
  if (refused) return refused
  rows[index] = brand
  return json(brand)
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

  if (path === '/api/staff/auth/me' && method === 'GET') return staffSession ? json({ user: staffSession }) : json({ error: 'unauthorized' }, 401)
  if (path === '/api/staff/auth/login' && method === 'POST') {
    const { email, password } = JSON.parse(String(init.body)) as { email: string; password: string }
    if (password === WRONG_PASSWORD) return json({ error: 'invalid_credentials' }, 401)
    staffSession = { ...TEST_STAFF, email: email.toLowerCase() }
    session = null
    return json({ user: staffSession })
  }
  if (path === '/api/staff/auth/logout' && method === 'POST') {
    staffSession = null
    return json(undefined, 204)
  }
  if (path === '/api/staff/brands') return staffBrandsAnswer(method, null, init.body)
  const staffBrandId = slug('/api/staff/brands/')
  if (staffBrandId) return staffBrandsAnswer(method, staffBrandId, init.body)

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
      session = { ...TEST_USER, email: email.toLowerCase() }
      return json({ user: session })
    }
    if (path === '/api/auth/logout') {
      session = null
      return json(undefined, 204)
    }
  }
  return json({ error: 'not_found' }, 404)
}
