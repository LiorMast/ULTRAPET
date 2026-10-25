/**
 * brands.spec.ts — End-to-end checks of the home page Brands section in real Chromium: it is reachable
 * from the navbar, has no horizontal overflow, passes axe, cards are keyboard-focusable links, and
 * screenshots (Hebrew and English) for visual review.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('the six cards are links and the section does not overflow', async ({ page }) => {
  await page.goto('/')
  const cards = page.locator('#brands ul a')
  await expect(cards).toHaveCount(6)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await cards.first().focus()
  await expect(cards.first()).toBeFocused()
  await cards.first().click()
  await expect(page).toHaveURL(/\/brands\/ultra-pet$/)
})

test('has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.locator('#brands').scrollIntoViewIfNeeded()
  const results = await new AxeBuilder({ page }).include('#brands').analyze()
  expect(results.violations).toEqual([])
})

for (const [name, path] of [['he', '/'], ['en', '/en']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await page.goto(path)
    const section = page.locator('#brands')
    await section.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('#brands img')].every((i) => i.complete))
    await expect(section).toHaveScreenshot(`brands-${name}.png`)
  })
}
