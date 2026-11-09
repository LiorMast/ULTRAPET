/**
 * AdminDiscounts.test.tsx — Tests for the staff panel's Discounts page (/admin/discounts, routes/admin.discounts.tsx)
 * against the fake staff API (src/test/api.ts): the menu link, the table of every discount (general and for one
 * customer, with its state), adding a discount for all customers or one customer through DiscountDialog's "applies
 * to" fields (what is sent, the required choices), a discount on all products (always for one customer), editing
 * one (moving it to a product), ending one now, deleting one, a fixed price
 * (listed, deletable, not editable), the sign-in form when signed out, and the Hebrew texts.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createStaffRow } from '@/api'
import { israelNow, israelToday } from '@/components/DiscountDialog'
import categories from '@/stubs/product-categories.json'
import products from '@/stubs/products.json'
import { fakeFetch, signInFakeUser, STAFF_CUSTOMERS, TEST_STAFF } from '@/test/api'
import { renderPage } from '@/test/utils'

/** The ids the fake gives the first category and the first product (seeded rows have fixed ids). */
const CATEGORY_ID = '00000000-0000-4000-8001-000000000001'
const PRODUCT_ID = '00000000-0000-4000-8002-000000000001'

/** The test customer the fake lists first. */
const CUSTOMER = STAFF_CUSTOMERS[0]

/** The first category's and product's English names, as the "applies to" column shows them. */
const CATEGORY = `Category: ${categories[0].name.en}`
const PRODUCT = `Product: ${products[0].name.en}`

/**
 * Shifts today's Israel date by some days.
 * @param days - Days to add (negative = earlier).
 * @returns The date, e.g. "2026-11-03".
 */
