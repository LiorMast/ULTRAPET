/**
 * catalog.spec.ts — End-to-end checks of the catalog page in real Chromium against the seeded backend: paging,
 * category chips and search (filtered on the server), prices hidden from visitors and shown after signing in
 * as the seed's demo customer (and gone again after signing out), no horizontal overflow (phone and desktop),
 * axe, and screenshots (Hebrew and English, signed out and signed in).
 * Product photos are hosted on the WordPress site, so every request for them is answered with a local
 * image: the tests do not depend on the network and the screenshots stay stable.
 */
import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signInCustomer } from './utils.ts'

/** Stand-in for every product photo. */
const PHOTO = readFileSync(new URL('../src/assets/brands/ultra-pet.png', import.meta.url))

/**
 * Opens a catalog URL with the product photos served locally and waits until the visible photos have loaded.
 * @param page - The Playwright page.
 * @param path - The URL to open.
 */
async function open(page: Page, path: string) {
  await page.route('https://www.ultrapet.co.il/wp-content/**', (route) => route.fulfill({ contentType: 'image/png', body: PHOTO }))
  await page.goto(path)
  await expect(page.getByRole('list', { name: /^(מוצרים|Products)$/ }).getByRole('article').first()).toBeVisible()
  // Load every photo now (they are lazy) and wait until each one is decoded, so screenshots are complete.
  await page.locator('main img').evaluateAll(async (imgs) => {
    imgs.forEach((img) => img.setAttribute('loading', 'eager'))
    await Promise.all(imgs.map((img) => (img as HTMLImageElement).decode().catch(() => undefined)))
  })
  await page.waitForFunction(() => [...document.querySelectorAll('main img')].every((img) => (img as HTMLImageElement).naturalWidth > 0))
}

test('pages through the catalog and filters by category', async ({ page }) => {
  await open(page, '/catalog')
  const cards = page.getByRole('list', { name: 'מוצרים' }).getByRole('article')
  await expect(cards).toHaveCount(24)
  const first = await cards.first().getByRole('heading').innerText()

  await page.getByRole('navigation', { name: 'עמודים' }).getByRole('link', { name: 'עמוד 2' }).click()
  await expect(page).toHaveURL(/\/catalog\?page=2$/)
  await expect(cards.first().getByRole('heading')).not.toHaveText(first)
  // The new page starts at the top (smooth scrolling, so wait for it to settle).
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(200)

  await page.getByRole('navigation', { name: 'סינון לפי קטגוריה' }).getByRole('link', { name: 'ציפורים' }).click()
  await expect(page).toHaveURL(/\/catalog\?category=birds$/)
  await expect(page.getByRole('status')).toContainText('מתוך 13 מוצרים')

  // The search runs on the server, in every language: an English word finds products on the Hebrew page.
  await page.getByRole('searchbox', { name: 'חיפוש מוצר' }).fill('blueberry')
  await expect(page).toHaveURL(/\/catalog\?category=birds&q=blueberry$/)
  await expect(page.getByRole('status')).toContainText('מתוך 1 מוצרים')
})

test('hides prices from visitors and shows them after signing in', async ({ page, isMobile }) => {
  await open(page, '/en/catalog')
  const firstCard = page.getByRole('list', { name: 'Products' }).getByRole('article').first()
  await expect(firstCard).toContainText('Log in to see the price')
  await expect(page.getByRole('main')).not.toContainText('₪')

  await signInCustomer(page, isMobile)
  await expect(page).toHaveURL(/\/en\/catalog$/)
  await expect(firstCard).toContainText('₪')
  await expect(firstCard).toContainText('excl. VAT')

  // The sign-in survives a reload ("remember me" off = cookies that last until the browser closes).
  await page.reload()
  await expect(firstCard).toContainText('₪')

  await page.goto('/en/login')
  await page.getByRole('main').getByRole('button', { name: 'Sign out' }).click()
  await open(page, '/en/catalog')
  await expect(page.getByRole('main')).not.toContainText('₪')
})

test('does not overflow horizontally', async ({ page }) => {
  await open(page, '/catalog')
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('has no accessibility violations', async ({ page }) => {
  await open(page, '/catalog')
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('main').analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})

for (const [name, prefix] of [['he', ''], ['en', '/en']] as const) {
  test(`screenshots (${name})`, async ({ page, isMobile }) => {
    await open(page, `${prefix}/catalog`)
    await expect(page.locator('main')).toHaveScreenshot(`catalog-${name}.png`)
    if (name === 'en') {
      await signInCustomer(page, isMobile)
      await open(page, `${prefix}/catalog`)
      await expect(page.getByRole('list', { name: 'Products' }).getByRole('article').first()).toContainText('₪')
      await expect(page.locator('main')).toHaveScreenshot(`catalog-${name}-signed-in.png`)
    }
  })
}
