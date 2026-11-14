/**
 * redesign.spec.ts — Cross-page end-to-end checks of the rounded redesign in real Chromium against the real backend:
 * no page scrolls sideways from a 360px phone to a 1440px desktop (both languages); every control reached with Tab
 * shows a visible focus ring (rounded shapes must not swallow it); with reduced motion nothing moves (no rising text,
 * nudging hint or turning spinner) and every section shows; a button that waits on the server shows its spinner, keeps
 * its size and focus, and sends one request however often it is pressed (sign-in, an admin save); a slow navigation
 * keeps the page and runs the top progress bar; and the 404 page passes axe.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signInStaff } from './utils.ts'

/**
 * Reads the first product's and article's URL names from the API, so the pages below exist in any seeded database.
 * @param page - The Playwright page (its request context reaches the backend through the dev server's proxy).
 * @returns The product and article slugs.
 */
async function slugs(page: Page) {
  const products = (await (await page.request.get('/api/products?pageSize=1')).json()) as { items: { slug: string }[] }
  const articles = (await (await page.request.get('/api/articles')).json()) as { slug: string }[]
  return { product: products.items[0].slug, article: articles[0].slug }
}

/**
 * How far the page scrolls sideways (0 = it fits).
 * @param page - The Playwright page.
 * @returns The overflow in pixels.
 */
const sidewaysOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test.describe('layout', () => {
  test.skip(({ isMobile }) => isMobile, 'the widths are set explicitly, once')

  for (const name of ['home', 'catalog', 'product', 'brand', 'articles', 'article', 'where-to-buy', 'login'] as const) {
    test(`the ${name} page fits every width from 360px, in both languages`, async ({ page }) => {
      test.setTimeout(90_000)
      const { product, article } = await slugs(page)
      const paths = { home: '/', catalog: '/catalog', product: `/products/${product}`, brand: '/brands/paw', articles: '/articles', article: `/articles/${article}`, 'where-to-buy': '/where-to-buy', login: '/login' }
      for (const prefix of ['', '/en']) {
        for (const width of [360, 768, 1280, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          await page.goto(`${prefix}${paths[name]}`.replace(/\/$/, '') || '/')
          await page.getByRole('main').locator('h1').first().waitFor()
          expect(await sidewaysOverflow(page), `${prefix}${paths[name]} at ${width}px`).toBeLessThanOrEqual(0)
        }
      }
    })
  }
})

test.describe('keyboard focus', () => {
  for (const path of ['/en', '/en/catalog', '/where-to-buy']) {
    test(`every control reached with Tab shows a focus ring (${path})`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'keyboard navigation is a desktop check')
      await page.goto(path)
      await page.getByRole('main').locator('h1').first().waitFor()
      const missing: string[] = []
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab')
        // Let the focus styles' transitions finish before reading them.
        await page.waitForTimeout(160)
        const report = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null
          if (!el || el === document.body) return null
          const style = getComputedStyle(el)
          const after = getComputedStyle(el, '::after')
          const ring = (s: CSSStyleDeclaration) => (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow !== 'none' && s.boxShadow !== '')
          const visible = el.getBoundingClientRect().width > 0
          return { ok: !visible || ring(style) || ring(after), name: `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}"` }
        })
        if (report && !report.ok) missing.push(report.name)
      }
      expect(missing, 'controls without a visible focus ring').toEqual([])
    })
  }
})

test('with reduced motion nothing moves, and every home section is visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/en')
  await page.locator('#contact').waitFor()
  const moving = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === 'running')
      .map((animation) => (animation as CSSAnimation).animationName)
      .filter((name) => ['hero-rise', 'hint-down', 'spinner-turn', 'route-progress', 'route-progress-rtl', 'cart-nudge'].includes(name)),
  )
  expect(moving).toEqual([])
  for (const id of ['home', 'stats', 'brands', 'categories', 'about', 'faq', 'contact']) {
    const section = page.locator(`#${id}`)
    await section.scrollIntoViewIfNeeded()
    await expect(section).toBeVisible()
    expect(Number(await section.evaluate((el) => getComputedStyle(el).opacity)), `#${id} opacity`).toBe(1)
  }
})

