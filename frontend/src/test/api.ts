/**
 * test/api.ts — A fake of the backend API for the Vitest tests, installed as `fetch` by setup.ts.
 *
 * It answers every /api call the site makes (src/api.ts) from the stub fixtures in src/stubs/ — the same files
 * `flask seed` loads into the database — with the server's semantics (backend/app/customers/routes.py): catalog
 * search in every language, category filter, chip counts and paging; a product page by slug (its gallery, related
 * products of the category, 404 for an unknown slug); brands and articles by slug; sign-in that
 * accepts any credentials except the password WRONG_PASSWORD (the email admin@example.com signs in as the staff
 * user TEST_STAFF, anyone else as the customer TEST_USER). The staff API (backend/app/staff/routes.py) is
 * faked for brands, categories, products, price rules, settings, page sections, FAQ items and customers: list/create/update/delete
 * on in-memory copies of the stubs (no price rules or page sections at first; GET /api/sections and
 * /api/sections/<key> read the latter, GET /api/faq the FAQ items, GET /api/stats and /api/contact the settings, seeded
 * with STATS and stubs/contact.json), the FAQ's PUT that replaces the whole list at once (all or nothing), the categories'
 * PUT /order, the brands' and the products' (every id once, in the new order; a new category, brand or product also gets
 * the server's slug and last place), with the
 * server's errors (401 signed out, 403 for a customer, 400 required / a failed check / an unknown reference or id, 405 PUT on
 * another table, 409 duplicate or in use, 404) and its cascade (a deleted category's or product's price rules go with
 * it). The customers table starts with STAFF_CUSTOMERS: a new one needs a password (8+ characters, write-only: never
 * stored nor answered), the email is lowercased and unique, and DELETE is 405 (customers are never deleted).
 * POST /api/staff/uploads fakes the S3-stub upload (staff only; folder "categories" or "brands"; JPEG/PNG/WebP/AVIF by the
 * file's type, at most 5 MB; answers `/api/media/<folder>/fake-<n>.<ext>`, nothing is stored; the server names it
 * `<folder>/<UTC timestamp>_<uuid>.<ext>`). A picture field
 * (`media`, e.g. a category's imageUrl) takes only one of our objects, like the server's media_key: an object key or
 * its `/api/media/` URL ("" = none); anything else (another site's URL, "../x") is 400 invalid. The server stores the
 * key and answers its URL; the fake keeps the URL, which answers the same with no S3 bucket configured. The stub
 * products' photos are object keys too, answered as `/api/media/<key>` URLs (mediaImage).
 * Unknown paths answer 404. A test can replace one
 * answer with vi.spyOn(globalThis, 'fetch'); setup.ts restores the fake and signs it out after every test.
 */
import type { Brand, Branch, ContactDetails, ProductCategory, ProductDetail, ProductImage, ProductPage, Stat, StaffCustomer, User } from '@/api'
import type { Localized } from '@/config'
import articles from '@/stubs/articles.json'
import branches from '@/stubs/branches.json'
import brands from '@/stubs/brands.json'
import contact from '@/stubs/contact.json'
import faq from '@/stubs/faq.json'
import categories from '@/stubs/product-categories.json'

/** The password the fake sign-in refuses (401 "invalid_credentials"). */
export const WRONG_PASSWORD = 'wrong-password'

/** The customer the fake sign-in returns (with the typed email). */
export const TEST_USER: User = { kind: 'business', email: 'shop@example.com', fullName: 'Demo Customer', companyName: 'Demo Pet Shop' }

