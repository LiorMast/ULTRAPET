/**
 * where-to-buy.spec.ts — End-to-end checks of the Where to Buy page in real Chromium: the list and the
 * Leaflet map render, searching filters both, selecting a store opens its popup, no horizontal overflow
 * (phone and desktop), axe, and screenshots (Hebrew, English). On a phone (below lg) the list and the map take turns
 * through the List | Map switch, and picking a store shows it on the map. Map tiles are replaced by a blank tile so
 * the tests do not depend on the network and the screenshots stay stable.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { hideFixedOverlays } from './utils.ts'
import { overflowX } from './audit.ts'

/** A 1x1 transparent PNG used for every map tile. */
const BLANK_TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

/**
 * Whether the window is below lg, where the list and the map take turns (WhereToBuy.tsx).
 * @param page - The Playwright page.
 * @returns true on a phone or a small tablet.
 */
const narrow = (page: Page) => page.viewportSize()!.width < 1024

/**
 * Below lg, chooses the list or the map in the page's List | Map switch (nothing to do from lg, where both show).
 * @param page - The Playwright page.
 * @param view - "list" or "map".
 */
async function show(page: Page, view: 'list' | 'map') {
  if (!narrow(page)) return
  // The switch's radios are visually hidden: a finger taps their labels.
  await page.locator('label').filter({ hasText: view === 'map' ? /^(מפה|Map)$/ : /^(רשימה|List)$/ }).click()
  await expect(page.getByRole('radio', { name: view === 'map' ? /^(מפה|Map)$/ : /^(רשימה|List)$/ })).toBeChecked()
}

/**
 * Opens a page with the tile requests answered locally and waits for the map pins (below lg: the list, then the
 * map's pins once `map` asks for the map).
 * @param page - The Playwright page.
 * @param path - The URL to open.
 * @param options.map - Show the map below lg too (default true).
 */
async function open(page: Page, path: string, { map = true }: { map?: boolean } = {}) {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/png', body: BLANK_TILE }))
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.getByRole('list', { name: /רשימת חנויות|Store list/ }).waitFor()
  if (!map && narrow(page)) return
  await show(page, 'map')
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 20_000 })
}

test('shows the list and the map, and search filters both', async ({ page }) => {
  await open(page, '/where-to-buy')
  const markers = page.locator('.leaflet-marker-icon')
  const total = await markers.count()
  expect(total).toBeGreaterThan(100)
  await show(page, 'list')
  const items = page.getByRole('list', { name: 'רשימת חנויות' }).getByRole('listitem')
  await expect(items).toHaveCount(total)
  await page.getByRole('searchbox', { name: 'חיפוש חנות' }).fill('חיפה')
  const filtered = await items.count()
  expect(filtered).toBeGreaterThan(0)
  expect(filtered).toBeLessThan(total)
  await show(page, 'map')
  await expect(markers).toHaveCount(filtered)
})

test('selecting a store opens its popup on the map', async ({ page }) => {
  await open(page, '/where-to-buy', { map: false })
  const card = page.getByRole('list', { name: 'רשימת חנויות' }).getByRole('listitem').first()
  const name = await card.locator('button span.font-heading').innerText()
  await card.getByRole('button').click()
  await expect(page.locator('.leaflet-popup')).toContainText(name)
})

test('finds the nearest store from the visitor location', async ({ browser }) => {
  const context = await browser.newContext({ geolocation: { latitude: 32.0853, longitude: 34.7818 }, permissions: ['geolocation'] })
  const page = await context.newPage()
  await open(page, '/where-to-buy', { map: false })
  await page.getByRole('button', { name: 'חפש חנות קרובה' }).click()
  await expect(page.getByRole('list', { name: 'רשימת חנויות' }).getByText(/ק"מ ממך/).first()).toBeVisible()
  await show(page, 'map')
  await expect(page.locator('.leaflet-popup')).toBeVisible()
  await context.close()
})

test('does not overflow horizontally', async ({ page }) => {
  await open(page, '/where-to-buy', { map: false })
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await overflowX(page)).toBe(0)
  }
})

test('has no accessibility violations', async ({ page }) => {
  await open(page, '/where-to-buy', { map: false })
  const results = await new AxeBuilder({ page }).include('main').analyze()
  expect(results.violations).toEqual([])
})

for (const [name, path] of [['he', '/where-to-buy'], ['en', '/en/where-to-buy']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await open(page, path, { map: false })
    await hideFixedOverlays(page)
    await page.waitForTimeout(500)
    if (narrow(page)) {
      // Below lg the whole list flows in the page (125 stores): the top of the page says it all.
      await expect(page).toHaveScreenshot(`where-to-buy-${name}.png`, { fullPage: true, clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: 1600 } })
    } else {
      await expect(page.locator('main')).toHaveScreenshot(`where-to-buy-${name}.png`, { mask: [page.locator('.leaflet-container')] })
    }
  })
}
