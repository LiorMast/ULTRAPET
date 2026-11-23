/**
 * suppliers.spec.ts — End-to-end checks of the staff panel's suppliers page (/admin/suppliers) in real Chromium
 * against the real backend: staff add a supplier (country picked by typing), link a product to it in the "Products"
 * dialog with a code, a cost and a currency, see it saved after a reload, and delete the supplier again (so the dev
 * database is left as it was); no axe violations (the table, the open dialog) and no horizontal overflow on a phone.
 *
 * Signs in as the staff admin that `flask seed` creates (SEED_ADMIN_* in the repo's .env; signInStaff in utils.ts).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signInStaff } from './utils.ts'
import { overflowX } from './audit.ts'

/** The WCAG tags axe checks. */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** A name no real supplier has, so the test finds (and deletes) only its own row. */
const NAME = `E2E Supplier ${Date.now()}`

/**
 * Runs axe on a part of the page and expects no violations.
 * @param page - The page.
 * @param selector - The part to check, e.g. "main" or the open dialog.
 */
async function expectNoAxeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).include(selector).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}

test('staff add a supplier, link a product with its cost, and delete the supplier', async ({ page }) => {
  await signInStaff(page, '/en/admin/suppliers')
  await expect(page.getByRole('heading', { level: 1, name: 'Suppliers' })).toBeVisible()
  await expectNoAxeViolations(page, 'main')

  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'New record' })
  await form.getByLabel('Company name *').fill(NAME)
  await form.getByRole('combobox', { name: 'Country' }).fill('Spai')
  await page.getByRole('option', { name: 'Spain' }).click()
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()
  const row = page.getByRole('row').filter({ hasText: NAME })
  await expect(row).toContainText('Spain')

  try {
    await page.getByRole('button', { name: `Products: ${NAME}` }).click()
    const dialog = page.getByRole('dialog', { name: "Supplier's products" })
    const add = dialog.getByRole('combobox', { name: 'Add a product' })
    await add.click()
    await page.getByRole('option').first().click()
    // The list has closed (it fades out for 200ms; axe would read it mid-fade).
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await dialog.getByRole('textbox', { name: "Supplier's item code" }).fill('E2E-1')
    await dialog.getByRole('textbox', { name: 'Cost price' }).fill('12.50')
    await dialog.getByRole('combobox', { name: 'Currency' }).selectOption('EUR')
    await expectNoAxeViolations(page, '[role="dialog"]')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText("The supplier's products were saved.")).toBeVisible()
    await page.keyboard.press('Escape')

    // Saved in the database: still there after a reload.
    await page.reload()
    await page.getByRole('button', { name: `Products: ${NAME}` }).click()
    const reopened = page.getByRole('dialog', { name: "Supplier's products" })
    await expect(reopened.getByRole('textbox', { name: "Supplier's item code" })).toHaveValue('E2E-1')
    await expect(reopened.getByRole('textbox', { name: 'Cost price' })).toHaveValue('12.5')
    await page.keyboard.press('Escape')

    await page.setViewportSize({ width: 360, height: 800 })
    expect(await overflowX(page)).toBe(0)
    await page.setViewportSize({ width: 1280, height: 900 })
  } finally {
    // Leave the dev database as it was (the product links go with the supplier).
    await page.getByRole('button', { name: `Delete ${NAME}` }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('row').filter({ hasText: NAME })).toHaveCount(0)
  }
})
