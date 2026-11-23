/**
 * account.spec.ts — End-to-end checks of the customer profile in real Chromium: the demo customer opens "My account"
 * from the header (desktop) or the menu (phone) and sees their details, discounts and purchase history; no horizontal
 * overflow and axe on /account; staff open a customer's profile from the customers table; and the account requests
 * page (/admin/requests) passes axe and does not overflow. Nothing here changes the dev database.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { signInCustomer, signInStaff } from './utils.ts'
import { overflowX } from './audit.ts'

/** The WCAG tags axe checks. */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

test('the demo customer opens their account', async ({ page, isMobile }) => {
  await page.goto('/en')
  await signInCustomer(page, isMobile)
  if (isMobile) {
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    await page.getByRole('dialog').getByRole('link', { name: 'My account' }).click()
  } else {
    await page.getByRole('banner').getByRole('link', { name: 'My account' }).click()
  }
  await expect(page).toHaveURL(/\/en\/account$/)
  await expect(page.getByRole('heading', { level: 1, name: 'My account' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Account details' })).toContainText('Online now')
  await expect(page.getByRole('region', { name: 'My discounts' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Purchase history' })).toBeVisible()

  const results = await new AxeBuilder({ page }).withTags(WCAG).include('main').analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await overflowX(page), `at ${width}px`).toBe(0)
  }
})

test('staff open a customer profile from the customers table', async ({ page }) => {
  await signInStaff(page, '/en/admin/customers')
  const link = page.getByRole('table').getByRole('link').first()
  const name = (await link.textContent()) ?? ''
  await link.click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Account details' })).toContainText('Internal notes')
  const results = await new AxeBuilder({ page }).withTags(WCAG).include('main').analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})

test('the account requests page passes axe and does not overflow', async ({ page }) => {
  await signInStaff(page, '/en/admin/requests')
  await expect(page.getByRole('heading', { level: 1, name: 'Account requests' })).toBeVisible()
  const results = await new AxeBuilder({ page }).withTags(WCAG).include('main').analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  expect(await overflowX(page)).toBe(0)
})
