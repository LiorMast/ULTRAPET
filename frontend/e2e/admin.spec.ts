/**
 * admin.spec.ts — End-to-end checks of the staff panel's brands table (/admin/brands, DataTable) in real
 * Chromium against the real backend: the staff sign-in (a wrong password is refused by the server), the
 * table, a keyboard-only edit that is saved to the database and then reverted, no axe violations (sign-in
 * form, table, open dialog), no horizontal page overflow on a phone, and screenshots (Hebrew, English).
 *
 * The signed-in tests use the staff admin that `flask seed` creates from SEED_ADMIN_EMAIL /
 * SEED_ADMIN_PASSWORD in the repo's .env (loaded by playwright.config.ts).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { hideFixedOverlays } from './utils.ts'

const STAFF = { email: process.env.SEED_ADMIN_EMAIL ?? '', password: process.env.SEED_ADMIN_PASSWORD ?? '' }

/**
 * Opens an admin page and signs in as the seed staff admin.
 * @param page - The Playwright page.
 * @param path - The admin page, e.g. "/en/admin/brands".
 */
async function signIn(page: Page, path = '/en/admin/brands') {
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

test('signed out, shows the staff sign-in and refuses a wrong password', async ({ page }) => {
  await page.goto('/en/admin')
  await expect(page).toHaveURL(/\/en\/admin\/brands$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Staff sign-in' })).toBeVisible()
  await page.getByLabel('Email').fill('nobody@example.com')
  await page.getByLabel('Password').fill('not-the-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password.')
  await expect(page.getByRole('table')).toHaveCount(0)
  expect(await page.locator('meta[name=robots]').getAttribute('content')).toBe('noindex, nofollow')
  const results = await new AxeBuilder({ page }).include('main').analyze()
  expect(results.violations).toEqual([])
})

test('lists the brands and has no accessibility violations', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Brands' })).toBeVisible()
  expect(await page.getByRole('table', { name: 'Brands' }).getByRole('row').count()).toBeGreaterThan(1)
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
  await page.getByRole('button', { name: /^Edit / }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  // Check the settled dialog: mid fade-in its text is translucent over the backdrop, which axe reads as low contrast.
  await dialog.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
  expect((await new AxeBuilder({ page }).include('[role=dialog]').analyze()).violations).toEqual([])
})

test('edits a brand with the keyboard, then reverts it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'one project edits the shared database, so runs never collide')
  await signIn(page)
  const edit = page.getByRole('button', { name: /^Edit / }).first()
  const name = (await edit.getAttribute('aria-label'))!.replace(/^Edit /, '')
  const tagline = page.getByRole('dialog').getByRole('group', { name: 'Tagline' }).getByLabel('English')

  /**
   * Opens the row's form with the keyboard, types a new English tagline and saves with Enter.
   * @param text - The tagline to save.
   */
  const saveTagline = async (text: string) => {
    await edit.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: `Edit ${name}` })).toBeVisible()
    await tagline.fill(text)
    await tagline.press('Enter')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByText('Changes saved.')).toBeVisible()
  }

  await edit.focus()
  await page.keyboard.press('Enter')
  const original = await tagline.inputValue()
  await page.keyboard.press('Escape')
  try {
    await saveTagline('E2E tagline check')
    await expect(page.getByRole('table').getByText('E2E tagline check')).toBeVisible()
    await expect(page.getByRole('button', { name: `Edit ${name}` })).toBeFocused()
    // Saved on the server: still there after a reload.
    await page.reload()
    await expect(page.getByRole('table').getByText('E2E tagline check')).toBeVisible()
  } finally {
    await saveTagline(original)
  }
})

test('the page does not scroll sideways on a phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone layout')
  await signIn(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

for (const [name, path] of [['he', '/admin/brands'], ['en', '/en/admin/brands']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await signIn(page, path)
    await hideFixedOverlays(page)
    // The pointer stays where "Log in" was clicked, over the table now: move it off so no row or header hovers.
    await page.mouse.move(0, 0)
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await expect(page.locator('main')).toHaveScreenshot(`admin-brands-${name}.png`)
  })
}
