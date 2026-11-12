/**
 * CatalogPdfDialog.test.tsx — Tests for the "PDF catalog" button and dialog of the staff panel's products page
 * (/admin/products) against the fake staff API (src/test/api.ts): the default layout (3 per page), the slider and the
 * switches, "Generate now" sending the options and showing the build with its files, a running build (polled until it
 * ends), a failed one, a load failure and the Hebrew texts.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { catalogPdfGrid, CATALOG_PDF_POLL_MS } from '@/components/CatalogPdfDialog'
import { fakeFetch, setFakeCatalogPdf, TEST_STAFF } from '@/test/api'
import { renderPage } from '@/test/utils'

/**
 * Opens the PDF catalog dialog of the products page and waits for its state to load.
 * @param user - The user-event instance.
 * @returns The dialog.
 */
async function openDialog(user: Awaited<ReturnType<typeof renderPage>>['user']) {
  await user.click(screen.getByRole('button', { name: 'PDF catalog' }))
  const dialog = await screen.findByRole('dialog', { name: 'PDF catalog' })
  await within(dialog).findByRole('slider', { name: 'Products per page' })
  return dialog
}

describe('catalogPdfGrid', () => {
  it('lays a page out like the server', () => {
    expect([1, 3, 4, 5, 8, 9, 12].map(catalogPdfGrid)).toEqual([
      { columns: 1, rows: 1 },
      { columns: 3, rows: 1 },
      { columns: 4, rows: 1 },
      { columns: 3, rows: 2 },
      { columns: 4, rows: 2 },
      { columns: 3, rows: 3 },
      { columns: 4, rows: 3 },
    ])
  })
})

describe('/admin/products PDF catalog', () => {
  it('opens with the default layout and no catalog yet', async () => {
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    const dialog = await openDialog(user)

    const slider = within(dialog).getByRole('slider', { name: 'Products per page' })
    expect(slider).toHaveAttribute('aria-valuenow', '3')
    expect(slider).toHaveAttribute('aria-valuemin', '1')
    expect(slider).toHaveAttribute('aria-valuemax', '12')
    expect(slider).toHaveAttribute('aria-valuetext', '3 per page (3 × 1)')
    expect(within(dialog).getByRole('switch', { name: 'A title page before each category' })).toBeChecked()
    expect(within(dialog).getByRole('switch', { name: 'Rebuild automatically when products change' })).toBeChecked()
    for (const name of ['Show the brand', 'Show the item code', 'Show the barcode']) expect(within(dialog).getByRole('switch', { name })).not.toBeChecked()
    expect(within(dialog).getByText(/Not generated yet/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('link')).not.toBeInTheDocument()
  })

  it('generates the catalog with the chosen options and shows the build and its files', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch)
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    const dialog = await openDialog(user)

    const slider = within(dialog).getByRole('slider', { name: 'Products per page' })
    slider.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuetext', '6 per page (3 × 2)')
    await user.click(within(dialog).getByRole('switch', { name: 'Show the item code' }))
    await user.click(within(dialog).getByRole('switch', { name: 'A title page before each category' }))
    await user.click(within(dialog).getByRole('button', { name: 'Generate now' }))

    await waitFor(() => expect(within(dialog).getByText(/^Built .*: 408 products, 70 pages\.$/)).toBeInTheDocument())
    const post = fetchSpy.mock.calls.find(([url, init]) => String(url).endsWith('/api/staff/catalog-pdf') && init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      options: { perPage: 6, categoryPages: false, showBrand: false, showSku: true, showBarcode: false, autoRebuild: true },
    })
    expect(await screen.findByText('The PDF catalog is ready')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Download: English' })).toHaveAttribute('href', '/api/media/catalog/ultrapet-catalog-en-test.pdf')
    expect(within(dialog).getByRole('link', { name: 'Download: עברית' })).toHaveAttribute('target', '_blank')
  })

  it('waits for a running build and shows it when it ends', { timeout: 15000 }, async () => {
    setFakeCatalogPdf({ status: { state: 'building', startedAt: new Date().toISOString() } })
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    const dialog = await openDialog(user)
    expect(within(dialog).getByText(/Building the catalog/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Building…' })).toBeDisabled()

    // The dialog asks again after CATALOG_PDF_POLL_MS (real time).
    setFakeCatalogPdf({ status: { state: 'ready', builtAt: '2026-11-12T10:00:00+00:00', products: 12, pages: 9 }, urls: { he: '/api/media/catalog/he.pdf' } })
    await waitFor(() => expect(within(dialog).getByText(/12 products, 9 pages\./)).toBeInTheDocument(), { timeout: CATALOG_PDF_POLL_MS + 3000 })
    expect(within(dialog).getByRole('button', { name: 'Generate now' })).toBeEnabled()
    expect(within(dialog).getAllByRole('link')).toHaveLength(1)
    // Only a build asked for in this dialog is confirmed in a toast.
    expect(screen.queryByText('The PDF catalog is ready')).not.toBeInTheDocument()
  })

  it('says when the last build failed', async () => {
    setFakeCatalogPdf({ status: { state: 'failed', builtAt: '2026-11-12T10:00:00+00:00', products: 12, pages: 9, error: 'no ink' } })
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    const dialog = await openDialog(user)
    expect(within(dialog).getByRole('alert')).toHaveTextContent('The last build failed.')
    expect(within(dialog).getByRole('button', { name: 'Generate now' })).toBeEnabled()
  })

  it('says when the settings cannot be loaded', async () => {
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      String(input).endsWith('/api/staff/catalog-pdf') ? Promise.resolve(new Response('{"error":"server_error"}', { status: 500 })) : fakeFetch(input, init),
    )
    await user.click(screen.getByRole('button', { name: 'PDF catalog' }))
    const dialog = await screen.findByRole('dialog', { name: 'PDF catalog' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('could not be loaded')
    expect(within(dialog).queryByRole('button', { name: 'Generate now' })).not.toBeInTheDocument()
  })

  it('is in Hebrew on the Hebrew site', async () => {
    const { user } = await renderPage('/admin/products', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'קטלוג PDF' }))
    const dialog = await screen.findByRole('dialog', { name: 'קטלוג PDF' })
    expect(await within(dialog).findByRole('slider', { name: 'מוצרים בעמוד' })).toHaveAttribute('aria-valuetext', '3 בעמוד (3 × 1)')
    expect(within(dialog).getByRole('button', { name: 'יצירה עכשיו' })).toBeInTheDocument()
  })
})
