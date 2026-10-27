/**
 * articles.spec.ts — End-to-end checks of the articles pages in real Chromium: the navbar link, opening
 * an article from the list, the head tags a crawler sees (one title, one canonical, hreflang, JSON-LD),
 * the sitemap, no horizontal overflow (phone and desktop), axe, and screenshots (Hebrew, English).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** The article opened by the article-page tests. */
const SLUG = 'living-with-a-cat'

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

test('the menu leads to the articles, and a card opens its article', async ({ page, isMobile }) => {
  await page.goto('/')
  if (isMobile) {
    await page.getByRole('button', { name: 'פתיחת תפריט' }).click()
    await page.getByRole('dialog').getByRole('link', { name: 'מאמרים' }).click()
  } else {
    await page.getByRole('navigation', { name: 'תפריט ראשי' }).getByRole('link', { name: 'מאמרים' }).click()
  }
  await expect(page).toHaveURL(/\/articles$/)
  await page.getByRole('link', { name: /החיים המשותפים עם חתול/ }).click()
  await expect(page).toHaveURL(new RegExp(`/articles/${SLUG}$`))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('החיים המשותפים עם חתול: תשומת הלב לצרכי הפרושים')
})

test('crawlers get one title, one canonical, hreflang links and JSON-LD', async ({ page }) => {
  await open(page, `/en/articles/${SLUG}`)
  await expect(page).toHaveTitle('Living with a Cat: Caring for an Independent Companion | Ultra Pet Israel')
  await expect(page.locator('head title')).toHaveCount(1)
  await expect(page.locator('meta[name="description"]')).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.ultrapet.co.il/en/articles/${SLUG}`)
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(3)
  const types = await page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((el) => JSON.parse(el.textContent!)['@type']))
  expect(types).toEqual(['BlogPosting', 'BreadcrumbList'])

  // Client-side navigation replaces the tags instead of piling them up.
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Articles' }).click()
  await expect(page).toHaveTitle('Dog and cat care articles and tips | Ultra Pet Israel')
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.ultrapet.co.il/en/articles')
})

test('the sitemap lists every article in both languages', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text()
  expect(xml).toContain(`<loc>https://www.ultrapet.co.il/articles/${SLUG}</loc>`)
  expect(xml).toContain(`<loc>https://www.ultrapet.co.il/en/articles/${SLUG}</loc>`)
  expect(xml).toContain('<loc>https://www.ultrapet.co.il/en/articles</loc>')
})

for (const path of ['/articles', `/articles/${SLUG}`]) {
  test(`${path} does not overflow horizontally`, async ({ page }) => {
    await open(page, path)
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  })

  test(`${path} has no accessibility violations`, async ({ page }) => {
    await open(page, path)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('main').analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  })
}

for (const [name, prefix] of [['he', ''], ['en', '/en']] as const) {
  test(`screenshots (${name})`, async ({ page }) => {
    await open(page, `${prefix}/articles`)
    await expect(page.locator('main')).toHaveScreenshot(`articles-${name}.png`)
    await open(page, `${prefix}/articles/${SLUG}`)
    await expect(page.locator('main')).toHaveScreenshot(`article-${name}.png`)
  })
}
