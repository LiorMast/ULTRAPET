/**
 * StockDialog.test.tsx — Tests for the stock of the staff panel's products page (/admin/products: the stock column, the
 * stock alerts above the table, the "Stock" row action and its StockDialog) against the fake staff API
 * (src/test/api.ts): an untracked product starts with a count, goods received / removed change the units on hand,
 * removing more than is on hand and a bad number are refused next to the box, the history lists each movement, the
 * low-stock threshold is set in the product form, and the Hebrew texts.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import products from '@/stubs/products.json'
import { fakeFetch, setFakeStock, TEST_STAFF } from '@/test/api'
import { renderPage } from '@/test/utils'

/** The first two products of the table (the fake's staff order is the stub order). */
const [first, second] = products

/** The id the fake gives the first product (seeded rows have fixed ids). */
const FIRST_PRODUCT_ID = '00000000-0000-4000-8002-000000000001'

/** The stock column: name, SKU, category, brand, list price, then the stock. */
const STOCK_CELL = 5

/**
 * The table row of a product.
 * @param name - The product's English name, as in its first cell.
 * @returns The row.
 */
const rowOf = (name: string) => screen.getAllByRole('row').find((row) => within(row).queryAllByRole('cell')[0]?.textContent === name)!

/**
 * Opens the Stock dialog of a product and waits for its stock to load.
 * @param user - The user-event instance.
 * @param name - The product's English name.
 * @returns The dialog.
 */
async function openStock(user: Awaited<ReturnType<typeof renderPage>>['user'], name: string) {
  await user.click(screen.getByRole('button', { name: `Stock: ${name}` }))
  const dialog = await screen.findByRole('dialog', { name: 'Stock' })
  await within(dialog).findByRole('group', { name: 'Movement' })
  return dialog
}

