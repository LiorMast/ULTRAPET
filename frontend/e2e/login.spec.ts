/**
 * login.spec.ts — End-to-end checks of the header login popover in real Chromium (desktop only: below xl the
 * mobile drawer links to /login instead): it opens and stays inside the viewport, validates, has no axe
 * violations, and looks right (Hebrew, English).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'the popover is part of the desktop header')
  return page.goto('/')
})

test('opens, validates and stays inside the viewport', async ({ page }) => {
  await page.getByRole('button', { name: 'התחברות' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const box = (await dialog.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  await dialog.getByRole('button', { name: 'התחברות' }).click()
  await expect(dialog.getByText('שדה חובה')).toHaveCount(2)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('has no accessibility violations', async ({ page }) => {
  await page.getByRole('button', { name: 'התחברות' }).click()
  await page.getByRole('dialog').waitFor()
  const results = await new AxeBuilder({ page }).include('[role=dialog]').analyze()
  expect(results.violations).toEqual([])
})

for (const [name, path, button] of [['he', '/', 'התחברות'], ['en', '/en', 'Login']] as const) {
  test(`screenshot (${name})`, async ({ page }) => {
    await page.goto(path)
    await page.getByRole('button', { name: button }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    await page.waitForTimeout(300)
    await expect(dialog).toHaveScreenshot(`login-${name}.png`)
  })
}
