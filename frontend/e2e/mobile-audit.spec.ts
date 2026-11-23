/**
 * mobile-audit.spec.ts — The phone audit (Playwright project "audit"; run with `npx playwright test --project=audit`):
 * every page and state of the site on touch devices from a 320px phone to a 768px tablet, plus a landscape phone, in
 * Hebrew and English. Each page is scrolled one window at a time and checked by audit.ts: no sideways overflow, touch
 * targets of at least 44×44 px, nothing covering a control, no overlapping text, chrome (header, tab bar, WhatsApp
 * button, bottom bar) that never hides the start or the end of a page, form fields of 16px, and axe with the
 * WCAG 2.2 AA rules. All of a page's problems are listed in one failure.
 *
 * A full-page screenshot of each state is saved in test-results/ for review (it is not a baseline). Signed-in states
 * sign in through the API (the seed's staff admin and demo customer from .env); nothing is saved to the database.
 */
import { devices, expect, test, type Page } from '@playwright/test'
import products from '../src/stubs/products.json' with { type: 'json' }
import { auditPage, settleAnimations, settlePage } from './audit.ts'

/** A Playwright device without its browser type (the audit runs in Chromium; a describe block cannot switch browsers). */
function touchDevice(name: string) {
  const { defaultBrowserType: _browser, ...device } = devices[name]
  return device
}

/**
 * The audited devices: the WCAG reflow width (320), common Android and iPhone widths, a tablet and a landscape phone.
 * `locales` = the languages audited on it; `signedIn` = whether the customer and staff states run on it too.
 */
const DEVICES = [
  { id: '320', device: 'iPhone SE', locales: ['he'], signedIn: false },
  { id: '360', device: 'Moto G4', locales: ['he', 'en'], signedIn: true },
  { id: '390', device: 'iPhone 13', locales: ['he', 'en'], signedIn: true },
  { id: '412', device: 'Pixel 7', locales: ['he'], signedIn: true },
  { id: '768', device: 'iPad Mini', locales: ['he', 'en'], signedIn: true },
  { id: 'landscape', device: 'Pixel 7 landscape', locales: ['he'], signedIn: false },
] as const

type Locale = 'he' | 'en'

/** The UI words the states click, per language (from the dictionaries he.ts / en.ts). */
const WORDS = {
  he: {
    menu: /^(פתיחת תפריט|תפריט)$/,
    toolbar: 'מיון וסינון',
    addToCart: 'הוספה לסל',
    cart: /^סל קניות/,
    editOnPage: /^עריכה בעמוד/,
    manage: 'מצב ניהול',
  },
  en: {
    menu: /^(Open menu|Menu)$/,
    toolbar: 'Sort and filter',
    addToCart: 'Add to cart',
    cart: /^Shopping cart/,
    editOnPage: /^Edit on page/,
    manage: 'Manage mode',
  },
} as const

type Words = (typeof WORDS)[Locale]

/** An audited page or state: its path (without the language prefix), who is signed in, and what to do once loaded. */
type State = { name: string; path: string; as?: 'customer' | 'staff'; prepare?: (page: Page, words: Words) => Promise<void> }

/** A product with a gallery of several photos. */
const PRODUCT = products.find((p) => p.images.length >= 3) ?? products[0]

/**
 * Opens the main menu drawer and waits for it to settle.
 * @param page - The Playwright page.
 * @param words - The page language's words.
 */
async function openMenu(page: Page, words: Words) {
  await page.getByRole('button', { name: words.menu }).first().click()
  await page.locator('[data-slot="sheet-content"]').waitFor()
  await settleAnimations(page)
}

/**
 * Clicks the first button of a data table's row with the given data-action, and waits for its dialog.
 * @param page - The Playwright page.
 * @param action - The row action, e.g. "edit", "stock", "discounts".
 */
async function openRowAction(page: Page, action: string) {
  await page.locator(`button[data-action="${action}"]`).first().click()
  await page.locator('[data-slot="dialog-content"]').last().waitFor()
  await page.waitForLoadState('networkidle')
  await settleAnimations(page)
}

/** The states every audited device and language goes through (signed out). */
const PUBLIC: State[] = [
  { name: 'home', path: '/' },
  { name: 'catalog', path: '/catalog' },
  {
    name: 'catalog-filters',
    path: '/catalog',
    prepare: async (page, words) => {
      await page.getByRole('group', { name: words.toolbar }).getByRole('button').first().click()
      await settleAnimations(page)
    },
  },
  { name: 'product', path: `/products/${encodeURIComponent(PRODUCT.slug)}` },
  { name: 'brand', path: '/brands/jr-farm' },
  { name: 'where-to-buy', path: '/where-to-buy' },
  { name: 'articles', path: '/articles' },
  { name: 'article', path: '/articles/living-with-a-cat' },
  { name: 'private-label', path: '/private-label' },
  { name: 'login', path: '/login' },
  { name: 'not-found', path: '/no-such-page' },
  { name: 'menu', path: '/', prepare: openMenu },
]

