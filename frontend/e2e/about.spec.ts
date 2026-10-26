/**
 * about.spec.ts — End-to-end checks of the home page About section in real Chromium: content present,
 * no horizontal overflow (phone and desktop), axe, and screenshots (Hebrew, English).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('shows the pillars and offers and does not overflow', async ({ page }) => {
  await page.goto('/')
  await page.locator('#about').scrollIntoViewIfNeeded()
  await expect(page.locator('#about h4')).toHaveCount(8)
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.locator('#about').scrollIntoViewIfNeeded()
  const results = await new AxeBuilder({ page }).include('#about').analyze()
  expect(results.violations).toEqual([])
})

for (const [name, path] of [['he', '/'], ['en', '/en']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await page.goto(path)
    const section = page.locator('#about')
    await section.scrollIntoViewIfNeeded()
    await expect(section).toHaveScreenshot(`about-${name}.png`)
  })
}
