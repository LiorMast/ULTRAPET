/**
 * AdminSuppliers.test.tsx — Tests for the staff panel's suppliers page (/admin/suppliers, routes/admin.suppliers.tsx)
 * and its products dialog (SupplierProductsDialog) against the fake staff API (src/test/api.ts): the menu link and the
 * table (countries named in the page language), adding a supplier (country picked by typing, what is sent), a taken
 * name, deleting one, the products dialog (link a product with its code, cost and currency; the saved list on reopening;
 * removing a line; a wrong cost refused in the form and by the server; the busy Save), the sign-in form when signed
 * out, and the Hebrew texts.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { saveSupplierProducts } from '@/api'
import products from '@/stubs/products.json'
import { fakeFetch, holdRequests, signInFakeUser, STAFF_SUPPLIERS, TEST_STAFF } from '@/test/api'
import { renderPage } from '@/test/utils'

/** The fake's two suppliers: an active one in Spain and an inactive one. */
const [AGROVET, OLD] = STAFF_SUPPLIERS

/** The ids the fake gives the first two products (seeded rows have fixed ids). */
const PRODUCT_IDS = ['00000000-0000-4000-8002-000000000001', '00000000-0000-4000-8002-000000000002']

/** The first two products' English names, as the dialog shows them. */
const PRODUCT_NAMES = [products[0].name.en, products[1].name.en]

/**
 * The request bodies sent to a path with a method.
 * @param spy - The fetch spy.
 * @param method - E.g. "PUT".
 * @param path - E.g. "/api/staff/suppliers" (a longer path starts with it).
 * @returns The parsed bodies, oldest first.
 */
const bodies = (spy: { mock: { calls: [RequestInfo | URL, RequestInit?][] } }, method: string, path: string) =>
  spy.mock.calls.filter(([url, init]) => init?.method === method && String(url).startsWith(path)).map(([, init]) => JSON.parse(String(init?.body)) as unknown)

/**
 * The table's rows (without the header), each as the text of its cells.
 * @param caption - The table's name in the page language.
 * @returns The cells' texts per row, in the table's order.
 */
const tableCells = (caption = 'Suppliers') =>
  within(screen.getByRole('table', { name: caption }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))

/**
 * Opens the products dialog of a supplier and waits for its lines.
 * @param user - The test's user-event instance.
 * @param name - The supplier's name.
 * @returns The dialog.
 */
async function openProducts(user: Awaited<ReturnType<typeof renderPage>>['user'], name = AGROVET.name) {
  await user.click(screen.getByRole('button', { name: `Products: ${name}` }))
  const dialog = await screen.findByRole('dialog', { name: "Supplier's products" })
  await within(dialog).findByRole('combobox', { name: 'Add a product' })
  return dialog
}

