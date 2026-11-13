/**
 * brand-page.spec.ts — End-to-end checks of a brand page (/brands/$slug) in real Chromium against the seeded backend:
 * a product page's brand link opens it, "View all" opens the catalog filtered by the brand, crawlers get one title,
 * one canonical and the Brand + BreadcrumbList JSON-LD, the sitemap lists it, no horizontal overflow (phone and
 * desktop), axe, and screenshots (Hebrew, English).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import brands from '../src/stubs/brands.json' with { type: 'json' }
import products from '../src/stubs/products.json' with { type: 'json' }

/** A shown brand with more products than the page shows. */
const BRAND = brands.find((b) => b.slug === 'jr-farm')!
/** Its page URL. */
const PATH = `/brands/${BRAND.slug}`
/** How many products the brand has. */
const COUNT = products.filter((p) => p.brand === BRAND.slug).length

/**
 * Opens a page and waits until every photo in <main> has loaded (lazy ones included), so screenshots are stable.
 * @param page - The Playwright page.
 * @param path - The URL to open.
 */
async function open(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.locator('main img').evaluateAll((imgs) => imgs.forEach((img) => img.setAttribute('loading', 'eager')))
  await page.waitForFunction(() => [...document.querySelectorAll('main img')].every((img) => (img as HTMLImageElement).complete))
}

test("a product page's brand link opens the brand page", async ({ page }) => {
  const product = products.find((p) => p.brand === BRAND.slug)!
  await page.goto(`/en/products/${encodeURIComponent(product.slug)}`)
  await page.getByRole('link', { name: BRAND.name, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(BRAND.name)
  await expect(page).toHaveURL(new RegExp(`/en${PATH}$`))
})

test('"View all" opens the catalog filtered by the brand', async ({ page }) => {
  await open(page, `/en${PATH}`)
  await page.getByRole('link', { name: `View all ${COUNT} products` }).click()
  await expect(page).toHaveURL(new RegExp(`/en/catalog\\?brand=${BRAND.slug}$`))
})

test('crawlers get one title, one canonical and the Brand JSON-LD', async ({ page }) => {
  await open(page, `/en${PATH}`)
  await expect(page).toHaveTitle(`${BRAND.name} | Ultra Pet Israel`)
  await expect(page.locator('head title')).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.ultrapet.co.il/en${PATH}`)
  const types = await page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((el) => JSON.parse(el.textContent!)['@type']))
  expect(types).toEqual(['Brand', 'BreadcrumbList'])
})

test('the sitemap lists the brand in both languages', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text()
  expect(xml).toContain(`<loc>https://www.ultrapet.co.il${PATH}</loc>`)
  expect(xml).toContain(`<loc>https://www.ultrapet.co.il/en${PATH}</loc>`)
})

test('the brand page does not overflow horizontally', async ({ page }) => {
  await open(page, PATH)
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('the brand page has no accessibility violations', async ({ page }) => {
  await open(page, PATH)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('main').analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})

for (const [name, prefix] of [['he', ''], ['en', '/en']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await open(page, `${prefix}${PATH}`)
    await expect(page.locator('main')).toHaveScreenshot(`brand-${name}.png`)
  })
}
