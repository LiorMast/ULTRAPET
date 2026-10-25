/**
 * stats.spec.ts — End-to-end checks of the home page Stats band in real Chromium: four figures that end
 * on their final values, no horizontal overflow (phone and desktop), axe, and screenshots (Hebrew, English).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('shows four figures and does not overflow', async ({ page }) => {
  await page.goto('/')
  await page.locator('#stats').scrollIntoViewIfNeeded()
  await expect(page.locator('#stats li')).toHaveCount(4)
  await expect(page.locator('#stats li [aria-hidden]').nth(2)).toHaveText('1,000+')
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.locator('#stats').scrollIntoViewIfNeeded()
  const results = await new AxeBuilder({ page }).include('#stats').analyze()
  expect(results.violations).toEqual([])
})

for (const [name, path] of [['he', '/'], ['en', '/en']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await page.goto(path)
    const section = page.locator('#stats')
    await section.scrollIntoViewIfNeeded()
    await expect(section.locator('li [aria-hidden]').nth(2)).toHaveText('1,000+')
    await expect(section).toHaveScreenshot(`stats-${name}.png`)
  })
}
