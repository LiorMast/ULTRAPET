/**
 * manage.spec.ts — End-to-end checks of the staff's manage mode on the customer views (ProductManager.tsx) in real
 * Chromium against the real backend: signed in as the seed staff admin, the catalog shows the "Manage mode" switch
 * (off = the customer view); turned on, each card carries its staff strip (stock, Active switch, Edit / Stock /
 * Discounts / Delete) and the bar its catalog actions; the Edit dialog opens the admin form and gives the focus back
 * on Cancel; the product page's price block becomes the labelled staff panel; no axe violations (catalog, product
 * page, the edit form), no horizontal page overflow (phone and desktop), and a screenshot of a managed card.
 *
 * Nothing is saved: the dialogs are cancelled, so the shared dev database the other specs read never changes.
 * Manage mode lives in the browser's localStorage, so every test starts with it off.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import products from '../src/stubs/products.json' with { type: 'json' }
import { hideFixedOverlays, signInStaff } from './utils.ts'

/** The product the tests look at: the first of the catalog. */
const PRODUCT = products[0]

/**
 * Signs in as staff, opens the English catalog narrowed to the test product and turns manage mode on.
 * @param page - The Playwright page.
 * @returns The test product's card (<article>).
 */
async function manageCatalog(page: Page): Promise<Locator> {
  await signInStaff(page)
  await page.goto(`/en/catalog?q=${encodeURIComponent(PRODUCT.name.en)}`)
  const toggle = page.getByRole('switch', { name: 'Manage mode' })
  await expect(toggle).not.toBeChecked()
  await expect(page.getByRole('button', { name: `Edit ${PRODUCT.name.en}` })).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toBeChecked()
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: PRODUCT.name.en, exact: true }) })
  await expect(card.getByRole('button', { name: `Edit ${PRODUCT.name.en}` })).toBeVisible()
  return card
}

/**
 * Scans part of the page with axe for the WCAG 2.1 AA rules (IS 5568), as catalog.spec.ts and product.spec.ts do.
 * @param page - The Playwright page.
 * @param selector - The part to scan, e.g. "main".
 * @returns The violations.
 */
async function axe(page: Page, selector: string) {
  return (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include(selector).analyze()).violations
}

/**
 * Waits until a dialog has finished fading in (mid fade its text is translucent, which axe reads as low contrast).
 * @param dialog - The dialog.
 */
async function settled(dialog: Locator) {
  await dialog.waitFor()
  await dialog.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))))
}

test('expands the catalog cards for staff, with no accessibility violations', async ({ page }) => {
  test.slow() // signs in, then loads every product's staff row
  const card = await manageCatalog(page)
  for (const name of [`Stock: ${PRODUCT.name.en}`, `Discounts: ${PRODUCT.name.en}`, `Delete ${PRODUCT.name.en}`]) {
    await expect(card.getByRole('button', { name })).toBeVisible()
  }
  await expect(card.getByRole('switch', { name: `Active: ${PRODUCT.name.en}` })).toBeChecked()
  const bar = page.getByRole('region', { name: 'Product management' })
  for (const name of ['Change order', 'PDF catalog', 'Add product']) await expect(bar.getByRole('button', { name })).toBeVisible()
  expect(await axe(page, 'main')).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // The admin form, then the focus back on the card's Edit button.
  const edit = card.getByRole('button', { name: `Edit ${PRODUCT.name.en}` })
  await edit.click()
  const dialog = page.getByRole('dialog', { name: `Edit ${PRODUCT.name.en}` })
  await settled(dialog)
  await expect(dialog.getByRole('textbox', { name: 'SKU' })).toBeVisible()
  expect(await axe(page, '[role="dialog"]')).toEqual([])
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await expect(edit).toBeFocused()

  // Off again: the customer view.
  await page.getByRole('switch', { name: 'Manage mode' }).click()
  await expect(page.getByRole('button', { name: `Edit ${PRODUCT.name.en}` })).toHaveCount(0)
})

test('turns the product page price block into the staff panel', async ({ page }) => {
  test.slow()
  await manageCatalog(page)
  await page.goto(`/en/products/${PRODUCT.slug}`)
  await expect(page.getByRole('heading', { level: 1, name: PRODUCT.name.en })).toBeVisible()
  await expect(page.getByText('Only staff see this part.')).toBeVisible()
  await expect(page.getByRole('button', { name: `Edit ${PRODUCT.name.en}` })).toHaveText('Edit')
  await expect(page.getByRole('link', { name: 'Log in to see the price' })).toHaveCount(0)
  expect(await axe(page, 'main')).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('screenshot of a managed card', async ({ page }) => {
  test.slow()
  const card = await manageCatalog(page)
  await hideFixedOverlays(page)
  await page.mouse.move(0, 0) // off the card (a hovered card's title turns red)
  await card.locator('img').first().evaluate((image: HTMLImageElement) => image.decode().catch(() => undefined))
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await expect(card).toHaveScreenshot('managed-card.png', { animations: 'disabled' })
})