function dayFromToday(days: number): string {
  const date = new Date(`${israelToday()}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Stores price rules in the fake API before the page loads.
 * @param rules - The rules' fields (as the staff API takes them).
 * @returns Resolves when stored.
 */
async function seedRules(...rules: Record<string, unknown>[]) {
  signInFakeUser(TEST_STAFF)
  for (const rule of rules) await createStaffRow('price-rules', rule)
}

/**
 * The table's rows (without the header), each as the text of its cells.
 * @param caption - The table's name in the page language.
 * @returns The cells' texts per row, in the table's order.
 */
const tableCells = (caption = 'Discounts') =>
  within(screen.getByRole('table', { name: caption }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))

/**
 * The request bodies sent with a method.
 * @param spy - The fetch spy.
 * @param method - E.g. "POST".
 * @returns The parsed bodies, oldest first.
 */
const bodies = (spy: { mock: { calls: [RequestInfo | URL, RequestInit?][] } }, method: string) =>
  spy.mock.calls.filter(([, init]) => init?.method === method).map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>)

// The page loads the 400-product list, which renders slowly when the whole suite runs at once.
describe('/admin/discounts', { timeout: 15_000 }, () => {
  it('lists every discount with its customers and state, active ones first', async () => {
    await seedRules(
      { categoryId: CATEGORY_ID, kind: 'percent', value: 10, startsAt: `${dayFromToday(-30)}T00:00:00`, endsAt: `${dayFromToday(-1)}T23:59:00` },
      { productId: PRODUCT_ID, businessUserId: CUSTOMER.id, kind: 'amount', value: 5, startsAt: `${dayFromToday(-1)}T00:00:00`, endsAt: null },
      { categoryId: CATEGORY_ID, kind: 'percent', value: 3, minQuantity: 12, startsAt: `${dayFromToday(2)}T00:00:00`, endsAt: null },
    )
    await renderPage('/en/admin/discounts', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'Discounts' })).toBeInTheDocument()
    const menu = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(menu).getByRole('link', { name: 'Discounts' })).toHaveAttribute('aria-current', 'page')
    const rows = tableCells()
    expect(rows.map((cells) => cells.slice(0, 3))).toEqual([
      [PRODUCT, CUSTOMER.companyName, '⁦₪5.00⁩ off'],
      [CATEGORY, 'All customers', '⁦3%⁩ off for ⁦12⁩ units or more'],
      [CATEGORY, 'All customers', '⁦10%⁩ off'],
    ])
    expect(rows.map((cells) => cells[4])).toEqual(['No end date', 'No end date', expect.any(String)])
    expect(rows.map((cells) => cells[5])).toEqual(['Active', 'Upcoming', 'Ended'])
  })

  it('adds a category discount for every customer', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/discounts', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const form = await screen.findByRole('dialog', { name: 'New discount' })

    // Both the target and the value are required.
    expect(within(form).getByRole('switch', { name: 'Global discount' })).not.toBeChecked()
    expect(within(form).getByRole('radio', { name: 'Category' })).toBeChecked()
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    const target = within(form).getByRole('combobox', { name: 'Category *' })
    expect(target).toHaveFocus()
    expect(target).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById(target.getAttribute('aria-describedby')!.split(' ')[1])).toHaveTextContent('Required')

    await user.type(target, categories[0].name.en)
    const list = screen.getByRole('listbox', { name: 'Category' })
    expect(within(list).getAllByRole('option')[0]).toHaveTextContent(CATEGORY)
    // Only categories are listed.
    for (const option of within(list).getAllByRole('option')) expect(option).toHaveTextContent(/^Category: /)
    await user.keyboard('{Enter}')
    expect(target).toHaveValue(CATEGORY)
    await user.type(within(form).getByLabelText('Value *'), '10')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'POST')).toEqual([
      { categoryId: CATEGORY_ID, productId: null, businessUserId: null, kind: 'percent', value: 10, minQuantity: null, startsAt: `${israelToday()}T00:00:00`, endsAt: null },
    ])
    expect(await screen.findByRole('cell', { name: CATEGORY })).toBeInTheDocument()
    expect(tableCells()[0].slice(1, 6)).toEqual(['All customers', '⁦10%⁩ off', expect.any(String), 'No end date', 'Active'])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus())
  })

  it('adds a product discount for one customer', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/discounts', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const form = await screen.findByRole('dialog', { name: 'New discount' })
    await user.click(within(form).getByRole('radio', { name: 'Product' }))
    await user.type(within(form).getByRole('combobox', { name: 'Product *' }), products[0].name.en)
    await user.click(within(screen.getByRole('listbox', { name: 'Product' })).getByRole('option', { name: new RegExp(PRODUCT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }))
    await user.click(within(form).getByRole('radio', { name: 'One customer' }))
    await user.click(within(form).getByRole('radio', { name: 'Amount (₪)' }))
    await user.type(within(form).getByLabelText('Value *'), '20')

    // One customer means a customer must be chosen.
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    const customer = within(form).getByRole('combobox', { name: 'Customer *' })
    expect(customer).toHaveFocus()
    expect(customer).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById(customer.getAttribute('aria-describedby')!)).toHaveTextContent('Required')
    await user.type(customer, 'demo')
    await user.keyboard('{Enter}')
    expect(customer).toHaveValue(CUSTOMER.companyName)
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'POST')).toEqual([
      { categoryId: null, productId: PRODUCT_ID, businessUserId: CUSTOMER.id, kind: 'amount', value: 20, minQuantity: null, startsAt: `${israelToday()}T00:00:00`, endsAt: null },
    ])
    expect((await screen.findByRole('cell', { name: PRODUCT })).closest('tr')).toHaveTextContent(CUSTOMER.companyName)
  })

  it("adds a customer's discount on all products, which always asks for the customer", async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/discounts', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const form = await screen.findByRole('dialog', { name: 'New discount' })
    await user.click(within(form).getByRole('switch', { name: 'Global discount' }))
    // No category or product to choose, and no "All customers": the customer is asked at once.
    expect(within(form).queryByRole('radio', { name: 'Category' })).not.toBeInTheDocument()
    expect(within(form).queryByRole('combobox', { name: 'Category *' })).not.toBeInTheDocument()
    expect(within(form).queryByRole('radio', { name: 'All customers' })).not.toBeInTheDocument()
    await user.type(within(form).getByLabelText('Value *'), '5')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    const customer = within(form).getByRole('combobox', { name: 'Customer *' })
    expect(customer).toHaveFocus()
    await user.type(customer, 'demo')
    await user.keyboard('{Enter}')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'POST')).toEqual([
      { categoryId: null, productId: null, businessUserId: CUSTOMER.id, kind: 'percent', value: 5, minQuantity: null, startsAt: `${israelToday()}T00:00:00`, endsAt: null },
    ])
    await waitFor(() => expect(tableCells()[0].slice(0, 3)).toEqual(['All products', CUSTOMER.companyName, '⁦5%⁩ off']))

    // Editing it keeps "All products" and its customer.
    await user.click(screen.getByRole('button', { name: `Edit All products, ${CUSTOMER.companyName}: ⁦5%⁩ off` }))
    const edit = await screen.findByRole('dialog', { name: 'Edit discount' })
    expect(within(edit).getByRole('switch', { name: 'Global discount' })).toBeChecked()
    expect(within(edit).getByRole('combobox', { name: 'Customer *' })).toHaveValue(CUSTOMER.companyName)
  })

  it('ends a discount now', async () => {
    await seedRules({ categoryId: CATEGORY_ID, kind: 'percent', value: 10, startsAt: `${dayFromToday(-7)}T00:00:00`, endsAt: null })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/discounts', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Edit ${CATEGORY}, All customers: ⁦10%⁩ off` }))
    const form = await screen.findByRole('dialog', { name: 'Edit discount' })
    const before = israelNow()
    await user.click(within(form).getByRole('button', { name: 'End discount now' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const [body] = bodies(fetchSpy, 'PATCH')
    expect(body).toEqual({ categoryId: CATEGORY_ID, productId: null, businessUserId: null, kind: 'percent', value: 10, minQuantity: null, startsAt: `${dayFromToday(-7)}T00:00:00`, endsAt: expect.any(String) })
    // It ends at this moment, to the second.
    expect(String(body.endsAt) >= before && String(body.endsAt) <= israelNow()).toBe(true)
    await waitFor(() => expect(tableCells()[0][5]).toBe('Ended'))
  })

  it('edits a discount, moving it from a category to a product', async () => {
    await seedRules({ categoryId: CATEGORY_ID, kind: 'percent', value: 10, startsAt: `${israelToday()}T00:00:00`, endsAt: null })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/discounts', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Edit ${CATEGORY}, All customers: ⁦10%⁩ off` }))
    const form = await screen.findByRole('dialog', { name: 'Edit discount' })
    expect(within(form).getByRole('combobox', { name: 'Category *' })).toHaveValue(CATEGORY)
    expect(within(form).getByRole('radio', { name: 'All customers' })).toBeChecked()
    expect(within(form).getByLabelText('Value *')).toHaveValue('10')
    // Switching to a product clears the category.
    await user.click(within(form).getByRole('radio', { name: 'Product' }))
    const target = within(form).getByRole('combobox', { name: 'Product *' })
    expect(target).toHaveValue('')
    await user.type(target, products[0].name.en)
    await user.keyboard('{Enter}')
    await user.clear(within(form).getByLabelText('Value *'))
    await user.type(within(form).getByLabelText('Value *'), '15')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'PATCH')).toEqual([
      { categoryId: null, productId: PRODUCT_ID, businessUserId: null, kind: 'percent', value: 15, minQuantity: null, startsAt: `${israelToday()}T00:00:00`, endsAt: null },
    ])
    await waitFor(() => expect(tableCells()[0].slice(0, 3)).toEqual([PRODUCT, 'All customers', '⁦15%⁩ off']))
    expect(screen.getAllByRole('status').some((status) => status.textContent === 'Changes saved.')).toBe(true)
  })

  it('deletes a discount', async () => {
    await seedRules({ categoryId: CATEGORY_ID, kind: 'percent', value: 10, startsAt: `${israelToday()}T00:00:00`, endsAt: null })
    const { user } = await renderPage('/en/admin/discounts', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Delete ${CATEGORY}, All customers: ⁦10%⁩ off` }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('cell', { name: CATEGORY })).not.toBeInTheDocument())
    expect(await (await fakeFetch('/api/staff/price-rules')).json()).toEqual([])
  })

  it('lists a fixed price, which can be deleted but not edited here', async () => {
    await seedRules({ productId: PRODUCT_ID, businessUserId: CUSTOMER.id, kind: 'fixed_price', value: 40 })
    await renderPage('/en/admin/discounts', { staff: TEST_STAFF })
    const label = `${PRODUCT}, ${CUSTOMER.companyName}: Fixed price ⁦₪40.00⁩`
    expect(tableCells()[0].slice(0, 6)).toEqual([PRODUCT, CUSTOMER.companyName, 'Fixed price ⁦₪40.00⁩', '—', 'No end date', 'Active'])
    expect(screen.queryByRole('button', { name: `Edit ${label}` })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Delete ${label}` })).toBeInTheDocument()
  })

  it('shows the sign-in form when signed out', async () => {
    await renderPage('/en/admin/discounts')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument()
  })

  it('reads in Hebrew', async () => {
    await seedRules({ productId: PRODUCT_ID, businessUserId: CUSTOMER.id, kind: 'percent', value: 5, startsAt: `${israelToday()}T00:00:00`, endsAt: null })
    const { user } = await renderPage('/admin/discounts', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'הנחות' })).toBeInTheDocument()
    expect(tableCells('הנחות')[0].slice(0, 2)).toEqual([`מוצר: ${products[0].name.he}`, CUSTOMER.companyName])
    expect(tableCells('הנחות')[0][5]).toBe('פעילה')
    await user.click(screen.getByRole('button', { name: 'הוספה' }))
    const form = await screen.findByRole('dialog', { name: 'הנחה חדשה' })
    expect(within(form).getByRole('switch', { name: 'הנחה גלובלית' })).not.toBeChecked()
    expect(within(form).getByRole('radio', { name: 'קטגוריה' })).toBeChecked()
    expect(within(form).getByRole('combobox', { name: 'קטגוריה *' })).toBeInTheDocument()
    expect(within(form).getByRole('radio', { name: 'כל הלקוחות' })).toBeChecked()
  })
})
