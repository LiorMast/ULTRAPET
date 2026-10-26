/**
 * where-to-buy.spec.ts — End-to-end checks of the Where to Buy page in real Chromium: the list and the
 * Leaflet map render, searching filters both, selecting a store opens its popup, no horizontal overflow
 * (phone and desktop), axe, and screenshots (Hebrew, English). Map tiles are replaced by a blank tile so
 * the tests do not depend on the network and the screenshots stay stable.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** A 1x1 transparent PNG used for every map tile. */
const BLANK_TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

/**
 * Opens a page with the tile requests answered locally and waits for the map pins.
 * @param page - The Playwright page.
 * @param path - The URL to open.
 */
async function open(page: Page, path: string) {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/png', body: BLANK_TILE }))
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 20_000 })
}

test('shows the list and the map, and search filters both', async ({ page }) => {
  await open(page, '/where-to-buy')
  const items = page.getByRole('list', { name: 'רשימת חנויות' }).getByRole('listitem')
  const total = await items.count()
  expect(total).toBeGreaterThan(100)
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(total)
  await page.getByRole('searchbox', { name: 'חיפוש חנות' }).fill('חיפה')
  const filtered = await items.count()
  expect(filtered).toBeGreaterThan(0)
  expect(filtered).toBeLessThan(total)
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(filtered)
})

test('selecting a store opens its popup on the map', async ({ page }) => {
  await open(page, '/where-to-buy')
  const card = page.getByRole('list', { name: 'רשימת חנויות' }).getByRole('listitem').first()
  const name = await card.locator('button span.font-heading').innerText()
  await card.getByRole('button').click()
  await expect(page.locator('.leaflet-popup')).toContainText(name)
})

test('finds the nearest store from the visitor location', async ({ browser }) => {
  const context = await browser.newContext({ geolocation: { latitude: 32.0853, longitude: 34.7818 }, permissions: ['geolocation'] })
  const page = await context.newPage()
  await open(page, '/where-to-buy')
  await page.getByRole('button', { name: 'חפש חנות קרובה' }).click()
  await expect(page.getByRole('list', { name: 'רשימת חנויות' }).getByText(/ק"מ ממך/).first()).toBeVisible()
  await expect(page.locator('.leaflet-popup')).toBeVisible()
  await context.close()
})

test('does not overflow horizontally', async ({ page }) => {
  await open(page, '/where-to-buy')
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('has no accessibility violations', async ({ page }) => {
  await open(page, '/where-to-buy')
  const results = await new AxeBuilder({ page }).include('main').analyze()
  expect(results.violations).toEqual([])
})

for (const [name, path] of [['he', '/where-to-buy'], ['en', '/en/where-to-buy']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await open(page, path)
    await page.waitForTimeout(500)
    await expect(page.locator('main')).toHaveScreenshot(`where-to-buy-${name}.png`, { mask: [page.locator('.leaflet-container')] })
  })
}
