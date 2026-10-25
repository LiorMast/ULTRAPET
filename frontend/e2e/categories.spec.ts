/**
 * categories.spec.ts — End-to-end checks of the home page Categories carousel in real Chromium: the arrows
 * scroll the row and disable at the ends (English and RTL Hebrew), cards are links, the page does not
 * overflow horizontally, axe passes, and screenshots (Hebrew, English) for visual review.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const HIDE_HEADER = 'header { visibility: hidden !important; }'

for (const [name, path, next, previous] of [
  ['he', '/', 'הבא', 'הקודם'],
  ['en', '/en', 'Next', 'Previous'],
] as const) {
  test(`arrows scroll the row and disable at the ends (${name})`, async ({ page }) => {
    await page.goto(path)
    const section = page.locator('#categories')
    await section.scrollIntoViewIfNeeded()
    const track = section.locator('ul').first()
    const offset = () => track.evaluate((el) => Math.abs(el.scrollLeft))
    await expect(section.getByRole('button', { name: previous })).toBeDisabled()
    await section.getByRole('button', { name: next }).click()
    await expect.poll(offset).toBeGreaterThan(50)
    await expect(section.getByRole('button', { name: previous })).toBeEnabled()
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(700) // let the smooth scroll settle before reading the button state
      if (!(await section.getByRole('button', { name: next }).isEnabled())) break
      await section.getByRole('button', { name: next }).click()
    }
    await expect(section.getByRole('button', { name: next })).toBeDisabled()
    await section.getByRole('button', { name: previous }).click()
    await expect(section.getByRole('button', { name: next })).toBeEnabled()
  })
}

test('the six cards are links and the page does not overflow', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#categories ul a')).toHaveCount(6)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.locator('#categories ul a').first().click()
  await expect(page).toHaveURL(/\/categories\/dog-food$/)
})

test('has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.locator('#categories').scrollIntoViewIfNeeded()
  const results = await new AxeBuilder({ page }).include('#categories').analyze()
  expect(results.violations).toEqual([])
})

for (const [name, path] of [['he', '/'], ['en', '/en']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await page.goto(path)
    await page.addStyleTag({ content: HIDE_HEADER })
    const section = page.locator('#categories')
    await section.scrollIntoViewIfNeeded()
    await expect(section.getByRole('button', { name: /Next|הבא/ })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expect(section).toHaveScreenshot(`categories-${name}.png`)
  })
}
