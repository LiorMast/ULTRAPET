/**
 * admin-drawer.spec.ts — End-to-end checks of the header's admin drawer (SubNavDrawer) in real Chromium, signed in
 * as the seed staff admin (desktop only: the Admin panel button is part of the desktop header; the mobile drawer
 * has its own Admin panel link): the button slides the drawer down with a transition and back up, the drawer
 * lists the admin pages and takes staff there (and stays open), Escape closes it, no axe violations, and a screenshot (Hebrew).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator } from '@playwright/test'
import { signInStaff } from './utils.ts'

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'the Admin panel button is part of the desktop header')
  await signInStaff(page, '/admin/brands')
  await page.goto('/')
})

/**
 * Waits until the drawer's transitions (its height, the links' fade and slide) have finished.
 * @param drawer - The drawer element.
 */
async function settle(drawer: Locator) {
  await drawer.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
}

/**
 * Finds the header's Admin panel button and the drawer it controls (through aria-controls).
 * @param page - The Playwright page.
 * @returns The toggle button and the drawer element.
 */
async function adminDrawer(page: import('@playwright/test').Page) {
  const toggle = page.getByRole('banner').getByRole('button', { name: 'לוח ניהול' })
  const id = await toggle.getAttribute('aria-controls')
  return { toggle, drawer: page.locator(`[id="${id}"]`) }
}

test('the Admin panel button slides the drawer down and back up', async ({ page }) => {
  const { toggle, drawer } = await adminDrawer(page)
  expect((await drawer.boundingBox())!.height).toBe(0)

  await toggle.click()
  // The height animates (a CSS transition on grid-template-rows) instead of jumping.
  const running = await drawer.evaluate((element) => element.getAnimations().map((animation) => (animation as CSSTransition).transitionProperty))
  expect(running).toContain('grid-template-rows')
  await settle(drawer)
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const nav = drawer.getByRole('navigation', { name: 'לוח ניהול' })
  await expect(nav.getByRole('link')).toHaveText(['מוצרים', 'קטגוריות', 'מותגים'])
  expect((await drawer.boundingBox())!.height).toBeGreaterThan(40)
  await expect(page.getByRole('banner')).toHaveScreenshot('header-he-admin-drawer.png')

  await toggle.click()
  await settle(drawer)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(drawer).toHaveAttribute('inert')
  expect((await drawer.boundingBox())!.height).toBe(0)
})

test('a page chosen in the drawer opens, and the drawer stays open', async ({ page }) => {
  const { toggle, drawer } = await adminDrawer(page)
  await toggle.click()
  await drawer.getByRole('link', { name: 'קטגוריות' }).click()
  await expect(page).toHaveURL(/\/admin\/categories$/)
  await expect(page.getByRole('table')).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(drawer.getByRole('link', { name: 'קטגוריות' })).toBeVisible()
})

test('Escape closes the drawer and puts the focus back on the button', async ({ page }) => {
  const { toggle, drawer } = await adminDrawer(page)
  await toggle.click()
  await drawer.getByRole('link', { name: 'מוצרים' }).focus()
  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toBeFocused()
})

test('has no accessibility violations with the drawer open', async ({ page }) => {
  const { toggle, drawer } = await adminDrawer(page)
  await toggle.click()
  await settle(drawer)
  const results = await new AxeBuilder({ page }).include('header').analyze()
  expect(results.violations).toEqual([])
})
