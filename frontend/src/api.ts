/**
 * api.ts — The one API layer: every call the site makes to the Flask backend, and the types of what it
 * returns. Components never fetch: route loaders (and the auth provider) call these functions and pass the
 * data down through props. In dev, Vite proxies /api to the backend (vite.config.ts); the Vitest tests answer
 * these calls with a fake built from the stub fixtures (src/test/api.ts).
 *
 * Sign-in (backend/app/auth.py): the server keeps the JWTs in HttpOnly cookies, so this code never sees a token.
 * - Every POST/PUT/PATCH/DELETE sends the X-CSRF-TOKEN header, copied from the readable `csrf_access_token`
 *   cookie (the refresh call uses `csrf_refresh_token`), as the server's CSRF double-submit check requires.
 * - A 401 "token_expired" answer (the 15-minute access token ran out) triggers one refresh, then the request
 *   is sent again. Calls that fail at the same moment share that one refresh. Staff calls (/api/staff/...)
 *   refresh at the staff route, every other call at the customer route.
 * - When the sign-in is gone for good (the refresh failed, or any other 401 except a wrong password), the
 *   handler registered with setSignedOutHandler (by AuthProvider) is told, so the UI shows the visitor as
 *   signed out.
 *
 * Staff panel (backend/app/staff/routes.py): its own sign-in, and one generic create/read/update/delete API for
 * every resource (fetchStaffRows, createStaffRow, updateStaffRow, deleteStaffRow), used by the /admin pages and the
 * in-place editors; a resource edited as one ordered list (the FAQ) is saved whole with replaceStaffRows.
 */
import { notFound } from '@tanstack/react-router'
import type { Localized } from '@/config'
import type { Locale } from '@/i18n'

/** A product photo from the store: the full file, a 300px square thumbnail and a `srcset` of the sized copies. */
export type ProductImage = { src: string; thumbnail: string; srcSet: string }

/**
 * A catalog product as the list returns it: never a price (prices come only from fetchPrices, for a signed-in
 * customer). `name` holds one translation per language (show it with `localized()`); `category` is a
 * ProductCategory slug.
 */
export type Product = { id: string; slug: string; name: Localized<string>; category: string; image: ProductImage | null }

/**
 * A catalog category (the store's 15), e.g. { slug: 'dry-dog-food', name: { he, en } }. `imageUrl` is the photo of
 * its home page card that staff set (null = none: the card falls back to a bundled photo or an icon).
 */
export type ProductCategory = { slug: string; name: Localized<string>; legacyPath: string | null; imageUrl: string | null }

/**
 * One page of catalog results. `total` counts every product matching the category and search; `category` is
 * the filter the server applied (null when the URL's slug is unknown); `categoryCounts` gives, per category
 * slug, the products matching the search alone (the numbers on the category chips; "All" is their sum).
 */
export type ProductPage = {
  items: Product[]
  page: number
  pageSize: number
  pageCount: number
  total: number
  category: string | null
  categoryCounts: Record<string, number>
}

/** The URL state of the catalog: absent = page 1, every category, no search. */
export type CatalogSearch = { page?: number; category?: string; q?: string }

/** A signed-in customer's prices: product id → unit price in shekels before VAT. */
export type Prices = { currency: string; prices: Record<string, number> }

/**
 * A brand. `accent` null = the site red; `logoUrl` null = the logo file bundled with the site (see
 * brandLogo in config.ts), or the name as a wordmark.
 */
export type Brand = {
  slug: string
  name: string
  accent: string | null
  tagline: Localized<string> | null
  description: Localized<string> | null
  logoUrl: string | null
}

/** A company figure of the home page Stats band, e.g. { id: 'retail', value: 350, suffix: '+' }. */
export type Stat = { id: string; value: number; suffix: string }

/**
 * The customer-service contact details (settings contact_phone / contact_whatsapp / contact_email), as shown on the
 * site: the links use their digits (tel:, wa.me) or the address (mailto:). An unset one is "".
 */
export type ContactDetails = { phone: string; whatsapp: string; email: string }

/** One block of article text: a paragraph or a numbered list. */
export type ArticleBlock = { type: 'p'; text: string } | { type: 'ol'; items: string[] }

/**
 * An article (מאמר). `description` doubles as the meta description; `relatedCategories` are slugs of the home
 * page category cards (CATEGORIES in config.ts); `legacyPath` is the old WordPress URL, kept for the 301
 * redirects. Its photo is bundled with the site (see articleImage in config.ts).
 */
