/**
 * stats.spec.ts — End-to-end checks of the home page Stats band in real Chromium: four figures that end
 * on their final values, no horizontal overflow (phone and desktop), every figure inside its cell (360px up), axe, and
 * screenshots (Hebrew, English).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { hideFixedOverlays, scrollIntoViewSettled } from './utils.ts'

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

test('every figure fits inside its own cell, from a 360px phone up', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [360, 412, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/en')
    await page.locator('#stats li').first().waitFor()
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    const spill = await page.locator('#stats li').evaluateAll((cells) =>
      cells.map((cell) => {
        const style = getComputedStyle(cell)
        const box = cell.getBoundingClientRect()
        const figure = cell.querySelector('[aria-hidden]')!.getBoundingClientRect()
        return Math.max(0, box.left + parseFloat(style.paddingLeft) - figure.left, figure.right - (box.right - parseFloat(style.paddingRight)))
      }),
    )
    expect(spill, `figures at ${width}px`).toEqual([0, 0, 0, 0])
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
    await hideFixedOverlays(page)
    await scrollIntoViewSettled(section)
    await expect(section.locator('li [aria-hidden]').nth(2)).toHaveText('1,000+')
    await expect(section).toHaveScreenshot(`stats-${name}.png`)
  })
}