// The page loads the 400-product list (the dialog's choices), which renders slowly when the whole suite runs at once.
describe('/admin/suppliers', { timeout: 20_000 }, () => {
  it('lists every supplier, active or not, with the country named, in the admin menu', async () => {
    await renderPage('/en/admin/suppliers', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'Suppliers' })).toBeInTheDocument()
    const menu = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(menu).getByRole('link', { name: 'Suppliers' })).toHaveAttribute('aria-current', 'page')
    expect(tableCells().map((cells) => cells.slice(0, 5))).toEqual([
      [AGROVET.name, 'Spain', AGROVET.contactName, AGROVET.email, AGROVET.phone],
      [OLD.name, '—', '—', '—', '—'],
    ])
    expect(screen.getByRole('button', { name: `Products: ${OLD.name}` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Delete ${OLD.name}` })).toBeInTheDocument()
  })

  it('adds a supplier with a country picked by typing its name', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/suppliers', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const form = await screen.findByRole('dialog', { name: 'New record' })
    await user.type(within(form).getByLabelText('Company name *'), 'Bewital')
    await user.type(within(form).getByRole('combobox', { name: 'Country' }), 'Germ')
    await user.click(await screen.findByRole('option', { name: 'Germany' }))
    await user.type(within(form).getByLabelText('Email'), 'Sales@Bewital.example')
    await user.type(within(form).getByLabelText('Notes'), 'Pays in 60 days')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(bodies(fetchSpy, 'POST', '/api/staff/suppliers')).toEqual([
      { name: 'Bewital', country: 'DE', email: 'Sales@Bewital.example', notes: 'Pays in 60 days', isActive: true },
    ])
    // The server lowercases the email; the table lists the suppliers by name.
    expect(tableCells().map((cells) => cells.slice(0, 4))).toEqual([
      [AGROVET.name, 'Spain', AGROVET.contactName, AGROVET.email],
      ['Bewital', 'Germany', '—', 'sales@bewital.example'],
      [OLD.name, '—', '—', '—'],
    ])
  })

  it('refuses a name another supplier has', async () => {
    const { user } = await renderPage('/en/admin/suppliers', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const form = await screen.findByRole('dialog', { name: 'New record' })
    const name = within(form).getByLabelText('Company name *')
    await user.type(name, AGROVET.name)
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(name).toHaveAccessibleDescription(/Another record already has this value/))
    expect(name).toHaveFocus()
  })

  it('deletes a supplier', async () => {
    const { user } = await renderPage('/en/admin/suppliers', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Delete ${OLD.name}` }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(tableCells()).toHaveLength(1))
    expect(tableCells()[0][0]).toBe(AGROVET.name)
  })

  it("links products to a supplier with the supplier's code, the cost and its currency", async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/suppliers', { staff: TEST_STAFF })
    let dialog = await openProducts(user)
    expect(dialog).toHaveTextContent(AGROVET.name)
    expect(dialog).toHaveTextContent('No products are linked to this supplier yet.')

    const add = within(dialog).getByRole('combobox', { name: 'Add a product' })
    await user.type(add, PRODUCT_NAMES[0])
    await user.click(await screen.findByRole('option', { name: new RegExp(`^${PRODUCT_NAMES[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }))
    // The new line's first box gets the focus; the add field is empty again for the next product.
    const code = within(dialog).getByRole('textbox', { name: "Supplier's item code" })
    expect(code).toHaveFocus()
    expect(add).toHaveValue('')
    await user.type(code, 'AG-100')
    await user.type(within(dialog).getByRole('textbox', { name: 'Cost price' }), '12,5')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Currency' }), 'EUR')
    expect(within(dialog).getByRole('heading', { name: '1 products' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText("The supplier's products were saved.")).toBeInTheDocument()
    expect(bodies(fetchSpy, 'PUT', `/api/staff/suppliers/${AGROVET.id}/products`)).toEqual([
      [{ productId: PRODUCT_IDS[0], supplierSku: 'AG-100', costPrice: '12.5', costCurrency: 'EUR' }],
    ])

    // Reopened, the dialog shows the saved line.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    dialog = await openProducts(user)
    expect(within(dialog).getByText(PRODUCT_NAMES[0])).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: "Supplier's item code" })).toHaveValue('AG-100')
    expect(within(dialog).getByRole('textbox', { name: 'Cost price' })).toHaveValue('12.5')
    expect(within(dialog).getByRole('combobox', { name: 'Currency' })).toHaveValue('EUR')
  })

  it('removes a line and saves the list without it', async () => {
    signInFakeUser(TEST_STAFF)
    await saveSupplierProducts(AGROVET.id, [{ productId: PRODUCT_IDS[0] }, { productId: PRODUCT_IDS[1], costPrice: 3 }])
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/suppliers', { staff: TEST_STAFF })
    const dialog = await openProducts(user)
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(2)
    await user.click(within(dialog).getByRole('button', { name: `Remove: ${PRODUCT_NAMES[0]}` }))
    // The focus moves to the next line.
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1)
    expect(within(dialog).getByRole('textbox', { name: "Supplier's item code" })).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(bodies(fetchSpy, 'PUT', `/api/staff/suppliers/${AGROVET.id}/products`)).toEqual([
        [{ productId: PRODUCT_IDS[1], supplierSku: null, costPrice: '3', costCurrency: 'ILS' }],
      ]),
    )
    // Removing the last line focuses the add field.
    await user.click(within(dialog).getByRole('button', { name: `Remove: ${PRODUCT_NAMES[1]}` }))
    expect(within(dialog).getByRole('combobox', { name: 'Add a product' })).toHaveFocus()
  })

  it('refuses a cost that is not a number, next to its box, and sends nothing', async () => {
    signInFakeUser(TEST_STAFF)
    await saveSupplierProducts(AGROVET.id, [{ productId: PRODUCT_IDS[0] }])
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/suppliers', { staff: TEST_STAFF })
    const dialog = await openProducts(user)
    const cost = within(dialog).getByRole('textbox', { name: 'Cost price' })
    await user.type(cost, '-4')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('The cost price must be a number, 0 or more.')
    expect(cost).toHaveFocus()
    expect(cost).toHaveAttribute('aria-invalid', 'true')
    expect(bodies(fetchSpy, 'PUT', '/api/staff/suppliers')).toEqual([])
    // Typing clears the error.
    await user.clear(cost)
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the server refusing a line next to its box', async () => {
    signInFakeUser(TEST_STAFF)
    await saveSupplierProducts(AGROVET.id, [{ productId: PRODUCT_IDS[0], costCurrency: 'JPY' }])
    const { user } = await renderPage('/en/admin/suppliers', { staff: TEST_STAFF })
    const dialog = await openProducts(user)
    // A stored currency outside the offered ones stays a choice.
    expect(within(dialog).getByRole('combobox', { name: 'Currency' })).toHaveValue('JPY')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init = {}) =>
      init.method === 'PUT'
        ? Promise.resolve(new Response(JSON.stringify({ error: 'invalid', field: 'costCurrency', index: 0 }), { status: 400, headers: { 'Content-Type': 'application/json' } }))
        : fakeFetch(input, init),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Invalid')
    expect(within(dialog).getByRole('combobox', { name: 'Currency' })).toHaveFocus()
  })

  it('shows Save busy while the server saves, and sends one request however often it is clicked', async () => {
    const held = holdRequests((path, method) => method === 'PUT' && path.startsWith('/api/staff/suppliers/'))
    const { user } = await renderPage('/en/admin/suppliers', { staff: TEST_STAFF })
    const dialog = await openProducts(user)
    const save = within(dialog).getByRole('button', { name: 'Save' })
    await user.click(save)
    await waitFor(() => expect(held.calls).toHaveLength(1))
    expect(save).toHaveAttribute('aria-busy', 'true')
    await user.click(save)
    expect(held.calls).toHaveLength(1)
    held.release()
    await waitFor(() => expect(save).not.toHaveAttribute('aria-busy', 'true'))
    expect(held.calls).toHaveLength(1)
  })

  it('shows the sign-in form when signed out', async () => {
    await renderPage('/en/admin/suppliers')
    expect(screen.getByRole('heading', { name: 'Staff sign-in' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('is in Hebrew on the Hebrew page, with the countries named in Hebrew', async () => {
    await renderPage('/admin/suppliers', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'ספקים' })).toBeInTheDocument()
    expect(tableCells('ספקים')[0][1]).toBe('ספרד')
    expect(screen.getByRole('button', { name: `מוצרים: ${AGROVET.name}` })).toBeInTheDocument()
  })
})