/** The signed-in states (a business customer, a staff member); nothing is saved. */
const SIGNED_IN: State[] = [
  { name: 'customer-catalog', path: '/catalog', as: 'customer' },
  { name: 'customer-product', path: `/products/${encodeURIComponent(PRODUCT.slug)}`, as: 'customer' },
  {
    name: 'customer-cart',
    path: '/catalog',
    as: 'customer',
    prepare: async (page, words) => {
      const adds = page.getByRole('button', { name: words.addToCart, exact: true })
      await adds.nth(0).click()
      await adds.nth(1).click()
      // The buttons' "Added" morph is over (its labels fade back), so nothing is measured mid-fade.
      await expect(page.locator('[data-added]')).toHaveCount(0)
      await settleAnimations(page)
      await page.getByRole('button', { name: words.cart }).first().click()
      await page.locator('[data-slot="sheet-content"]').waitFor()
      await settleAnimations(page)
    },
  },
  { name: 'customer-account', path: '/account', as: 'customer' },
  ...['products', 'categories', 'discounts', 'customers', 'requests', 'brands', 'suppliers', 'resellers'].map(
    (table): State => ({ name: `admin-${table}`, path: `/admin/${table}`, as: 'staff', prepare: (page) => page.getByRole('table').waitFor() }),
  ),
  ...['edit', 'stock', 'discounts'].map(
    (action): State => ({
      name: `admin-products-${action}-dialog`,
      path: '/admin/products',
      as: 'staff',
      prepare: async (page) => {
        await page.getByRole('table').waitFor()
        await openRowAction(page, action)
      },
    }),
  ),
  {
    name: 'staff-home-editing',
    path: '/',
    as: 'staff',
    prepare: async (page, words) => {
      const edit = page.locator('#about').getByRole('button', { name: words.editOnPage })
      await edit.scrollIntoViewIfNeeded()
      await edit.click()
      await settleAnimations(page)
    },
  },
  {
    name: 'staff-catalog-manage',
    path: '/catalog',
    as: 'staff',
    prepare: async (page, words) => {
      await page.getByRole('switch', { name: words.manage }).click()
      await page.waitForLoadState('networkidle')
      await settleAnimations(page)
    },
  },
]

/** The seed's accounts (from the repo's .env, loaded by playwright.config.ts). */
const ACCOUNTS = {
  customer: { email: process.env.SEED_CUSTOMER_EMAIL ?? '', password: process.env.SEED_CUSTOMER_PASSWORD ?? '' },
  staff: { email: process.env.SEED_ADMIN_EMAIL ?? '', password: process.env.SEED_ADMIN_PASSWORD ?? '' },
}

/**
 * Signs in through the API: the browser context shares the request's cookies, so the next page load is signed in.
 * @param page - The Playwright page.
 * @param who - Which seed account.
 */
async function signIn(page: Page, who: 'customer' | 'staff') {
  const { email, password } = ACCOUNTS[who]
  if (!email || !password) throw new Error('Set the SEED_* accounts in .env, then run `flask reset-db --yes` and `flask seed`.')
  const response = await page.request.post('/api/auth/login', { data: { email, password, remember: false } })
  expect(response.ok(), `sign in as ${who}`).toBe(true)
}

for (const { id, device, locales, signedIn } of DEVICES) {
  for (const locale of locales) {
    test.describe(`${id} ${locale}`, () => {
      test.use({ ...touchDevice(device), reducedMotion: 'reduce' })

      for (const state of signedIn ? [...PUBLIC, ...SIGNED_IN] : PUBLIC) {
        test(state.name, async ({ page }, testInfo) => {
          test.slow()
          const words = WORDS[locale]
          if (state.as) await signIn(page, state.as)
          await page.goto(`${locale === 'en' ? '/en' : ''}${state.path}`.replace(/^\/en\/$/, '/en') || '/')
          await settlePage(page)
          await state.prepare?.(page, words)
          const problems = await auditPage(page)
          // The whole page, or just the window while a dialog or sheet is open (it floats over the window).
          const modal = await page.locator('[data-slot="dialog-content"], [data-slot="sheet-content"]').count()
          await page.screenshot({ path: testInfo.outputPath(`${id}-${locale}-${state.name}.png`), fullPage: !modal, scale: 'css' })
          expect(problems, `${state.name} on ${device} (${locale})`).toEqual([])
        })
      }
    })
  }
}