describe('/admin/products stock', () => {
  it('shows "Not counted" for products whose stock is not tracked, and no stock alerts', async () => {
    await renderPage('/en/admin/products', { staff: TEST_STAFF })
    expect(within(rowOf(first.name.en)).getAllByRole('cell')[STOCK_CELL]).toHaveTextContent('Not counted')
    expect(screen.queryByText('Stock alerts')).not.toBeInTheDocument()
  })

  it('starts tracking an untracked product with a stock count, and lists it in the history', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch)
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    const dialog = await openStock(user, first.name.en)

    expect(within(dialog).getByText(first.name.en)).toBeInTheDocument()
    expect(within(dialog).getByText(/so it can be ordered without limit\. Start with a stock count\./)).toBeInTheDocument()
    expect(within(dialog).getByText('No stock movements yet.')).toBeInTheDocument()
    // Only a count can start tracking a product.
    expect(within(dialog).getByRole('radio', { name: 'Count' })).toBeChecked()
    for (const kind of ['Received', 'Returned', 'Removed']) expect(within(dialog).getByRole('radio', { name: kind })).toBeDisabled()

    const box = within(dialog).getByRole('textbox', { name: 'Units counted *' })
    await user.type(box, '10')
    expect(box).toHaveAccessibleDescription('After recording: 10 on hand.')
    await user.type(within(dialog).getByRole('textbox', { name: 'Note' }), ' First count ')
    await user.click(within(dialog).getByRole('button', { name: 'Record' }))

    expect(await screen.findByText('Stock updated.')).toBeInTheDocument()
    const sent = fetchSpy.mock.calls.find(([url, init]) => String(url).endsWith('/stock') && init?.method === 'POST')!
    expect(String(sent[0])).toBe(`/api/staff/products/${FIRST_PRODUCT_ID}/stock`)
    expect(JSON.parse(String(sent[1]?.body))).toEqual({ kind: 'count', quantity: 10, note: 'First count' })

    expect(within(dialog).getByText('In stock')).toBeInTheDocument()
    expect(box).toHaveValue('')
    const history = within(dialog).getByRole('list')
    const [line] = within(history).getAllByRole('listitem')
    expect(line).toHaveTextContent(/Count\s*\+10/)
    expect(line).toHaveTextContent('On hand: 10')
    expect(line).toHaveTextContent(/by Test Admin · First count/)
    // Tracked now: every kind is offered.
    expect(within(dialog).getByRole('radio', { name: 'Received' })).toBeEnabled()

    await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(rowOf(first.name.en)).getAllByRole('cell')[STOCK_CELL]).toHaveTextContent('10')
    expect(screen.getByRole('button', { name: `Stock: ${first.name.en}` })).toHaveFocus()
  })

  it('adds received goods, takes removed units out, and refuses removing more than is on hand', async () => {
    await setFakeStock(first.id, 12)
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    const dialog = await openStock(user, first.name.en)

    // A tracked product opens on "Received".
    expect(within(dialog).getByRole('radio', { name: 'Received' })).toBeChecked()
    const received = within(dialog).getByRole('textbox', { name: 'Units received *' })
    await user.type(received, '5')
    expect(received).toHaveAccessibleDescription('After recording: 17 on hand (now 12).')
    await user.click(within(dialog).getByRole('button', { name: 'Record' }))
    await screen.findByText('Stock updated.')
    expect(within(within(dialog).getByRole('list')).getAllByRole('listitem')[0]).toHaveTextContent(/Received\s*\+5/)

    await user.click(within(dialog).getByRole('radio', { name: 'Removed' }))
    const removed = within(dialog).getByRole('textbox', { name: 'Units removed *' })
    await user.type(removed, '20')
    await user.click(within(dialog).getByRole('button', { name: 'Record' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('You cannot remove more than is on hand (17).')
    expect(removed).toHaveAttribute('aria-invalid', 'true')
    expect(removed).toHaveFocus()

    await user.clear(removed)
    await user.type(removed, '17')
    await user.click(within(dialog).getByRole('button', { name: 'Record' }))
    await waitFor(() => expect(within(dialog).getByText('Out of stock')).toBeInTheDocument())
    expect(within(within(dialog).getByRole('list')).getAllByRole('listitem')[0]).toHaveTextContent(/Removed\s*−17/)
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('refuses a quantity that is not a whole number, without sending it', async () => {
    await setFakeStock(first.id, 3)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch)
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    const dialog = await openStock(user, first.name.en)
    await user.type(within(dialog).getByRole('textbox', { name: 'Units received *' }), '2.5')
    await user.click(within(dialog).getByRole('button', { name: 'Record' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a whole number of 1 or more.')
    expect(fetchSpy.mock.calls.some(([url, init]) => String(url).endsWith('/stock') && init?.method === 'POST')).toBe(false)
  })

  it('marks products low and out of stock, and counts them above the table', async () => {
    await setFakeStock(first.id, 0)
    await setFakeStock(second.id, 3, 5)
    await renderPage('/en/admin/products', { staff: TEST_STAFF })
    expect(within(rowOf(first.name.en)).getAllByRole('cell')[STOCK_CELL]).toHaveTextContent(/^0\s*Out of stock$/)
    expect(within(rowOf(second.name.en)).getAllByRole('cell')[STOCK_CELL]).toHaveTextContent(/^3\s*Low stock$/)
    const alerts = screen.getByText('Stock alerts').parentElement!
    expect(alerts).toHaveTextContent('1 out of stock')
    expect(alerts).toHaveTextContent('1 low in stock')
  })

  it('sets the low-stock threshold in the product form', async () => {
    await setFakeStock(first.id, 4)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch)
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Edit ${first.name.en}` }))
    const form = await screen.findByRole('dialog', { name: `Edit ${first.name.en}` })
    // The units on hand are never edited in the form.
    expect(within(form).queryByLabelText(/^Stock/)).not.toBeInTheDocument()
    await user.type(within(form).getByRole('spinbutton', { name: 'Low-stock alert' }), '5')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const patch = fetchSpy.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(String(patch[1]?.body))).toEqual({ lowStockThreshold: 5 })
    expect(within(rowOf(first.name.en)).getAllByRole('cell')[STOCK_CELL]).toHaveTextContent(/^4\s*Low stock$/)
  })

  it('speaks Hebrew', async () => {
    const { user } = await renderPage('/admin/products', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `מלאי: ${first.name.he}` }))
    const dialog = await screen.findByRole('dialog', { name: 'מלאי' })
    expect(await within(dialog).findByRole('radio', { name: 'ספירה' })).toBeChecked()
    expect(within(dialog).getByRole('textbox', { name: 'כמות שנספרה *' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'רישום' })).toBeInTheDocument()
  })
})