export type Article = {
  slug: string
  topic: 'cats' | 'dogs'
  publishedAt: string
  updatedAt: string
  title: Localized<string>
  description: Localized<string>
  imageAlt: Localized<string> | null
  body: Localized<ArticleBlock[]>
  relatedCategories: string[]
  legacyPath: string | null
}

/** A reseller store of the Where to Buy page, with its map position. */
export type Branch = {
  id: string
  name: string
  address: string
  city: string
  phone: string | null
  website: string | null
  lat: number
  lng: number
  /** True when the address could not be located and the pin sits at the city centre. */
  approximate: boolean
}

/** A font a staff member can pick for a text of an editable section (FONTS in config.ts); "default" = the site's own. */
export type FontKey = 'default' | 'heebo' | 'rubik' | 'assistant' | 'frank-ruhl-libre' | 'inter' | 'montserrat'

/** A text size step of an editable section; "md" is the size the design was made for. */
export type SizeStep = 'sm' | 'md' | 'lg' | 'xl'

/**
 * One editable text of a section: its words, font and size per language. Every part is optional: a missing or
 * empty text shows the dictionary's, a missing font the site's own, a missing size "md".
 */
export type SectionText = {
  text?: Partial<Record<Locale, string>>
  font?: Partial<Record<Locale, FontKey>>
  size?: Partial<Record<Locale, SizeStep>>
}

/**
 * The saved content of an editable home section other than the hero (page_sections rows "stats", "brands",
 * "categories", "about", "faq", "contact"): one SectionText per text, by the section's text keys (e.g. "title",
 * "pillar.expertise.text"). A missing key shows the dictionary's text.
 */
export type SectionContent = Partial<Record<string, SectionText>>

/**
 * The hero's saved content (page_sections row "hero"): the title (`text` = the white words, `accent` = the red
 * word), the tagline and the description.
 */
export type HeroContent = {
  title?: SectionText & { accent?: Partial<Record<Locale, string>> }
  tagline?: SectionText
  description?: SectionText
}

/**
 * A question of the home page FAQ section (table faq_items) and its answer, per language. A language may be missing:
 * the site shows the question only in the languages where both texts are there (see shownFaq in Faq.tsx).
 */
export type FaqItem = { id: string; question: Partial<Record<Locale, string>>; answer: Partial<Record<Locale, string>> }

/** A question as the FAQ editor saves it: with the `id` of the row it keeps, or without one for a new question. */
export type FaqItemInput = Omit<FaqItem, 'id'> & { id?: string }

/** The signed-in user: a business customer ("business") or an Ultra Pet staff member ("staff", no company). */
export type User = { kind: 'business' | 'staff'; email: string; fullName: string; companyName: string | null }

/** The fields of a JSON error answer, e.g. { error: 'duplicate', constraint: 'brands_slug_key' }. */
export type ApiErrorBody = { error?: string; field?: string; constraint?: string }

/**
 * A failed API call: the HTTP status and the server's error code (e.g. "invalid_credentials"), if any. The
 * staff API also names the JSON `field` (e.g. "slug") or the database `constraint` that refused the change.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly field?: string
  readonly constraint?: string

  /**
   * @param status - The HTTP status, e.g. 404.
   * @param body - The JSON answer's `error` (the code), `field` and `constraint`, when it had them.
   */
  constructor(status: number, { error, field, constraint }: ApiErrorBody = {}) {
    super(`API error ${status}${error ? ` (${error})` : ''}`)
    this.name = 'ApiError'
    this.status = status
    this.code = error
    this.field = field
    this.constraint = constraint
  }
}

/** Options of one API call. `csrf` picks the CSRF cookie to send (only the refresh call uses 'refresh'). */
type CallOptions = { method?: string; body?: unknown; signal?: AbortSignal; csrf?: 'access' | 'refresh' }

/** Methods the server checks for the CSRF header. */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Reads a cookie the page is allowed to see (the CSRF cookies; the JWT cookies are HttpOnly).
 * @param name - The cookie name.
 * @returns Its value, or undefined when it is not set.
 */
function readCookie(name: string): string | undefined {
  const prefix = `${name}=`
  const cookie = document.cookie.split('; ').find((c) => c.startsWith(prefix))
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined
}

/**
 * Sends one request (JSON in and out, same-origin cookies, the CSRF header on unsafe methods).
 * @param path - The API path, e.g. "/api/brands".
 * @param options - Method, JSON body, abort signal and which CSRF cookie to send.
 * @returns The raw response.
 */
