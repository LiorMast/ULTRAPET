/**
 * catalog-pdf.spec.ts — End-to-end checks of the generated PDF catalog in real Chromium against the real backend:
 * the "PDF catalog" dialog of the staff panel's products page (CatalogPdfDialog: the products-per-page slider moved
 * with the keyboard, the switches, "Generate now" sending the chosen options, the finished build with its files, no
 * axe violations, no horizontal overflow on a phone) and the public download links, which ask for the page's language.
 *
 * "Generate now" (POST /api/staff/catalog-pdf) is answered in the browser, and the reads that follow are answered
 * from that answer, so the test never starts a real build (about a minute of work) and never changes the catalog
 * the shared dev database serves. Signs in as the seed staff admin (signInStaff).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signInStaff } from './utils.ts'

/** The state the browser answers after "Generate now". */
const BUILT = {
  status: { state: 'ready', builtAt: '2026-11-12T10:00:00+00:00', products: 408, pages: 70, error: null },
  urls: { he: '/api/media/catalog/ultrapet-catalog-he-test.pdf', en: '/api/media/catalog/ultrapet-catalog-en-test.pdf' },
}

/**
 * Answers the dialog's requests in the browser: a POST is recorded and answered as a finished build with the sent
 * options, and every later GET answers the same; a GET before that reads a never-built catalog with the defaults.
 * @param page - The page.
 * @returns The bodies of the POSTs, in order.
 */
async function keepBuildsInBrowser(page: Page): Promise<unknown[]> {
  const posts: unknown[] = []
  let state: unknown = {
    options: { perPage: 3, categoryPages: true, showBrand: false, showSku: false, showBarcode: false, autoRebuild: true },
    status: { state: 'none' },
    urls: {},
  }
  await page.route('**/api/staff/catalog-pdf', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { options: Record<string, unknown> }
      posts.push(body)
      state = { options: body.options, ...BUILT }
      await route.fulfill({ status: 202, json: state })
    } else {
      await route.fulfill({ json: state })
    }
  })
  return posts
}

test.describe('PDF catalog', () => {
  test('staff set the layout with the keyboard and generate the catalog', async ({ page }) => {
    const posts = await keepBuildsInBrowser(page)
    await signInStaff(page, '/en/admin/products')
    await page.getByRole('button', { name: 'PDF catalog' }).click()
    const dialog = page.getByRole('dialog', { name: 'PDF catalog' })
    const slider = dialog.getByRole('slider', { name: 'Products per page' })
    await expect(slider).toHaveAttribute('aria-valuenow', '3')
    await expect(dialog.getByText(/Not generated yet/)).toBeVisible()

    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveAttribute('aria-valuetext', '6 per page (3 × 2)')
    await dialog.getByRole('switch', { name: 'Show the item code' }).press('Space')
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([])

    await dialog.getByRole('button', { name: 'Generate now' }).click()
    await expect(dialog.getByText(/408 products, 70 pages\./)).toBeVisible()
    expect(posts).toEqual([{ options: { perPage: 6, categoryPages: true, showBrand: false, showSku: true, showBarcode: false, autoRebuild: true } }])
    await expect(dialog.getByRole('link', { name: 'Download: English' })).toHaveAttribute('href', BUILT.urls.en)
    await expect(page.getByText('The PDF catalog is ready')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: 'PDF catalog' })).toBeFocused()
  })

  test('the dialog fits a phone without horizontal overflow', async ({ page }) => {
    await keepBuildsInBrowser(page)
    await page.setViewportSize({ width: 360, height: 740 })
    await signInStaff(page, '/admin/products')
    await page.getByRole('button', { name: 'קטלוג PDF' }).click()
    await expect(page.getByRole('dialog', { name: 'קטלוג PDF' }).getByRole('slider', { name: 'מוצרים בעמוד' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('the download links ask for the catalog in the page language', async ({ page }) => {
    await page.goto('/en/catalog')
    await expect(page.getByRole('link', { name: /PDF/ }).first()).toHaveAttribute('href', '/api/catalog.pdf?lang=en')
    await page.goto('/catalog')
    await expect(page.getByRole('link', { name: /PDF/ }).first()).toHaveAttribute('href', '/api/catalog.pdf?lang=he')
  })

  test('the public download redirects to a stored PDF', async ({ request }) => {
    const response = await request.get('/api/catalog.pdf?lang=en', { maxRedirects: 0 })
    expect(response.status()).toBe(302)
    expect(response.headers().location).toMatch(/\/catalog\/[\w-]+\.pdf$/)
  })
})
