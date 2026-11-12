/**
 * cart.spec.ts — End-to-end checks of the business customer's cart in real Chromium against the seeded backend,
 * signed in as the seed's demo customer: adding from catalog cards (the "Added" morph, the photo flying to the
 * header cart icon, the badge), the cart icon's tooltip (desktop), the cart panel (the minimum-order banner with
 * its progress bar, a stepper going down to 0 removes the line), adding a quantity from a product page, the cart
 * surviving a reload, no horizontal overflow, and axe on the open panel.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signInCustomer } from './utils.ts'

/**
 * Opens the English catalog signed in as the demo customer, with an empty cart, and waits for the prices.
 * @param page - The Playwright page.
 * @param isMobile - Whether the test runs in the phone project.
 */
async function openCatalog(page: Page, isMobile: boolean) {
  await page.goto('/en/catalog')
  await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('ultrapet.cart.')).forEach((key) => localStorage.removeItem(key)))
  await signInCustomer(page, isMobile)
  if (!isMobile) await page.goto('/en/catalog')
  await expect(page.getByRole('button', { name: 'Add to cart' }).first()).toBeVisible()
}

test('adds from the cards with the fly animation, and edits the cart in the panel', async ({ page, isMobile }) => {
  await openCatalog(page, isMobile)
  const adds = page.getByRole('button', { name: 'Add to cart' })
  const firstName = await page.getByRole('article').first().getByRole('heading').innerText()

  await adds.first().click()
  await expect(adds.first()).toHaveAttribute('data-added', 'true')
  // The photo's copy is in flight, then lands and is removed; the badge pops on landing.
  await expect(page.locator('body > div[aria-hidden="true"] > img')).toHaveCount(1)
  await expect(page.locator('body > div[aria-hidden="true"] > img')).toHaveCount(0)
  const cart = page.getByRole('button', { name: 'Shopping cart, 1 item' })
  await expect(cart.getByTestId('cart-badge')).toHaveClass(/animate-cart-pop/)
  await expect(adds.first()).not.toHaveAttribute('data-added')

  await adds.nth(1).click()
  await expect(page.getByRole('button', { name: 'Shopping cart, 2 items' })).toBeVisible()

  if (!isMobile) {
    await page.getByRole('button', { name: 'Shopping cart, 2 items' }).hover()
    await expect(page.getByRole('tooltip')).toContainText(/2 items · ₪[\d.,]+ before VAT/)
  }

  await page.getByRole('button', { name: 'Shopping cart, 2 items' }).click()
  const panel = page.getByRole('dialog', { name: 'Shopping cart' })
  await expect(panel.getByRole('progressbar', { name: 'Progress to the minimum order' })).toBeVisible()
  await expect(panel).toContainText(/Add ₪[\d.,]+ more to reach the ₪2,000 minimum order/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('[role="dialog"]').analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])

  // The first line's stepper down to 0 removes it.
  const firstLine = panel.getByRole('listitem').filter({ hasText: firstName })
  await firstLine.getByRole('button', { name: 'Decrease to 0 (remove)' }).click()
  await expect(panel.getByRole('listitem')).toHaveCount(1)

  // The cart survives a reload.
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Shopping cart, 1 item' })).toBeVisible()
})

test('adds a chosen quantity from a product page', async ({ page, isMobile }) => {
  await openCatalog(page, isMobile)
  await page.getByRole('article').first().getByRole('link').first().click()
  const main = page.getByRole('main')
  await main.getByRole('button', { name: 'Increase quantity' }).click()
  await main.getByRole('button', { name: 'Increase quantity' }).click()
  await expect(main.getByRole('textbox', { name: 'Quantity' })).toHaveValue('3')
  await main.getByRole('button', { name: 'Add to cart' }).first().click()
  await expect(page.getByRole('button', { name: 'Shopping cart, 3 items' })).toBeVisible()
  await expect(main.getByRole('textbox', { name: 'Quantity' })).toHaveValue('1')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
