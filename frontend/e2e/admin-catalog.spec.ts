/**
 * admin-catalog.spec.ts — End-to-end checks of the staff panel's catalog pages (/admin/products,
 * /admin/categories, DataTable) and their discounts (DiscountsDialog, DiscountDialog) in real Chromium against the
 * real backend: the tables show the seeded catalog, a product discount added with the keyboard is saved to the
 * database (shown in the table, still there after a reload) and then deleted, the product form's type-to-search
 * category field (SearchableField: keyboard picking, Escape closing only its list, a screenshot of the open list),
 * no axe violations (tables, the discounts dialog, the discount form, the open suggestion list), no horizontal
 * page overflow on a phone, and screenshots of the categories page (Hebrew, English). Plus a category picture
 * uploaded in the edit form (ImageUploadField) that then shows on the home page carousel. The Discounts page
 * (/admin/discounts): a discount added there with its "applies to" fields is saved, listed, and deleted, with axe
 * scans of the page and its form.
 *
 * The upload goes to the real backend (its S3 stub stores the file under backend/media, which nothing else reads),
 * but the category save (PATCH /api/staff/categories/<id>) is answered in the browser and laid over the reads that
 * follow (GET /api/staff/categories, /api/categories), so the shared dev database the screenshots read never
 * changes (as in home-editor.spec.ts).
 *
 * The discount is put on the last seeded product (found with the table's search), so it never shows in the
 * screenshots, which other workers may take at the same time; leftovers of an interrupted run are deleted first.
 * Signs in as the seed staff admin (signInStaff).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import categories from '../src/stubs/product-categories.json' with { type: 'json' }
import products from '../src/stubs/products.json' with { type: 'json' }
import { hideFixedOverlays, scrollIntoViewSettled, signInStaff } from './utils.ts'

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

  await page.getByRole('navigation', { name: 'Admin', exact: true }).getByRole('link', { name: 'Categories' }).click()
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
    // The confirmation is a toast outside the dialog, still in the accessibility tree while the modal is open.
    await expect(page.getByRole('status').filter({ hasText: 'Discount deleted.' })).toBeVisible()
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

test("picks a product's category by typing, with the keyboard", async ({ page }, testInfo) => {
  test.slow() // the 400-product table loads slowly when every worker is busy
  const product = products[0].name.en
  await signInStaff(page, '/en/admin/products')
  await page.getByRole('searchbox').fill(product)
  await page.getByRole('button', { name: `Edit ${product}` }).click()
  const dialog = page.getByRole('dialog', { name: `Edit ${product}` })
  await settled(dialog)
  const category = dialog.getByRole('combobox', { name: 'Category *' })
  const saved = await category.inputValue()
  await category.selectText()
  await page.keyboard.type('cat')
  const list = page.getByRole('listbox', { name: 'Category' })
  await expect(list.getByRole('option')).toHaveText(['Cat Cans & Treats', 'Cat Snacks', 'Cat Litter', 'Cat Scratchers', 'Dry Cat Food'])
  await expect(list.getByRole('option', { name: 'Dry Cat Food' })).toBeInViewport()
  await settled(list)
  expect((await new AxeBuilder({ page }).include('[role=dialog]').analyze()).violations).toEqual([])
  if (testInfo.project.name !== 'mobile') await expect(dialog).toHaveScreenshot('searchable-field-open.png')

  // Escape closes the list (not the dialog) and puts back the saved category.
  await page.keyboard.press('Escape')
  await expect(list).toBeHidden()
  await expect(dialog).toBeVisible()
  await expect(category).toHaveValue(saved)

  await category.selectText()
  await page.keyboard.type('litter')
  await page.keyboard.press('Enter')
  await expect(category).toHaveValue('Cat Litter')
  await expect(dialog).toBeVisible()
  await expect(category).toBeFocused()
  // Nothing is saved: the shared database stays as seeded.
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})

/** How the Discounts page names the rows of the test discount (17.5% off the test product, every customer). */
const PAGE_DISCOUNT = new RegExp(`^Delete Product: ${PRODUCT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, All customers: ⁦17\\.5%⁩ off$`)

/**
 * Deletes every test discount of the Discounts page (left over by an interrupted run, or made by the test).
 * @param page - The Playwright page, signed in as staff.
 */
async function deletePageDiscounts(page: Page) {
  await page.goto('/en/admin/discounts')
  await page.getByRole('table', { name: 'Discounts' }).waitFor()
  for (const remove of await page.getByRole('button', { name: PAGE_DISCOUNT }).all()) {
    await remove.click()
    const confirm = page.getByRole('alertdialog')
    await settled(confirm)
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(confirm).toBeHidden()
  }
  await expect(page.getByRole('button', { name: PAGE_DISCOUNT })).toHaveCount(0)
}

