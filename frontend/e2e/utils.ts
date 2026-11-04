/**
 * utils.ts — Helpers shared by the Playwright specs.
 */
import type { Locator, Page } from '@playwright/test'

/**
 * Scrolls a page section into view once it shows its final layout. Pages render when their API data arrives,
 * and the web fonts only start loading then; scrolling before the fonts swap in would stop at a position the
 * swap then moves (the text is taller in the fallback font), so screenshots would shift from run to run.
 * @param section - The section, e.g. page.locator('#brands').
 */
export async function scrollIntoViewSettled(section: Locator) {
  await section.waitFor()
  await section.page().evaluate(() => document.fonts.ready.then(() => undefined))
  await section.scrollIntoViewIfNeeded()
}

/**
 * Hides the fixed overlays (the header and the floating WhatsApp button) before a section screenshot. They float
 * over the page wherever the scroll stops, and a section taller than the window is captured in several scroll
 * steps, so they would land at a different place in every capture. The header has its own screenshots.
 * @param page - The Playwright page.
 */
export async function hideFixedOverlays(page: Page) {
  await page.addStyleTag({ content: 'header, a[href^="https://wa.me/"].fixed { visibility: hidden !important; }' })
}

/** The staff admin that `flask seed` creates from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in the repo's .env. */
const STAFF = { email: process.env.SEED_ADMIN_EMAIL ?? '', password: process.env.SEED_ADMIN_PASSWORD ?? '' }

/**
 * Opens an admin page and signs in as the seed staff admin, then waits for the page's table.
 * @param page - The Playwright page.
 * @param path - The admin page, e.g. "/en/admin/brands".
 */
export async function signInStaff(page: Page, path = '/en/admin/brands') {
  if (!STAFF.email || !STAFF.password) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env, then run `flask reset-db --yes` and `flask seed`.')
  }
  await page.goto(path)
  const english = path.startsWith('/en')
  await page.getByLabel(english ? 'Email' : 'דוא"ל').fill(STAFF.email)
  await page.getByLabel(english ? 'Password' : 'סיסמה').fill(STAFF.password)
  await page.getByRole('main').getByRole('button', { name: english ? 'Log in' : 'התחברות' }).click()
  await page.getByRole('table').waitFor()
}