/** The business customers the staff table "customers" starts with: the test customer, plus an inactive one. */
export const STAFF_CUSTOMERS: StaffCustomer[] = [
  {
    id: '00000000-0000-4000-8000-000000000001', companyName: TEST_USER.companyName ?? '', fullName: TEST_USER.fullName, email: TEST_USER.email,
    phone: '03-5551234', businessNumber: '512345678', city: 'Tel Aviv', address: null, rivhitCustomerId: null, notes: null, isActive: true,
    lastLoginAt: '2026-11-01T08:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000002', companyName: 'Zoo Haifa', fullName: 'Noa Levi', email: 'zoo@example.com',
    phone: null, businessNumber: null, city: 'Haifa', address: null, rivhitCustomerId: null, notes: null, isActive: false,
    lastLoginAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

/** The home page figures the fake serves (the values `flask seed` takes from the legacy CMS). */
export const STATS: Stat[] = [
  { id: 'retail', value: 350, suffix: '+' },
  { id: 'partners', value: 15, suffix: '+' },
  { id: 'products', value: 1000, suffix: '+' },
  { id: 'years', value: 12, suffix: '+' },
]

/** A product photo as stored in stubs/products.json: object keys (thumbnail and srcset may be missing) and its alt text. */
type StubImage = { src: string; thumbnail: string | null; srcSet: string | null; alt: Partial<Record<string, string>> | null }

/** A product as stored in stubs/products.json (description = sanitized HTML; brand = a brands.json slug). */
type StubProduct = {
  id: string
  slug: string
  name: Localized<string>
  description: Partial<Record<string, string>>
  category: string
  brand: string | null
  sku: string | null
  barcode: string | null
  legacyPath: string | null
  images: StubImage[]
}

/** The brands the public API shows: the stub's active ones (a brand found only in product names is inactive). */
const activeBrands = brands.filter((brand) => brand.active !== false)

/** How many related products a product page suggests (as on the server). */
const RELATED_COUNT = 4

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

/** How many files the fake upload route took (numbers the fake URLs). */
let uploadCount = 0

/** Signs the fake out and forgets staff edits; setup.ts calls it after every test. */
export function resetFakeApi() {
  session = null
  staffRows = {}
  uploadCount = 0
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
 * @param table - A number per table: brands 0, categories 1, products 2, FAQ items 3.
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
 * - `key`: the field that names a row in the URL when it is not a generated `id` (page sections: "key").
 * - `replaceable`: PUT replaces the whole list (`replaceable` on the server; the table has a sortOrder field).
 * - `orderable`: PUT /order sets the order from a list of ids (`orderable` on the server; a sortOrder field).
 * - `createDefaults`: fills a new row's missing values from the table (`create_defaults` on the server).
 * - `media`: picture fields (the server's media_key converter), see mediaUrl.
 * - `convert`: the server's own field converters (e.g. a customer's email and password), run on the request's values
 *   before anything else: changes them in place, or answers the error. `writeOnly`: fields accepted but never stored
 *   nor answered (a password). `deletable` false: DELETE is 405 (customers are switched off, never deleted).
 */
type FakeTable = {
  key?: string
  convert?: (values: Record<string, unknown>, creating: boolean) => Response | null
  writeOnly?: string[]
  deletable?: boolean
  replaceable?: boolean
  orderable?: boolean
  createDefaults?: (values: Record<string, unknown>, rows: StaffRow[]) => Record<string, unknown>
  fields: string[]
  required: string[]
  numeric?: string[]
  media?: string[]
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

/**
 * Builds the create defaults of a table whose URL name and order the staff panel hides, like the server's
 * new_row_defaults (categories, brands, products).
 * @param fallback - The URL name when the name gives none, e.g. "category".
 * @returns A function (values, rows) -> the values plus `slug` (the English name, or a brand's plain name, slugified,
 *   else `fallback`; "-2", "-3", ... when taken) and `sortOrder` (after the last row) when missing.
 */
const newRowDefaults = (fallback: string) => (values: Record<string, unknown>, rows: StaffRow[]): Record<string, unknown> => {
  const filled = { ...values }
  if (!filled.slug) {
    const name = typeof filled.name === 'string' ? filled.name : ((filled.name as Partial<Localized<string>> | undefined)?.en ?? '')
    const base = name.toLowerCase().match(/[a-z0-9]+/g)?.join('-') || fallback
    let slug = base
    for (let n = 2; rows.some((row) => row.slug === slug); n++) slug = `${base}-${n}`
    filled.slug = slug
  }
  if (filled.sortOrder === undefined || filled.sortOrder === null) {
    filled.sortOrder = rows.length ? Math.max(...rows.map((row) => Number(row.sortOrder))) + 1 : 0
  }
  return filled
}

/**
 * The server's email and password converters and its require_password (backend/app/staff/routes.py): the email
 * trimmed and lowercased, a password of 8 to 128 characters, required on a new customer.
 * @param values - The request's values (the email is changed in place).
 * @param creating - True for POST.
 * @returns The 400 answer, or null when the values are fine.
 */
function customerFields(values: Record<string, unknown>, creating: boolean): Response | null {
  if ('email' in values && values.email !== null) {
    if (typeof values.email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())) return json({ error: 'invalid', field: 'email' }, 400)
    values.email = values.email.trim().toLowerCase()
  }
  if ('password' in values && (typeof values.password !== 'string' || values.password.length < 8 || values.password.length > 128)) {
    return json({ error: 'invalid', field: 'password' }, 400)
  }
  if (creating && !('password' in values)) return json({ error: 'required', field: 'password' }, 400)
  return null
}

/** The staff tables the fake serves, by their URL name. */
const STAFF_TABLES: Record<string, FakeTable> = {
  brands: {
    fields: ['slug', 'name', 'tagline', 'description', 'accentColor', 'logoUrl', 'sortOrder', 'isActive'],
    required: ['name', 'slug', 'sortOrder', 'isActive'],
    media: ['logoUrl'],
    orderable: true,
    createDefaults: newRowDefaults('brand'),
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
        isActive: brand.active !== false,
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
    media: ['imageUrl'],
    orderable: true,
    createDefaults: newRowDefaults('category'),
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
    orderable: true,
    createDefaults: newRowDefaults('product'),
    defaults: { woocommerceId: null, sku: null, barcode: null, description: null, brandId: null, listPrice: null, sortOrder: 0, isActive: true, legacyPath: null, images: [] },
    seed: async () => {
      const [{ default: products }, { default: prices }, categoryRows, brandRows] = await Promise.all([
        import('@/stubs/products.json') as Promise<{ default: StubProduct[] }>,
        import('@/stubs/prices.json') as Promise<{ default: { prices: Record<string, number> } }>,
        tableRows('categories'),
        tableRows('brands'),
      ])
      return products.map((product, index) => ({
        id: seedId(2, index),
        woocommerceId: Number(product.id),
        slug: product.slug,
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        description: product.description.he ? product.description : null,
        categoryId: categoryRows.find((category) => category.slug === product.category)?.id,
        brandId: brandRows.find((brand) => brand.slug === product.brand)?.id ?? null,
        listPrice: prices.prices[product.id] ?? null,
        sortOrder: index,
        isActive: true,
        legacyPath: null,
        images: product.images.map((image) => {
          const { src, thumbnail, srcSet } = mediaImage(image)
          return { url: src, thumbnailUrl: thumbnail, srcset: srcSet, alt: image.alt }
        }),
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
    fields: ['businessUserId', 'categoryId', 'productId', 'kind', 'value', 'startsOn', 'endsOn', 'minQuantity', 'isActive', 'note'],
    required: ['kind', 'value', 'isActive'],
    numeric: ['value', 'minQuantity'],
    defaults: { businessUserId: null, categoryId: null, productId: null, startsOn: null, endsOn: null, minQuantity: null, isActive: true, note: null },
    seed: () => [],
    check: (rule) => {
      if (!['percent', 'amount', 'fixed_price'].includes(String(rule.kind))) return invalid('price_rules_kind_check')
      if (Number(rule.value) <= 0) return invalid('price_rules_value_check')
      if ((rule.categoryId === null) === (rule.productId === null)) return invalid('price_rules_one_target_check')
      if (rule.kind === 'percent' && Number(rule.value) > 100) return invalid('price_rules_percent_max_check')
      if (rule.kind === 'fixed_price' && (rule.productId === null || rule.businessUserId === null)) return invalid('price_rules_fixed_price_target_check')
      if (rule.startsOn !== null && rule.endsOn !== null && String(rule.endsOn) < String(rule.startsOn)) return invalid('price_rules_dates_check')
      if (rule.minQuantity !== null && !(Number.isInteger(Number(rule.minQuantity)) && Number(rule.minQuantity) >= 2)) return invalid('price_rules_min_quantity_check')
      if (rule.kind === 'fixed_price' && rule.minQuantity !== null) return invalid('price_rules_fixed_price_bulk_check')
      return null
    },
    order: (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  },
  settings: {
    key: 'key',
    fields: ['key', 'value', 'description'],
    required: ['key', 'value'],
    defaults: { description: null },
    seed: () =>
      [
        ...STATS.flatMap((stat) => [
          [`stat_${stat.id}_value`, stat.value],
          [`stat_${stat.id}_suffix`, stat.suffix],
        ]),
        ...Object.entries(contact).map(([field, value]) => [`contact_${field}`, value]),
      ].map(([key, value]) => ({ id: String(key), key, value, description: null, createdAt: SEEDED, updatedAt: SEEDED })),
    check: (setting, others) => {
      if (!/^[a-z0-9_]+$/.test(String(setting.key))) return invalid('settings_key_check')
      return duplicate(setting, others, 'key', 'settings_pkey')
    },
    order: (a, b) => String(a.key).localeCompare(String(b.key)),
  },
  'page-sections': {
    key: 'key',
    fields: ['key', 'content'],
    required: ['key', 'content'],
    defaults: {},
    seed: () => [],
    check: (section, others) => {
      if (!/^[a-z0-9_]+$/.test(String(section.key))) return invalid('page_sections_key_check')
      if (typeof section.content !== 'object' || section.content === null || Array.isArray(section.content)) return json({ error: 'invalid', field: 'content' }, 400)
      return duplicate(section, others, 'key', 'page_sections_pkey')
    },
    order: (a, b) => String(a.key).localeCompare(String(b.key)),
  },
  'faq-items': {
    replaceable: true,
    fields: ['question', 'answer', 'sortOrder'],
    required: ['question', 'answer', 'sortOrder'],
    defaults: { sortOrder: 0 },
    seed: () =>
      faq.map((item, index) => ({
        id: seedId(3, index),
        question: item.question,
        answer: item.answer,
        sortOrder: index,
        createdAt: SEEDED,
        updatedAt: SEEDED,
      })),
    check: (item) => {
      for (const field of ['question', 'answer']) {
        const value = item[field]
        if (typeof value !== 'object' || value === null || Array.isArray(value) || !Object.values(value).every((text) => typeof text === 'string')) {
          return json({ error: 'invalid', field }, 400)
        }
      }
      return null
    },
    order: (a, b) => Number(a.sortOrder) - Number(b.sortOrder) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  },
  customers: {
    fields: ['email', 'password', 'fullName', 'phone', 'companyName', 'businessNumber', 'city', 'address', 'rivhitCustomerId', 'notes', 'isActive'],
    required: ['email', 'fullName', 'companyName', 'isActive'],
    defaults: { phone: null, businessNumber: null, city: null, address: null, rivhitCustomerId: null, notes: null, isActive: true, lastLoginAt: null },
    convert: customerFields,
    writeOnly: ['password'],
    deletable: false,
    seed: () => STAFF_CUSTOMERS.map((customer) => ({ ...customer })),
    check: (customer, others) => {
      if (customer.businessNumber !== null && !/^[0-9]{9}$/.test(String(customer.businessNumber))) return invalid('business_users_business_number_check')
      return duplicate(customer, others, 'email', 'app_users_email_key') ?? duplicate(customer, others, 'businessNumber', 'business_users_business_number_key')
    },
    order: (a, b) => String(a.companyName).localeCompare(String(b.companyName)) || String(a.email).localeCompare(String(b.email)),
  },
}

/** Where the server's S3 stub serves its objects (storage.MEDIA_URL; no bucket is configured in tests). */
const MEDIA_URL = '/api/media/'

/** The shape of an object key, "<folder>/<name>.<ext>" (storage.KEY_PATTERN on the server). */
const OBJECT_KEY = /^[a-z0-9-]+\/[A-Za-z0-9_-]+\.[a-z0-9]+$/

/**
 * A stub product photo (object keys) as the server answers it: every key turned into its URL.
 * @param image - The photo from stubs/products.json.
 * @returns The photo with `/api/media/<key>` URLs (the srcset's entries too; a missing thumbnail = the photo, a
 * missing srcset = "").
 */
function mediaImage(image: StubImage): ProductImage {
  const srcSet = (image.srcSet ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => `${MEDIA_URL}${entry}`)
    .join(', ')
  return { src: `${MEDIA_URL}${image.src}`, thumbnail: `${MEDIA_URL}${image.thumbnail ?? image.src}`, srcSet }
}

/**
 * Reads a picture field like the server's media_key converter: an object key, or our URL of it.
 * @param value - The JSON value.
 * @returns The URL the server would answer (null for none), or undefined when the value is not one of our objects.
 */
function mediaUrl(value: unknown): string | null | undefined {
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const key = value.startsWith(MEDIA_URL) ? value.slice(MEDIA_URL.length) : value
  return OBJECT_KEY.test(key) ? `${MEDIA_URL}${key}` : undefined
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
 * Answers PUT /api/staff/<resource> like the server's replace_rows: the body is the new list in display order (an
 * item with an `id` keeps and changes that row, one without is new, rows left out are deleted, sortOrder = the
 * position); any refusal leaves the table as it was.
 * @param table - The table (must be replaceable).
 * @param rows - Its rows, replaced in place on success.
 * @param body - The parsed request body.
 * @returns The saved list, or the server's error answer.
 */
async function replaceAnswer(table: FakeTable, rows: StaffRow[], body: unknown): Promise<Response> {
  if (!Array.isArray(body) || !body.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item))) return json({ error: 'invalid_body' }, 400)
  const now = new Date().toISOString()
  const remaining = new Map(rows.map((row) => [row.id, row]))
  const next: StaffRow[] = []
  for (const [position, item] of (body as Record<string, unknown>[]).entries()) {
    const { id, ...values } = item
    const unknown = Object.keys(values).find((key) => !table.fields.includes(key))
    if (unknown) return json({ error: 'unknown_field', field: unknown }, 400)
    let row: StaffRow
    if (id === undefined || id === null) {
      row = { ...table.defaults, ...values, sortOrder: position, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as StaffRow
    } else {
      const saved = remaining.get(String(id))
      if (!saved) return json({ error: 'invalid', field: 'id' }, 400)
      remaining.delete(String(id))
      row = { ...saved, ...values, sortOrder: position, updatedAt: now }
    }
    const refused = await refusal(table, row, next)
    if (refused) return refused
    next.push(row)
  }
  rows.splice(0, rows.length, ...next)
  return json(next)
}

/**
 * Answers PUT /api/staff/<resource>/order like the server's reorder_rows: `ids` must be every row's id, each once;
 * each row's sortOrder becomes its position. A wrong list changes nothing.
 * @param rows - The table's rows, changed in place on success.
 * @param body - The parsed request body.
 * @returns The rows in their new order, or the server's error answer.
 */
function orderAnswer(rows: StaffRow[], body: unknown): Response {
  const ids = (body as { ids?: unknown } | null)?.ids
  if (!Array.isArray(ids)) return json({ error: 'invalid_body' }, 400)
  const known = new Set(rows.map((row) => row.id))
  if (ids.length !== rows.length || new Set(ids).size !== ids.length || !ids.every((id) => known.has(String(id)))) return json({ error: 'invalid', field: 'ids' }, 400)
  const now = new Date().toISOString()
  const ordered = ids.map((id, position) => ({ ...rows.find((row) => row.id === id)!, sortOrder: position, updatedAt: now }))
  rows.splice(0, rows.length, ...ordered)
  return json(ordered)
}

/** The folders the upload route takes (UPLOAD_FOLDERS on the server). */
const UPLOAD_FOLDERS = ['categories', 'brands']

/** The picture types the upload route takes, by media type -> extension (IMAGE_TYPES on the server). */
const UPLOAD_TYPES: Partial<Record<string, string>> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }

/**
 * Answers POST /api/staff/uploads like the server's upload route (the type is read from the File, not its bytes).
 * @param body - The multipart body: `folder` and `file`.
 * @returns 201 { key, url }, or the server's errors (401/403, invalid folder, required, too_large, unsupported_type).
 */
function uploadAnswer(body: BodyInit | null | undefined): Response {
  if (session?.kind !== 'staff') return json({ error: session ? 'forbidden' : 'unauthorized' }, session ? 403 : 401)
  const form = body instanceof FormData ? body : new FormData()
  const folder = form.get('folder')
  if (typeof folder !== 'string' || !UPLOAD_FOLDERS.includes(folder)) return json({ error: 'invalid', field: 'folder' }, 400)
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return json({ error: 'required', field: 'file' }, 400)
  if (file.size > 5 * 1024 * 1024) return json({ error: 'too_large', field: 'file' }, 400)
  const extension = UPLOAD_TYPES[file.type]
  if (!extension) return json({ error: 'unsupported_type', field: 'file' }, 400)
  uploadCount += 1
  const key = `${folder}/fake-${uploadCount}.${extension}`
  return json({ key, url: `/api/media/${key}` }, 201)
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
  if (id === 'order' && method === 'PUT') return table.orderable ? orderAnswer(rows, body ? JSON.parse(String(body)) : null) : json({ error: 'method_not_allowed' }, 405)
  const values = body && method !== 'PUT' ? (JSON.parse(String(body)) as Record<string, unknown>) : {}
  const unknown = Object.keys(values).find((key) => !table.fields.includes(key))
  if (unknown) return json({ error: 'unknown_field', field: unknown }, 400)
  const converted = table.convert?.(values, id === null && method === 'POST')
  if (converted) return converted
  for (const key of table.writeOnly ?? []) delete values[key]
  for (const key of table.numeric ?? []) if (typeof values[key] === 'string') values[key] = Number(values[key])
  for (const key of table.media ?? []) {
    if (!(key in values)) continue
    const url = mediaUrl(values[key])
    if (url === undefined) return json({ error: 'invalid', field: key }, 400)
    values[key] = url
  }
  const now = new Date().toISOString()
  if (id === null) {
    if (method === 'GET') return json([...rows].sort(table.order))
    if (method === 'PUT') return table.replaceable ? replaceAnswer(table, rows, body ? JSON.parse(String(body)) : null) : json({ error: 'method_not_allowed' }, 405)
    if (method !== 'POST') return json({ error: 'not_found' }, 404)
    // A keyed table's rows keep their key as the fake's internal id, so the lookups below work for both kinds.
    const filled = table.createDefaults ? table.createDefaults(values, rows) : values
    const row = { ...table.defaults, ...filled, id: table.key ? String(values[table.key]) : crypto.randomUUID(), createdAt: now, updatedAt: now } as StaffRow
    const refused = await refusal(table, row, rows)
    if (refused) return refused
    rows.push(row)
    return json(row, 201)
  }
  const index = rows.findIndex((row) => row.id === id)
  if (index < 0) return json({ error: 'not_found' }, 404)
  if (method === 'GET') return json(rows[index])
  if (method === 'DELETE') {
    if (table.deletable === false) return json({ error: 'method_not_allowed' }, 405)
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
    // The description is HTML: search its text, not its tags (as the server does).
    const description = Object.values(product.description).map((html) => (html ?? '').replace(/<[^>]+>/g, ' '))
    const text = [...Object.values(product.name), ...description].join(' ').toLowerCase()
    return words.every((word) => text.includes(word))
  })
  const categoryCounts = Object.fromEntries(categories.map((c) => [c.slug, matching.filter((p) => p.category === c.slug).length]))
  const requested = params.get('category')
  const applied = requested && requested in categoryCounts ? requested : null
  const shown = applied ? matching.filter((p) => p.category === applied) : matching
  const pageSize = Math.min(Math.max(Number(params.get('pageSize')) || PAGE_SIZE, 1), MAX_PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize))
  const page = Math.min(Math.max(Math.trunc(Number(params.get('page'))) || 1, 1), pageCount)
  const items = shown.slice((page - 1) * pageSize, page * pageSize).map(({ id, slug, name, category, images }) => ({ id, slug, name, category, image: images[0] ? mediaImage(images[0]) : null }))
  return { items, page, pageSize, pageCount, total: shown.length, category: applied, categoryCounts }
}

/**
 * One product for its page, like the server's product_detail_json: the gallery, the category, the brand when it is
 * shown, and the next products of the category in catalog order (wrapping round). Empty translations are left out.
 * @param slug - The product's URL name.
 * @returns The product, or null for an unknown slug.
 */
async function productDetail(slug: string): Promise<ProductDetail | null> {
  const { default: products } = (await import('@/stubs/products.json')) as { default: StubProduct[] }
  const index = products.findIndex((p) => p.slug === slug)
  if (index < 0) return null
  const product = products[index]
  const category = categories.find((c) => c.slug === product.category)!
  const brand = activeBrands.find((b) => b.slug === product.brand)
  const siblings = products.filter((p) => p.category === product.category)
  const at = siblings.indexOf(product)
  const related = [...siblings.slice(at + 1), ...siblings.slice(0, at)].slice(0, RELATED_COUNT)
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: Object.fromEntries(Object.entries(product.description).filter(([, html]) => html)),
    sku: product.sku,
    barcode: product.barcode,
    legacyPath: product.legacyPath,
    updatedAt: '2026-11-01T12:00:00+02:00',
    category: { slug: category.slug, name: category.name },
    brand: brand ? { slug: brand.slug, name: brand.name } : null,
    images: product.images.map((image) => ({ ...mediaImage(image), alt: image.alt })),
    related: related.map(({ id, slug, name, category, images }) => ({ id, slug, name, category, image: images[0] ? mediaImage(images[0]) : null })),
  }
}

/**
 * Shapes a stub brand the way the server returns it.
 * @param brand - The brand from stubs/brands.json.
 * @returns The API brand.
 */
function brandJson({ active: _active, ...brand }: (typeof brands)[number]): Brand {
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

  if (path === '/api/staff/uploads' && method === 'POST') return uploadAnswer(init.body)
  const staff = /^\/api\/staff\/([a-z-]+)(?:\/(.+))?$/.exec(path)
  if (staff) return staffAnswer(staff[1], method, staff[2] ? decodeURIComponent(staff[2]) : null, init.body)

  if (method === 'GET') {
    if (path === '/api/categories') {
      // The active rows of the staff table, so staff edits (e.g. a card photo) show up as on the server.
      const rows = [...(await tableRows('categories'))].filter((row) => row.isActive).sort(STAFF_TABLES.categories.order)
      return json(rows.map(({ slug, name, legacyPath, imageUrl }) => ({ slug, name, legacyPath, imageUrl })) as ProductCategory[])
    }
    if (path === '/api/products') return json(await productPage(url.searchParams))
    const productSlug = slug('/api/products/')
    if (productSlug) {
      const product = await productDetail(productSlug)
      if (product) return json(product)
    }
    if (path === '/api/brands') return json(activeBrands.map(brandJson))
    const brand = activeBrands.find((b) => b.slug === slug('/api/brands/'))
    if (brand) return json(brandJson(brand))
    if (path === '/api/stats' || path === '/api/contact') {
      const values = new Map((await tableRows('settings')).map((row) => [String(row.key), row.value]))
      if (path === '/api/contact') {
        const fields = ['phone', 'whatsapp', 'email'] as const
        return json(Object.fromEntries(fields.map((field) => [field, String(values.get(`contact_${field}`) ?? '')])) as ContactDetails)
      }
      return json(STATS.flatMap(({ id }) => (values.has(`stat_${id}_value`) ? [{ id, value: values.get(`stat_${id}_value`), suffix: values.get(`stat_${id}_suffix`) ?? '' }] : [])))
    }
    if (path === '/api/sections') return json(Object.fromEntries((await tableRows('page-sections')).map((row) => [row.key, row.content])))
    if (path === '/api/articles') return json(publishedArticles)
    const article = articles.find((a) => a.slug === slug('/api/articles/'))
    if (article) return json(article)
    if (path === '/api/faq') {
      const items = [...(await tableRows('faq-items'))].sort(STAFF_TABLES['faq-items'].order)
      return json(items.map(({ id, question, answer }) => ({ id, question, answer })))
    }
    const section = (await tableRows('page-sections')).find((row) => row.key === slug('/api/sections/'))
    if (section) return json({ key: section.key, content: section.content, updatedAt: section.updatedAt })
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
