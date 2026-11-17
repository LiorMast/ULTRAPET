/**
 * private-label.spec.ts — End-to-end checks of Private Label in real Chromium: the menu leads to the /private-label
 * page; the page's head tags (title, canonical, JSON-LD) and the sitemap; no horizontal overflow (phone and desktop),
 * axe and screenshots (Hebrew, English) of the page and of the home page's section; and the staff's in-place editing of
 * the section (axe and no overflow in edit mode, then one save of the steps and the heading after changing, adding,
 * moving and deleting steps).
 *
 * The staff save (/api/staff/page-sections, read back through GET /api/sections) is answered in the browser
 * (page.route), so these tests never change the shared dev database that the other specs' screenshots read. The real
 * save path is the generic page-sections resource, covered by the backend tests (test_staff_api.py).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { hideFixedOverlays, scrollIntoViewSettled, signInStaff } from './utils.ts'

/** The WCAG tags axe checks. */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/**
 * Opens a page and waits for its h1.
 * @param page - The Playwright page.
 * @param path - The URL to open.
 */
async function open(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

/**
 * Answers the staff save of page sections in the browser, and serves the saved rows through GET /api/sections.
 * @param page - The Playwright page, before it loads the home page.
 * @returns The rows the page saved, by key (the latest content of each).
 */
async function fakeSections(page: Page) {
  const saved: Record<string, unknown> = {}
  await page.route('**/api/staff/page-sections**', (route) => {
    const body = route.request().postDataJSON() as { key?: string; content: unknown }
    const key = body.key ?? new URL(route.request().url()).pathname.split('/').pop()!
    saved[key] = body.content
    return route.fulfill({ json: { key, content: body.content } })
  })
  await page.route('**/api/sections', async (route) => {
    const real = (await (await route.fetch()).json()) as Record<string, unknown>
    return route.fulfill({ json: { ...real, ...saved } })
  })
  return saved
}

test('the menu leads to the Private Label page', async ({ page, isMobile }) => {
  await page.goto('/')
  if (isMobile) {
    await page.getByRole('button', { name: 'פתיחת תפריט' }).click()
    await page.getByRole('dialog').getByRole('link', { name: 'תווית פרטית' }).click()
  } else {
    await page.getByRole('navigation', { name: 'תפריט ראשי' }).getByRole('link', { name: 'תווית פרטית' }).click()
  }
  await expect(page).toHaveURL(/\/private-label$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('בנו מותג משלכם למוצרי חיות מחמד')
})

test('crawlers get the title, canonical and JSON-LD, and the sitemap lists the page', async ({ page, request }) => {
  await open(page, '/en/private-label')
  await expect(page).toHaveTitle('Private label pet food and pet products | Ultra Pet Israel')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.ultrapet.co.il/en/private-label')
  const types = await page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((el) => JSON.parse(el.textContent!)['@type']))
  expect(types).toEqual(['BreadcrumbList', 'FAQPage'])
  const xml = await (await request.get('/sitemap.xml')).text()
  expect(xml).toContain('<loc>https://www.ultrapet.co.il/private-label</loc>')
  expect(xml).toContain('<loc>https://www.ultrapet.co.il/en/private-label</loc>')
})

test('the page and the home section do not overflow horizontally', async ({ page }) => {
  for (const path of ['/private-label', '/']) {
    await page.goto(path)
    await scrollIntoViewSettled(page.locator('#private-label'))
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} at ${width}px`).toBe(true)
    }
  }
})

test('the page and the home section have no accessibility violations', async ({ page }) => {
  await open(page, '/private-label')
  const pageResults = await new AxeBuilder({ page }).withTags(WCAG).include('main').analyze()
  expect(pageResults.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  await page.goto('/en')
  await scrollIntoViewSettled(page.locator('#private-label'))
  const sectionResults = await new AxeBuilder({ page }).withTags(WCAG).include('#private-label').analyze()
  expect(sectionResults.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})

for (const [name, prefix] of [['he', ''], ['en', '/en']] as const) {
  test(`screenshots (${name})`, async ({ page }) => {
    await open(page, `${prefix}/private-label`)
    await hideFixedOverlays(page)
    await expect(page.locator('main')).toHaveScreenshot(`private-label-page-${name}.png`)
    await page.goto(prefix || '/')
    const section = page.locator('#private-label')
    await scrollIntoViewSettled(section)
    await hideFixedOverlays(page)
    await expect(section).toHaveScreenshot(`private-label-section-${name}.png`)
  })
}

test('staff edit the steps in place and save them with the heading at once', async ({ page }) => {
  const saved = await fakeSections(page)
  await signInStaff(page)
  await page.goto('/en')
  const section = page.locator('#private-label')
  await scrollIntoViewSettled(section)
  await section.getByRole('button', { name: 'Edit on page: Private label' }).click()

  const axe = await new AxeBuilder({ page }).include('#private-label').withTags(WCAG).analyze()
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'no horizontal scrolling in edit mode').toBe(0)

  await section.getByRole('textbox', { name: 'Step 1 title' }).fill('Concept')
  await section.getByRole('button', { name: 'Add a step' }).click()
  await expect(section.getByRole('textbox', { name: 'Step 6 title' })).toBeFocused()
  await section.getByRole('textbox', { name: 'Step 6 title' }).fill('Aftercare')
  await section.getByRole('combobox', { name: 'Icon of step 6' }).selectOption('truck')
  await section.getByRole('button', { name: 'Move step 6 earlier' }).click()
  await expect(section.getByRole('button', { name: 'Move step 5 earlier' })).toBeFocused()
  await section.getByRole('button', { name: 'Delete Step 2' }).click()
  await section.getByRole('button', { name: 'Save' }).click()

  await expect(section.getByRole('textbox')).toHaveCount(0)
  await expect(section.getByRole('heading', { level: 3 })).toHaveText(['Concept', 'Development', 'Production', 'Aftercare', 'Shipping'])
  const steps = (saved.private_label_steps as { steps: { id: string; icon: string; title: Record<string, string> }[] }).steps
  // A built-in step's box starts with the dictionary's words, which are saved as they were left.
  expect(steps.map((step) => step.title.en)).toEqual(['Concept', 'Development', 'Production', 'Aftercare', 'Shipping'])
  expect(steps[3].title.he).toBeUndefined()
  expect(steps[3].icon).toBe('truck')
  expect(saved.private_label).toBeDefined()
})