function send(path: string, { method = 'GET', body, signal, csrf = 'access' }: CallOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = UNSAFE_METHODS.has(method) ? readCookie(csrf === 'refresh' ? 'csrf_refresh_token' : 'csrf_access_token') : undefined
  if (token) headers['X-CSRF-TOKEN'] = token
  return fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal, credentials: 'same-origin' })
}

/**
 * Reads the string fields of a JSON error answer.
 * @param response - The response (its body is consumed).
 * @returns `error`, `field` and `constraint` where present; empty when the body is not a JSON object.
 */
async function errorBody(response: Response): Promise<ApiErrorBody> {
  try {
    const data: unknown = await response.json()
    if (typeof data !== 'object' || !data) return {}
    const body: ApiErrorBody = {}
    for (const key of ['error', 'field', 'constraint'] as const) {
      const value = (data as Record<string, unknown>)[key]
      if (typeof value === 'string') body[key] = value
    }
    return body
  } catch {
    return {}
  }
}

/** The refresh in flight per refresh route, shared by the calls that got "token_expired" at the same time. */
const refreshing = new Map<string, Promise<boolean>>()

/** Told when the sign-in is gone (see setSignedOutHandler). */
let signedOutHandler: (() => void) | null = null

/**
 * Registers who to tell when the sign-in is gone (AuthProvider clears its user).
 * @param handler - The callback, or null to unregister.
 */
export function setSignedOutHandler(handler: (() => void) | null) {
  signedOutHandler = handler
}

/**
 * Gets a new access token with the refresh token (one refresh at a time).
 * @returns true when the server issued a new access token.
 */
function refreshAccess(): Promise<boolean> {
  const route = '/api/auth/refresh'
  let pending = refreshing.get(route)
  if (!pending) {
    pending = send(route, { method: 'POST', csrf: 'refresh' })
      .then((response) => response.ok, () => false)
      .finally(() => refreshing.delete(route))
    refreshing.set(route, pending)
  }
  return pending
}

/**
 * Calls the API: sends the request, refreshes an expired sign-in once and retries, and parses the JSON answer.
 * @param path - The API path, e.g. "/api/products?page=2".
 * @param options - Method, JSON body, abort signal.
 * @returns The parsed JSON (undefined for a 204 answer).
 * @throws ApiError for any answer other than 2xx (after telling the signed-out handler on a lost sign-in).
 */
