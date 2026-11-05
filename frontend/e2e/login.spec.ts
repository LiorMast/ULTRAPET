/**
 * login.spec.ts — End-to-end checks of the header login popover in real Chromium (desktop only: below xl the
 * mobile drawer links to /login instead): it opens and stays inside the viewport, validates, refuses a wrong
 * password (checked by the real backend), turns Login into Log out (staff also get an Admin panel button), has no axe violations, and looks right (Hebrew, English).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'the popover is part of the desktop header')
  return page.goto('/')
})

test('opens, validates and stays inside the viewport', async ({ page }) => {
  await page.getByRole('button', { name: 'התחברות' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const box = (await dialog.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  await dialog.getByRole('button', { name: 'התחברות' }).click()
  await expect(dialog.getByText('שדה חובה')).toHaveCount(2)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('says so when the backend refuses the password', async ({ page }) => {
  await page.getByRole('button', { name: 'התחברות' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('דוא"ל').fill('nobody@example.com')
  await dialog.getByLabel('סיסמה').fill('not-the-password')
  await dialog.getByRole('button', { name: 'התחברות' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('הדוא"ל או הסיסמה שגויים.')
  // Still signed out: the header button did not turn into Log out.
  await expect(page.getByRole('banner').getByRole('button', { name: 'התחברות' })).toBeVisible()
})

test('staff sign in from the header: Admin panel and Log out appear, then it is Login again', async ({ page }) => {
  const email = process.env.SEED_ADMIN_EMAIL ?? ''
  const password = process.env.SEED_ADMIN_PASSWORD ?? ''
  test.skip(!email || !password, 'needs SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env')
  const header = page.getByRole('banner')
  await header.getByRole('button', { name: 'התחברות' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('דוא"ל').fill(email)
  await dialog.getByLabel('סיסמה').fill(password)
  await dialog.getByRole('button', { name: 'התחברות' }).click()
  await expect(header.getByRole('button', { name: 'התנתקות' })).toBeVisible()
  await expect(header.getByRole('button', { name: 'התחברות' })).toHaveCount(0)
  // Admin panel opens the admin drawer (admin-drawer.spec.ts); its Brands link opens the brands table.
  await header.getByRole('button', { name: 'לוח ניהול' }).click()
  await header.getByRole('navigation', { name: 'לוח ניהול' }).getByRole('link', { name: 'מותגים' }).click()
  await expect(page).toHaveURL(/\/admin\/brands$/)
  await expect(page.getByRole('table')).toBeVisible()
  await header.getByRole('button', { name: 'התנתקות' }).click()
  await expect(header.getByRole('button', { name: 'התחברות' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('customers sign in from the header and get Log out without an Admin panel button', async ({ page }) => {
  const email = process.env.SEED_CUSTOMER_EMAIL ?? ''
  const password = process.env.SEED_CUSTOMER_PASSWORD ?? ''
  test.skip(!email || !password, 'needs SEED_CUSTOMER_EMAIL / SEED_CUSTOMER_PASSWORD in .env')
  const header = page.getByRole('banner')
  await header.getByRole('button', { name: 'התחברות' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('דוא"ל').fill(email)
  await dialog.getByLabel('סיסמה').fill(password)
  await dialog.getByRole('button', { name: 'התחברות' }).click()
  await expect(header.getByRole('button', { name: 'התנתקות' })).toBeVisible()
  await expect(header.getByRole('button', { name: 'לוח ניהול' })).toHaveCount(0)
  await header.getByRole('button', { name: 'התנתקות' }).click()
})

test('has no accessibility violations', async ({ page }) => {
  await page.getByRole('button', { name: 'התחברות' }).click()
  await page.getByRole('dialog').waitFor()
  const results = await new AxeBuilder({ page }).include('[role=dialog]').analyze()
  expect(results.violations).toEqual([])
})

for (const [name, path, button] of [['he', '/', 'התחברות'], ['en', '/en', 'Login']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await page.goto(path)
    await page.getByRole('button', { name: button }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    await page.waitForTimeout(300)
    await expect(dialog).toHaveScreenshot(`login-${name}.png`)
  })
}
