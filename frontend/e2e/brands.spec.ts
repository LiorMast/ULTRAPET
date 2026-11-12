/**
 * brands.spec.ts — End-to-end checks of the home page Brands section in real Chromium: it is reachable
 * from the navbar, has no horizontal overflow, passes axe, cards are keyboard-focusable links, and
 * screenshots (Hebrew and English) for visual review.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { hideFixedOverlays, scrollIntoViewSettled } from './utils.ts'

test('the carousel pages through the brands with the arrows and the dots', async ({ page }) => {
  await page.goto('/en')
  const section = page.locator('#brands')
  await section.scrollIntoViewIfNeeded()
  const dots = section.getByRole('navigation', { name: 'Carousel pages' }).getByRole('button')
  await expect(dots).toHaveCount(2)
  await expect(dots.first()).toHaveAttribute('aria-current', 'true')
  await section.getByRole('button', { name: 'Next' }).click()
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true')
  await expect(section.getByRole('button', { name: 'Next' })).toBeDisabled()
  await dots.first().click()
  await expect(dots.first()).toHaveAttribute('aria-current', 'true')
})

test('the six cards are links and the section does not overflow', async ({ page }) => {
  await page.goto('/')
  const cards = page.locator('#brands a')
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
    await scrollIntoViewSettled(section)
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('#brands img')].every((i) => i.complete))
    await hideFixedOverlays(page)
    await expect(section).toHaveScreenshot(`brands-${name}.png`)
  })
}
