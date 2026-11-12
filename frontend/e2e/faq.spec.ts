/**
 * faq.spec.ts — End-to-end checks of the home page FAQ section in real Chromium: one answer open at a time, the
 * spring height animation and the turning chevron (and the reduced-motion fade), keyboard use, no horizontal overflow (phone and desktop),
 * axe, and screenshots (Hebrew, English).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { hideFixedOverlays, scrollIntoViewSettled } from './utils.ts'

/**
 * The CSS animation running on a question's answer panel right now.
 * @param page - The Playwright page.
 * @param question - The question's text.
 * @returns The animation name ("none" when it does not animate).
 */
async function panelAnimation(page: Page, question: string) {
  const id = await page.locator('#faq').getByRole('button', { name: question }).getAttribute('aria-controls')
  return page.locator(`[id="${id}"]`).evaluate((el) => getComputedStyle(el).animationName)
}

test('opens one answer at a time with the spring animation', async ({ page }) => {
  await page.goto('/en')
  const faq = page.locator('#faq')
  await scrollIntoViewSettled(faq)
  const first = faq.getByRole('button', { name: 'Do you sell to private customers?' })
  const minimum = faq.getByRole('button', { name: 'Is there a minimum order?' })
  await expect(first).toHaveAttribute('aria-expanded', 'true')

  await minimum.click()
  expect(await panelAnimation(page, 'Is there a minimum order?')).toBe('accordion-down')
  await expect(faq.getByRole('region', { name: 'Is there a minimum order?' })).toContainText('₪2,000')
  await expect(first).toHaveAttribute('aria-expanded', 'false')
  // The open panel settles at its full height: nothing is clipped.
  const panel = faq.getByRole('region', { name: 'Is there a minimum order?' })
  await expect.poll(() => panel.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0)
  expect(await panel.evaluate((el) => el.scrollHeight - el.clientHeight)).toBe(0)
  // The chevron of the open question points up, the closed one's points down.
  await expect.poll(() => minimum.locator('svg').evaluate((el) => getComputedStyle(el).rotate)).toBe('180deg')
  await expect.poll(() => first.locator('svg').evaluate((el) => getComputedStyle(el).rotate)).toBe('none')

  await minimum.click()
  await expect(minimum).toHaveAttribute('aria-expanded', 'false')
  await expect(panel).toHaveCount(0)
})

test('opens without resizing under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/en')
  const faq = page.locator('#faq')
  await scrollIntoViewSettled(faq)
  await faq.getByRole('button', { name: 'Is there a minimum order?' }).click()
  expect(await panelAnimation(page, 'Is there a minimum order?')).toBe('none')
  await faq.getByRole('button', { name: 'Is there a minimum order?' }).click()
  await expect(faq.getByRole('region', { name: 'Is there a minimum order?' })).toHaveCount(0)
})

test('works with the keyboard', async ({ page }) => {
  await page.goto('/en')
  const faq = page.locator('#faq')
  await scrollIntoViewSettled(faq)
  await faq.getByRole('button', { name: 'Do you sell to private customers?' }).focus()
  await page.keyboard.press('ArrowDown')
  const account = faq.getByRole('button', { name: 'How do I open a business account?' })
  await expect(account).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(account).toHaveAttribute('aria-expanded', 'true')
})

test('does not overflow', async ({ page }) => {
  await page.goto('/')
  await page.locator('#faq').scrollIntoViewIfNeeded()
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.locator('#faq').scrollIntoViewIfNeeded()
  const results = await new AxeBuilder({ page }).include('#faq').analyze()
  expect(results.violations).toEqual([])
})

for (const [name, path] of [['he', '/'], ['en', '/en']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await page.goto(path)
    const section = page.locator('#faq')
    await hideFixedOverlays(page)
    await scrollIntoViewSettled(section)
    await expect(section).toHaveScreenshot(`faq-${name}.png`)
  })
}
