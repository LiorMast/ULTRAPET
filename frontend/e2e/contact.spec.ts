/**
 * contact.spec.ts — End-to-end checks of the home page Contact section in real Chromium: content present,
 * no horizontal overflow (phone and desktop), axe, and screenshots (Hebrew, English).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('shows the cards and the form and does not overflow', async ({ page }) => {
  await page.goto('/')
  await page.locator('#contact').scrollIntoViewIfNeeded()
  await expect(page.locator('#contact ul > li')).toHaveCount(4)
  await expect(page.locator('#contact form')).toBeVisible()
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.locator('#contact').scrollIntoViewIfNeeded()
  const results = await new AxeBuilder({ page }).include('#contact').analyze()
  expect(results.violations).toEqual([])
})

for (const [name, path] of [['he', '/'], ['en', '/en']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await page.goto(path)
    const section = page.locator('#contact')
    await section.scrollIntoViewIfNeeded()
    await expect(section).toHaveScreenshot(`contact-${name}.png`)
  })
}
