/**
 * resellers.spec.ts — End-to-end checks of the staff panel's resellers page (/admin/resellers) in real Chromium against
 * the real backend: the map of every reseller draws its pins; staff add a reseller by clicking the form's map picker
 * (the latitude and longitude fill in), see it on the public Where to Buy page, open it again from its pin on the admin
 * map, and delete it (so the dev database is left as it was); no axe violations (the page, the open form) and no
 * horizontal overflow on a phone. The address lookup is not run here (it would call OpenStreetMap's Nominatim): the
 * unit tests and the backend tests cover it.
 *
 * Signs in as the staff admin that `flask seed` creates (SEED_ADMIN_* in the repo's .env; signInStaff in utils.ts).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signInStaff } from './utils.ts'
import { overflowX } from './audit.ts'

/** The WCAG tags axe checks. */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** A name no real store has, so the test finds (and deletes) only its own row. */
const NAME = `E2E Reseller ${Date.now()}`

/**
 * Runs axe on a part of the page and expects no violations.
 * @param page - The page.
 * @param selector - The part to check, e.g. "main" or the open dialog.
 */
async function expectNoAxeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).include(selector).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}

test('staff add a reseller on the map, see it on Where to Buy, reopen it from its pin, and delete it', async ({ page }) => {
  await signInStaff(page, '/en/admin/resellers')
  await expect(page.getByRole('heading', { level: 1, name: 'Resellers' })).toBeVisible()
  const map = page.getByRole('region', { name: 'Map of the resellers' })
  await expect(map.locator('.leaflet-marker-icon').first()).toBeVisible()
  await expectNoAxeViolations(page, 'main')

  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'New record' })
  await form.getByLabel('Store name *').fill(NAME)
  await form.getByLabel('Address *').fill('E2E street 1')
  await form.getByLabel('City *').fill('תל אביב')
  const picker = form.getByRole('region', { name: "Map for choosing the store's position" })
  await expect(picker.locator('.leaflet-tile-loaded').first()).toBeVisible()
  await picker.click()
  await expect(form.getByLabel('Latitude *')).not.toHaveValue('')
  await expect(picker.locator('.leaflet-marker-icon')).toHaveCount(1)
  await expectNoAxeViolations(page, '[role="dialog"]')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  try {
    await page.getByRole('searchbox').fill(NAME)
    await expect(page.getByRole('row').filter({ hasText: NAME })).toContainText('תל אביב')

    // On the public page at once.
    await page.goto('/en/where-to-buy')
    await page.getByRole('searchbox').fill(NAME)
    await expect(page.getByRole('list', { name: /Store list/ }).getByRole('listitem')).toHaveCount(1)

    // Its pin on the admin map opens its form.
    await page.goto('/en/admin/resellers')
    await page.locator(`.leaflet-marker-icon[title="${NAME}"]`).click()
    await expect(page.getByRole('dialog', { name: `Edit ${NAME}` })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.setViewportSize({ width: 360, height: 800 })
    expect(await overflowX(page)).toBe(0)
    await page.setViewportSize({ width: 1280, height: 900 })
  } finally {
    await page.getByRole('searchbox').fill(NAME)
    await page.getByRole('button', { name: `Delete ${NAME}` }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('row').filter({ hasText: NAME })).toHaveCount(0)
  }
})