export async function apiFetch<T>(path: string, options: CallOptions = {}): Promise<T> {
  let response = await send(path, options)
  if (response.status === 401 && (await errorBody(response.clone())).error === 'token_expired' && (await refreshAccess())) {
    response = await send(path, options)
  }
  if (!response.ok) {
    const body = await errorBody(response)
    if (response.status === 401 && body.error !== 'invalid_credentials') signedOutHandler?.()
    throw new ApiError(response.status, body)
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}

/**
 * Route-loader helper: turns an API 404 into the router's "not found" page and rethrows anything else.
 * @param error - What the API call threw.
 * @throws The router's notFound() for a 404, else the error itself.
 */
export function rethrowNotFound(error: unknown): never {
  throw error instanceof ApiError && error.status === 404 ? notFound() : error
}

/**
 * The catalog categories, in display order.
 * @param signal - Aborts the request (the router passes its loader's signal).
 * @returns The categories.
 */
export const fetchCategories = (signal?: AbortSignal) => apiFetch<ProductCategory[]>('/api/categories', { signal })

/**
 * One page of the catalog; filtering, search and paging happen on the server.
 * @param search - The catalog URL state (category slug, search text, page).
 * @param signal - Aborts the request (a newer search replaces it).
 * @returns The page of products with its totals and chip counts.
 */
export function fetchProducts({ category, q, page }: CatalogSearch, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (q) params.set('q', q)
  if (page && page > 1) params.set('page', String(page))
  const query = params.toString()
  return apiFetch<ProductPage>(`/api/products${query ? `?${query}` : ''}`, { signal })
}

/**
 * The signed-in customer's prices.
 * @returns The prices by product id; throws ApiError 401/403 when no customer is signed in.
 */
export const fetchPrices = () => apiFetch<Prices>('/api/prices')

/**
 * The brands, in display order.
 * @param signal - Aborts the request.
 * @returns The active brands.
 */
export const fetchBrands = (signal?: AbortSignal) => apiFetch<Brand[]>('/api/brands', { signal })

/**
 * One brand.
 * @param slug - The brand's URL name.
 * @param signal - Aborts the request.
 * @returns The brand; throws ApiError 404 when it is unknown.
 */
export const fetchBrand = (slug: string, signal?: AbortSignal) => apiFetch<Brand>(`/api/brands/${encodeURIComponent(slug)}`, { signal })

/**
 * The company figures of the Stats band, in display order.
 * @param signal - Aborts the request.
 * @returns The figures.
 */
export const fetchStats = (signal?: AbortSignal) => apiFetch<Stat[]>('/api/stats', { signal })

/**
 * The customer-service contact details.
 * @param signal - Aborts the request.
 * @returns The phone, WhatsApp number and email as shown on the site.
 */
export const fetchContact = (signal?: AbortSignal) => apiFetch<ContactDetails>('/api/contact', { signal })

/**
 * The content staff saved for every editable home page section, in one call.
 * @param signal - Aborts the request.
 * @returns The content by section key; a section never edited is missing.
 */
export const fetchSections = (signal?: AbortSignal) => apiFetch<Partial<Record<string, unknown>>>('/api/sections', { signal })

/**
 * The questions of the home page FAQ section.
 * @param signal - Aborts the request.
 * @returns The questions in display order, every language of each.
 */
export const fetchFaq = (signal?: AbortSignal) => apiFetch<FaqItem[]>('/api/faq', { signal })

/**
 * The published articles, newest first.
 * @param signal - Aborts the request.
 * @returns The articles.
 */
export const fetchArticles = (signal?: AbortSignal) => apiFetch<Article[]>('/api/articles', { signal })

/**
 * One published article.
 * @param slug - The article's URL name.
 * @param signal - Aborts the request.
 * @returns The article; throws ApiError 404 when it is unknown or not published.
 */
export const fetchArticle = (slug: string, signal?: AbortSignal) => apiFetch<Article>(`/api/articles/${encodeURIComponent(slug)}`, { signal })

/**
 * The reseller stores of the Where to Buy page.
 * @param signal - Aborts the request.
 * @returns The active stores.
 */
export const fetchResellers = (signal?: AbortSignal) => apiFetch<Branch[]>('/api/resellers', { signal })

/**
 * Who is signed in, according to the server (the JWT cookies).
 * @param signal - Aborts the request.
 * @returns The customer or staff user, or null when nobody is signed in.
 */
export async function fetchSession(signal?: AbortSignal): Promise<User | null> {
  try {
    return (await apiFetch<{ user: User }>('/api/auth/me', { signal })).user
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null
    throw error
  }
}

/**
 * Signs a business customer or a staff member in; the server sets the JWT cookies.
 * @param credentials - Email, password and "remember me" (the cookies then last 30 days).
 * @returns The signed-in user; throws ApiError 401 "invalid_credentials" for a wrong email or password.
 */
export async function postSignIn(credentials: { email: string; password: string; remember: boolean }): Promise<User> {
  return (await apiFetch<{ user: User }>('/api/auth/login', { method: 'POST', body: credentials })).user
}

/**
 * Signs out; the server expires the JWT cookies.
 * @returns Resolves when the server answered.
 */
export const postSignOut = () => apiFetch<void>('/api/auth/logout', { method: 'POST' })

/** The tables the staff API edits (RESOURCES in backend/app/staff/routes.py). */
export type StaffResource = 'brands' | 'categories' | 'products' | 'price-rules' | 'settings' | 'articles' | 'resellers' | 'page-sections' | 'faq-items'

/** The staff resources edited as one ordered list, which replaceStaffRows saves whole (`replaceable` on the server). */
export type StaffListResource = 'faq-items'

/** What every staff row carries besides its fields: when it was created and last changed (ISO timestamps). */
type StaffRowBase = { createdAt: string; updatedAt: string }

/** A brand as the staff API returns it (every column, active or not). */
export type StaffBrand = StaffRowBase & {
  id: string
  slug: string
  name: string
  tagline: Localized<string> | null
  description: Localized<string> | null
  accentColor: string | null
  logoUrl: string | null
  sortOrder: number
  isActive: boolean
}

/** A catalog category as the staff API returns it (every column, active or not). */
export type StaffCategory = StaffRowBase & {
  id: string
  slug: string
  name: Localized<string>
  imageUrl: string | null
  legacyPath: string | null
  sortOrder: number
  isActive: boolean
}

/** A product photo as the staff API stores it; the first of a product's photos is its main photo. */
export type StaffProductImage = { url: string; thumbnailUrl: string | null; srcset: string | null; alt: Localized<string> | null }

/** A product as the staff API returns it (every column, active or not). `listPrice`: shekels before VAT. */
export type StaffProduct = StaffRowBase & {
  id: string
  woocommerceId: number | null
  slug: string
  sku: string | null
  barcode: string | null
  name: Localized<string>
  description: Localized<string> | null
  categoryId: string
  brandId: string | null
  listPrice: number | null
  sortOrder: number
  isActive: boolean
  legacyPath: string | null
  images: StaffProductImage[]
}

/**
 * A price rule (table price_rules): a discount on one category or one product, for every customer
 * (`businessUserId` null) or one customer. `kind` "percent" / "amount" (shekels before VAT): `value` (> 0) is
 * what is taken off; "fixed_price" (one customer, one product): the price itself.
 * `startsOn` / `endsOn` are Israel dates ("2026-11-03", inclusive); null = no limit.
 */
export type StaffPriceRule = StaffRowBase & {
  id: string
  businessUserId: string | null
  categoryId: string | null
  productId: string | null
  kind: 'percent' | 'amount' | 'fixed_price'
  value: number
  startsOn: string | null
  endsOn: string | null
  isActive: boolean
  note: string | null
}

/**
 * Every row of a staff resource, active or not, in display order.
 * @param resource - The table, e.g. "brands".
 * @param signal - Aborts the request.
 * @returns The rows; throws ApiError 401/403 without a staff sign-in.
 */
export const fetchStaffRows = <Row,>(resource: StaffResource, signal?: AbortSignal) => apiFetch<Row[]>(`/api/staff/${resource}`, { signal })

/**
 * Creates a row; fields left out take their database default.
 * @param resource - The table.
 * @param values - The fields, with camelCase keys (e.g. { slug, name, sortOrder }).
 * @returns The saved row; throws ApiError 400 (invalid / required, with `field`) or 409 (duplicate).
 */
export const createStaffRow = <Row,>(resource: StaffResource, values: Record<string, unknown>) =>
  apiFetch<Row>(`/api/staff/${resource}`, { method: 'POST', body: values })

/**
 * Changes some fields of a row; the others stay as they are.
 * @param resource - The table.
 * @param key - The row's id (the key text for settings).
 * @param changes - The changed fields only.
 * @returns The saved row; throws ApiError 404, 400 or 409 like createStaffRow.
 */
export const updateStaffRow = <Row,>(resource: StaffResource, key: string, changes: Record<string, unknown>) =>
  apiFetch<Row>(`/api/staff/${resource}/${encodeURIComponent(key)}`, { method: 'PATCH', body: changes })

/**
 * Deletes a row.
 * @param resource - The table.
 * @param key - The row's id (the key text for settings).
 * @returns Resolves when deleted; throws ApiError 409 "in_use" when other rows still need it.
 */
export const deleteStaffRow = (resource: StaffResource, key: string) =>
  apiFetch<void>(`/api/staff/${resource}/${encodeURIComponent(key)}`, { method: 'DELETE' })

/**
 * Stores the content of an editable page section: changes its page_sections row, or creates it on the first save.
 * @param key - The section, e.g. "about".
 * @param content - Its whole new content.
 * @param saved - Whether the row exists already (the page loaded content for it).
 * @returns The saved row; throws ApiError like createStaffRow / updateStaffRow.
 */
export const saveSection = (key: string, content: object, saved: boolean) =>
  saved ? updateStaffRow('page-sections', key, { content }) : createStaffRow('page-sections', { key, content })

/**
 * Stores one site setting: changes its value, or creates the setting when it does not exist yet.
 * @param key - The setting, e.g. "stat_retail_value".
 * @param value - Its new JSON value.
 * @returns The saved row; throws ApiError like updateStaffRow (other than 404) or createStaffRow.
 */
export async function saveSetting(key: string, value: unknown): Promise<unknown> {
  try {
    return await updateStaffRow('settings', key, { value })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return createStaffRow('settings', { key, value })
    throw error
  }
}

/**
 * Replaces the whole list of a list resource in one transaction: rows with an `id` are kept and changed, rows without
 * one are created, rows left out are deleted, and the order of `rows` becomes the display order (sortOrder).
 * @param resource - The list, e.g. "faq-items".
 * @param rows - The new list, in display order.
 * @returns The saved rows in order; throws ApiError 400 (an invalid field, or an `id` no longer in the table) and
 *   nothing is changed.
 */
export const replaceStaffRows = <Row,>(resource: StaffListResource, rows: Record<string, unknown>[]) =>
  apiFetch<Row[]>(`/api/staff/${resource}`, { method: 'PUT', body: rows })
