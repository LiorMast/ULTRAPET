/**
 * product.spec.ts — End-to-end checks of a product page (/products/$slug) in real Chromium against the seeded
 * backend: a catalog card opens it, the gallery switches photos, crawlers get one title, one canonical and the
 * Product + BreadcrumbList JSON-LD, the sitemap lists it, no horizontal overflow (phone and desktop), axe, and
 * screenshots (Hebrew, English).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import products from '../src/stubs/products.json' with { type: 'json' }

/** The first catalog product (its card is the first on /catalog). */
const FIRST = products[0]
/** A product with a gallery of several photos (the first catalog product when none has one). */
const PRODUCT = products.find((p) => p.images.length >= 3) ?? FIRST
/** Its page URL (the slug holds Hebrew words). */
const PATH = `/products/${encodeURIComponent(PRODUCT.slug)}`

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

test('a catalog card opens its product page', async ({ page }) => {
  await page.goto('/en/catalog')
  await page.getByRole('link', { name: FIRST.name.en }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(FIRST.name.en)
  await expect(page).toHaveURL(new RegExp(`/en/products/${encodeURIComponent(FIRST.slug)}$`))
})

test('the thumbnails switch the large photo', async ({ page }) => {
  await open(page, `/en${PATH}`)
  const gallery = page.getByRole('group', { name: 'Product photos' })
  await gallery.getByRole('button', { name: `Show photo 2 of ${PRODUCT.images.length}` }).click()
  await expect(gallery.getByRole('button', { name: /^Show photo 2/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(gallery.locator('img').first()).toHaveAttribute('src', new RegExp(`${PRODUCT.images[1].src.replace(/[.]/g, '\\.')}$`))
})

test('crawlers get one title, one canonical and the Product JSON-LD', async ({ page }) => {
  await open(page, `/en${PATH}`)
  await expect(page).toHaveTitle(`${PRODUCT.name.en} | Ultra Pet Israel`)
  await expect(page.locator('head title')).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.ultrapet.co.il/en${PATH}`)
  const types = await page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((el) => JSON.parse(el.textContent!)['@type']))
  expect(types).toEqual(['Product', 'BreadcrumbList'])
})

test('the sitemap lists the product in both languages', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text()
  expect(xml).toContain(`<loc>https://www.ultrapet.co.il${PATH}</loc>`)
  expect(xml).toContain(`<loc>https://www.ultrapet.co.il/en${PATH}</loc>`)
})

test('the product page does not overflow horizontally', async ({ page }) => {
  await open(page, PATH)
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('the product page has no accessibility violations', async ({ page }) => {
  await open(page, PATH)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('main').analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})

for (const [name, prefix] of [['he', ''], ['en', '/en']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await open(page, `${prefix}${PATH}`)
    await expect(page.locator('main')).toHaveScreenshot(`product-${name}.png`)
  })
}
