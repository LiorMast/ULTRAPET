/**
 * admin-catalog.spec.ts — End-to-end checks of the staff panel's catalog pages (/admin/products,
 * /admin/categories, DataTable) and their discounts (DiscountsDialog, DiscountDialog) in real Chromium against the
 * real backend: the tables show the seeded catalog, a product discount added with the keyboard is saved to the
 * database (shown in the table, still there after a reload) and then deleted, no axe violations (tables, the
 * discounts dialog, the discount form), no horizontal page overflow on a phone, and screenshots of the categories
 * page (Hebrew, English).
 *
 * The discount is put on the last seeded product (found with the table's search), so it never shows in the
 * screenshots, which other workers may take at the same time; leftovers of an interrupted run are deleted first.
 * Signs in as the seed staff admin (signInStaff).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import products from '../src/stubs/products.json' with { type: 'json' }
import { hideFixedOverlays, signInStaff } from './utils.ts'

/** The product the discount test changes: the last one, on the table's last page. */
const PRODUCT = products[products.length - 1].name.en

/**
 * Waits until a dialog has finished fading in: mid fade-in its text is translucent over the backdrop, which axe
 * reads as low contrast.
 * @param dialog - The dialog.
 */
async function settled(dialog: Locator) {
  await dialog.waitFor()
  // A cancelled animation rejects `finished` (AbortError) but also leaves the element in its final state.
  await dialog.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))))
}

/**
 * Narrows the products table to the test product with the table's search.
 * @param page - The Playwright page, on /en/admin/products.
 */
async function findProduct(page: Page) {
  await page.getByRole('searchbox').fill(PRODUCT)
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2)
}

test('lists the products and categories with no accessibility violations', async ({ page }) => {
  test.slow() // two pages and two axe scans; the 400-product table loads slowly when every worker is busy
  await signInStaff(page, '/en/admin/products')
  await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Products' }).getByRole('row')).toHaveCount(26)
  await expect(page.getByText(new RegExp(`^Showing 1–25 of ${products.length.toLocaleString('en')}$`))).toBeVisible()
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])

  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Categories' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible()
  expect(await page.getByRole('table', { name: 'Categories' }).getByRole('row').count()).toBeGreaterThan(1)
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
})

/**
 * Deletes every 12.5% discount of the test product (what the discount test adds), so a run that stopped half-way
 * leaves nothing behind for the next one. Ends on /en/admin/products with the product found and no dialog open.
 * @param page - The Playwright page, signed in.
 */
async function deleteTestDiscounts(page: Page) {
  await page.goto('/en/admin/products')
  await page.getByRole('table').waitFor()
  await findProduct(page)
  await page.getByRole('button', { name: `Discounts: ${PRODUCT}` }).click()
  const dialog = page.getByRole('dialog', { name: 'Discounts' })
  await settled(dialog)
  for (const remove of await dialog.getByRole('button', { name: /^Delete: ⁦12\.5%⁩ off/ }).all()) {
    await remove.click()
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(dialog.getByRole('status')).toHaveText('Discount deleted.')
  }
  await expect(dialog.getByText(/^⁦12\.5%⁩ off/)).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
}

test('adds a product discount with the keyboard, then deletes it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'one project edits the shared database, so runs never collide')
  test.slow() // loads the 400-product table four times and runs two axe scans
  await signInStaff(page, '/en/admin/products')
  await deleteTestDiscounts(page)
  const open = page.getByRole('button', { name: `Discounts: ${PRODUCT}` })
  const dialog = page.getByRole('dialog', { name: 'Discounts' })
  const added = /^⁦12\.5%⁩ off, from .+, with no end date$/

  try {
    await open.focus()
    await page.keyboard.press('Enter')
    await settled(dialog)
    expect((await new AxeBuilder({ page }).include('[role=dialog]').analyze()).violations).toEqual([])

    await dialog.getByRole('button', { name: 'Add discount' }).focus()
    await page.keyboard.press('Enter')
    const form = page.getByRole('dialog', { name: 'New discount' })
    await settled(form)
    expect((await new AxeBuilder({ page }).include('[role=dialog]').analyze()).violations).toEqual([])
    await form.getByLabel('Value *').fill('12.5')
    await form.getByLabel('Value *').press('Enter')
    await expect(form).toBeHidden()
    await expect(dialog.getByText(added)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Add discount' })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(open).toBeFocused()
    await expect(page.getByRole('table').getByText(added)).toBeVisible()
    // Saved on the server: still there after a reload.
    await page.reload()
    await page.getByRole('table').waitFor()
    await findProduct(page)
    await expect(page.getByRole('table').getByText(added)).toBeVisible()
  } finally {
    // Whatever state the steps above stopped in.
    await deleteTestDiscounts(page)
  }
})

test('the catalog pages do not scroll sideways on a phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone layout')
  await signInStaff(page, '/en/admin/products')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Categories' }).click()
  await page.getByRole('table', { name: 'Categories' }).waitFor()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

for (const [name, path] of [['he', '/admin/categories'], ['en', '/en/admin/categories']] as const) {
  test(`categories screenshot (${name})`, async ({ page }) => {
    await signInStaff(page, path)
    await hideFixedOverlays(page)
    // The pointer stays where "Log in" was clicked, over the table now: move it off so no row or header hovers.
    await page.mouse.move(0, 0)
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await expect(page.locator('main')).toHaveScreenshot(`admin-categories-${name}.png`)
  })
}
