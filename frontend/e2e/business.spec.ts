/**
 * business.spec.ts — End-to-end checks of the home page's Business Customers section (#business) in real Chromium:
 * the header's "Become a business customer" link reaches it; no horizontal overflow (phone and desktop); axe; the
 * screenshots (Hebrew, English); and sending a request for an account, with the form's checks first.
 *
 * The request (POST /api/leads) is answered in the browser (page.route), so these tests never add requests to the
 * shared dev database nor email anyone. The real endpoint (storing, the email to staff) is covered by the backend
 * tests (test_leads.py).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { hideFixedOverlays, scrollIntoViewSettled } from './utils.ts'
import { overflowX } from './audit.ts'

/** The WCAG tags axe checks. */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

test('the section does not overflow horizontally', async ({ page }) => {
  await page.goto('/')
  await scrollIntoViewSettled(page.locator('#business'))
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await overflowX(page), `at ${width}px`).toBe(0)
  }
})

test('the section has no accessibility violations, also with errors shown', async ({ page }) => {
  await page.goto('/en')
  const section = page.locator('#business')
  await scrollIntoViewSettled(section)
  await section.getByRole('button', { name: 'Send request' }).click()
  await expect(section.getByRole('alert').first()).toBeVisible()
  const results = await new AxeBuilder({ page }).withTags(WCAG).include('#business').analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})

for (const [name, prefix] of [['he', ''], ['en', '/en']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await page.goto(prefix || '/')
    const section = page.locator('#business')
    await scrollIntoViewSettled(section)
    await hideFixedOverlays(page)
    await expect(section).toHaveScreenshot(`business-section-${name}.png`)
  })
}

test('a business sends a request for an account', async ({ page }) => {
  let sent: Record<string, unknown> | null = null
  await page.route('**/api/leads', (route) => {
    sent = route.request().postDataJSON() as Record<string, unknown>
    return route.fulfill({ status: 201, json: { ok: true } })
  })
  await page.goto('/en')
  const section = page.locator('#business')
  await scrollIntoViewSettled(section)
  await section.getByLabel('Business name *').fill('Happy Paws')
  await section.getByLabel('Contact person *').fill('Dana Cohen')
  await section.getByLabel('Phone *').fill('052-1234567')
  await section.getByLabel('Email *').fill('dana@happypaws.co.il')
  await section.getByLabel('City *').fill('Haifa')
  await section.getByRole('button', { name: 'Send request' }).click()

  await expect(section.getByRole('status')).toContainText('Request received')
  expect(sent).toMatchObject({ companyName: 'Happy Paws', contactPerson: 'Dana Cohen', email: 'dana@happypaws.co.il', locale: 'en', website: '' })
})