test.describe('waiting buttons', () => {
  test('signing in shows the spinner in the same box, keeps the focus, and sends one request', async ({ page }) => {
    const requests: string[] = []
    await page.route('**/api/auth/login', async (route) => {
      requests.push(route.request().method())
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_credentials' }) })
    })
    await page.goto('/en/login')
    const main = page.getByRole('main')
    await main.getByLabel('Email').fill('nobody@example.com')
    await main.getByLabel('Password', { exact: true }).fill('not-the-password')
    const submit = main.getByRole('button', { name: 'Log in' })
    const before = (await submit.boundingBox())!
    await submit.click()
    await expect(submit).toHaveAttribute('aria-busy', 'true')
    await expect(submit.locator('[data-slot="spinner"]')).toBeVisible()
    const during = (await submit.boundingBox())!
    expect([Math.round(during.width), Math.round(during.height)]).toEqual([Math.round(before.width), Math.round(before.height)])
    await expect(submit).toBeFocused()
    // A real click on the busy button (force: Playwright itself would wait for aria-disabled to clear) and Enter.
    await submit.click({ force: true })
    await page.keyboard.press('Enter')
    await expect(main.getByRole('alert')).toHaveText('Wrong email or password.')
    await expect(submit).not.toHaveAttribute('aria-busy')
    expect(requests).toEqual(['POST'])
  })

  test('an admin save shows the spinner and saves once however often it is clicked', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the admin panel is a desktop flow')
    await signInStaff(page, '/en/admin/brands')
    const edit = page.locator('button[data-action="edit"]').first()
    const id = (await edit.getAttribute('data-row'))!
    // The brand as stored: the held save answers with it unchanged, so the database (shared with the other specs) stays as is.
    const rows = (await (await page.request.get('/api/staff/brands')).json()) as { id: string }[]
    const stored = rows.find((row) => row.id === id)
    const patches: string[] = []
    await page.route(`**/api/staff/brands/${id}`, async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue()
      patches.push(route.request().method())
      await new Promise((resolve) => setTimeout(resolve, 1200))
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stored) })
    })
    await edit.click()
    const dialog = page.getByRole('dialog')
    const english = dialog.getByRole('group', { name: 'Tagline' }).getByLabel('English')
    await english.fill(`${await english.inputValue()} (test)`)
    const save = dialog.getByRole('button', { name: 'Save' })
    await save.click()
    await expect(save).toHaveAttribute('aria-busy', 'true')
    await expect(save.locator('[data-slot="spinner"]')).toBeVisible()
    // Real clicks on the busy button (force: Playwright itself would wait for aria-disabled to clear).
    await save.click({ force: true })
    await save.click({ force: true })
    await expect(dialog).toBeHidden()
    expect(patches).toEqual(['PATCH'])
  })
})

test('a slow navigation keeps the page, marks it busy and runs the progress bar', async ({ page }) => {
  await page.goto('/en')
  await page.locator('#stats').waitFor()
  await page.route('**/api/articles', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.continue()
  })
  // The header's Articles link (hidden on phones, where it is in the drawer): clicked from the page, as a visitor would.
  await page.locator('header a[href="/en/articles"]').first().evaluate((link: HTMLAnchorElement) => link.click())
  await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('div.fixed.top-0[data-active]')).toBeAttached()
  await expect(page.locator('#stats')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Pet care guides and tips' })).toBeVisible()
  await expect(page.getByRole('main')).not.toHaveAttribute('aria-busy')
})

test('the 404 page has no accessibility violations', async ({ page }) => {
  await page.goto('/en/no-such-page')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})