test('adds a discount on the Discounts page, then deletes it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'one project edits the shared database, so runs never collide')
  test.slow() // loads the 400 products for the "applies to" list and runs two axe scans
  await signInStaff(page, '/en/admin/discounts')
  await deletePageDiscounts(page)
  try {
    await expect(page.getByRole('heading', { level: 1, name: 'Discounts' })).toBeVisible()
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])

    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'New discount' })
    await settled(form)
    await form.getByText('Product', { exact: true }).click()
    const target = form.getByRole('combobox', { name: 'Product *' })
    await target.fill(PRODUCT)
    await target.press('ArrowDown')
    await expect(page.getByRole('listbox', { name: 'Product' })).toBeVisible()
    expect((await new AxeBuilder({ page }).include('[role=dialog]').analyze()).violations).toEqual([])
    await target.press('Enter')
    await expect(target).toHaveValue(`Product: ${PRODUCT}`)
    await form.getByLabel('Value *').fill('17.5')
    await form.getByLabel('Value *').press('Enter')
    await expect(form).toBeHidden()
    await expect(page.getByRole('button', { name: PAGE_DISCOUNT })).toBeVisible()
    // Saved on the server: still there after a reload.
    await page.reload()
    await expect(page.getByRole('button', { name: PAGE_DISCOUNT })).toBeVisible()
  } finally {
    await deletePageDiscounts(page)
  }
})

test('the catalog pages do not scroll sideways on a phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone layout')
  await signInStaff(page, '/en/admin/products')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('navigation', { name: 'Admin', exact: true }).getByRole('link', { name: 'Categories' }).click()
  await page.getByRole('table', { name: 'Categories' }).waitFor()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('navigation', { name: 'Admin', exact: true }).getByRole('link', { name: 'Discounts' }).click()
  await page.getByRole('table', { name: 'Discounts' }).waitFor()
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

/** The category the upload test gives a picture: the first seeded one, on the home carousel's first page. */
const CATEGORY = categories[0].name.en

/** A real 1×1 PNG (decodable, so the browser shows it), uploaded as the category picture. */
const PICTURE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

/**
 * Answers the category saves in the browser and lays them over the real category reads (see the file header).
 * @param page - The Playwright page.
 */
async function keepCategorySavesInBrowser(page: Page) {
  const saved = new Map<string, Record<string, unknown>>()
  const slugs = new Map<string, string>()
  await page.route('**/api/staff/categories', async (route) => {
    const response = await route.fetch()
    const rows = (await response.json()) as { id: string; slug: string }[]
    for (const row of rows) slugs.set(row.id, row.slug)
    await route.fulfill({ response, json: rows.map((row) => ({ ...row, ...saved.get(row.id) })) })
  })
  await page.route('**/api/staff/categories/*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    const id = new URL(route.request().url()).pathname.split('/').pop()!
    saved.set(id, { ...saved.get(id), ...(route.request().postDataJSON() as Record<string, unknown>) })
    await route.fulfill({ json: { id, ...saved.get(id) } })
  })
  await page.route('**/api/categories', async (route) => {
    const response = await route.fetch()
    const bySlug = new Map([...saved].map(([id, changes]) => [slugs.get(id), changes]))
    const rows = (await response.json()) as { slug: string }[]
    await route.fulfill({ response, json: rows.map((row) => ({ ...row, ...bySlug.get(row.slug) })) })
  })
}

/**
 * Whether an image has loaded and decoded (a broken or still-loading image has no natural width).
 * @param image - The <img>.
 * @returns Its natural width in pixels; 0 until it has loaded.
 */
const loadedWidth = (image: Locator) => image.evaluate((element: HTMLImageElement) => (element.complete ? element.naturalWidth : 0))

test('uploads a category picture that shows on the home page carousel', async ({ page }) => {
  test.slow() // the admin table, an upload, an axe scan and the home page
  await keepCategorySavesInBrowser(page)
  await signInStaff(page, '/en/admin/categories')
  await page.getByRole('button', { name: `Edit ${CATEGORY}` }).click()
  const dialog = page.getByRole('dialog', { name: `Edit ${CATEGORY}` })
  await settled(dialog)
  const picture = dialog.getByRole('group', { name: 'Picture' })

  await picture.locator('input[type="file"]').setInputFiles({ name: 'category.png', mimeType: 'image/png', buffer: PICTURE })
  await expect(picture.getByRole('status')).toHaveText('Picture uploaded. Save to keep it.')
  const preview = picture.getByRole('img', { name: 'Current picture' })
  await expect(preview).toHaveAttribute('src', /^\/api\/media\/categories\/\d{8}T\d{6}Z_[0-9a-f]{32}\.png$/)
  await expect.poll(() => loadedWidth(preview)).toBe(1)
  const url = await preview.getAttribute('src')
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([])

  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('row', { name: new RegExp(CATEGORY) }).locator('img')).toHaveAttribute('src', url!)

  await page.goto('/en')
  const section = page.locator('#categories')
  await scrollIntoViewSettled(section)
  const card = section.getByRole('link', { name: CATEGORY }).locator('img')
  await card.scrollIntoViewIfNeeded()
  await expect(card).toHaveAttribute('src', url!)
  await expect.poll(() => loadedWidth(card)).toBe(1)
})
