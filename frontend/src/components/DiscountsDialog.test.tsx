/**
 * DiscountsDialog.test.tsx — Tests for the staff panel's catalog pages (/admin/categories, /admin/products) and
 * their discounts (DiscountsDialog, DataTable's row actions) against the fake staff API (src/test/api.ts): the
 * menu, the tables, adding/editing a category and a product, adding, editing and deleting a discount (what is
 * sent, what the list and the table show, where the focus goes), ended discounts, and the Hebrew texts.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createStaffRow } from '@/api'
import { israelToday } from '@/components/DiscountDialog'
import categories from '@/stubs/product-categories.json'
import products from '@/stubs/products.json'
import { signInFakeUser, TEST_STAFF } from '@/test/api'
import { renderPage } from '@/test/utils'

/** The id the fake gives the first category (seeded rows have fixed ids). */
const FIRST_CATEGORY_ID = '00000000-0000-4000-8001-000000000001'

/** Today in the English date format of the discount summaries, e.g. "Nov 3, 2026". */
const todayText = () => new Date(`${israelToday()}T12:00:00`).toLocaleDateString('en', { dateStyle: 'medium' })

/**
 * Stores a discount on the first category in the fake API before the page loads: 10% off from today, open-ended.
 * @returns Resolves when stored.
 */
async function seedCategoryDiscount() {
  signInFakeUser(TEST_STAFF)
  await createStaffRow('price-rules', { categoryId: FIRST_CATEGORY_ID, kind: 'percent', value: 10, startsOn: israelToday(), endsOn: null })
}

/** How the seeded discount reads in the list. */
const SEEDED = `\u206610%\u2069 off, from ${todayText()}, with no end date`

/**
 * The table row of a record.
 * @param name - The record's name, as in its first cell.
 * @returns The row.
 */
const rowOf = (name: string) => screen.getAllByRole('row').find((row) => within(row).queryAllByRole('cell')[0]?.textContent === name)!

/**
 * The request bodies sent with a method.
 * @param spy - The fetch spy.
 * @param method - E.g. "POST".
 * @returns The parsed bodies, oldest first.
 */
const bodies = (spy: { mock: { calls: [RequestInfo | URL, RequestInit?][] } }, method: string) =>
  spy.mock.calls.filter(([, init]) => init?.method === method).map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>)

describe('/admin/categories', () => {
  it('lists the categories, with the catalog pages in the menu', async () => {
    await renderPage('/en/admin/categories', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'Categories' })).toBeInTheDocument()
    const menu = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(menu).getAllByRole('link').map((link) => link.textContent)).toEqual(['Products', 'Categories', 'Brands'])
    expect(within(menu).getByRole('link', { name: 'Categories' })).toHaveAttribute('aria-current', 'page')
    const table = screen.getByRole('table', { name: 'Categories' })
    expect(within(table).getAllByRole('row')).toHaveLength(categories.length + 1)
    expect(within(rowOf(categories[0].name.en)).getAllByRole('cell')[2]).toHaveTextContent('—')
  })

  it('adds a discount to a category', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/categories', { staff: TEST_STAFF })
    const name = categories[0].name.en
    await user.click(screen.getByRole('button', { name: `Discounts: ${name}` }))
    const dialog = await screen.findByRole('dialog', { name: 'Discounts' })
    expect(dialog).toHaveAccessibleDescription(new RegExp(name))
    expect(within(dialog).getByText('No discounts yet.')).toBeInTheDocument()

    // 10% off from today, open-ended.
    await user.click(within(dialog).getByRole('button', { name: 'Add discount' }))
    const form = await screen.findByRole('dialog', { name: 'New discount' })
    await user.type(within(form).getByLabelText('Value *'), '10')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New discount' })).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'POST')).toEqual([{ categoryId: FIRST_CATEGORY_ID, kind: 'percent', value: 10, startsOn: israelToday(), endsOn: null }])
    const added = `⁦10%⁩ off, from ${todayText()}, with no end date`
    expect(await within(dialog).findByText(added)).toBeInTheDocument()
    expect(within(dialog).getByRole('status')).toHaveTextContent('Discount saved.')
    // Radix puts the focus back on the button that opened the form.
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Add discount' })).toHaveFocus())

    // Closed (two buttons close it: the corner X and the footer's Close), the table shows it, and the focus is
    // back on the row's button.
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(rowOf(name)).getAllByRole('cell')[2]).toHaveTextContent(added)
    await waitFor(() => expect(screen.getByRole('button', { name: `Discounts: ${name}` })).toHaveFocus())
  })

  it('edits a discount', async () => {
    await seedCategoryDiscount()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/categories', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Discounts: ${categories[0].name.en}` }))
    const dialog = await screen.findByRole('dialog', { name: 'Discounts' })
    await user.click(within(dialog).getByRole('button', { name: `Edit: ${SEEDED}` }))
    const edit = await screen.findByRole('dialog', { name: 'Edit discount' })
    expect(within(edit).getByLabelText('Value *')).toHaveValue('10')

    // ₪20 off instead.
    await user.click(within(edit).getByRole('radio', { name: 'Amount (₪)' }))
    await user.clear(within(edit).getByLabelText('Value *'))
    await user.type(within(edit).getByLabelText('Value *'), '20')
    await user.click(within(edit).getByRole('button', { name: 'Save' }))
    const changed = `⁦₪20.00⁩ off, from ${todayText()}, with no end date`
    expect(await within(dialog).findByText(changed)).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: `Edit: ${changed}` })).toHaveFocus())
    expect(bodies(fetchSpy, 'PATCH')).toEqual([{ kind: 'amount', value: 20, startsOn: israelToday(), endsOn: null }])
  })

  it('deletes a discount after a confirmation that can be cancelled', async () => {
    await seedCategoryDiscount()
    const { user } = await renderPage('/en/admin/categories', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Discounts: ${categories[0].name.en}` }))
    const dialog = await screen.findByRole('dialog', { name: 'Discounts' })
    await user.click(within(dialog).getByRole('button', { name: `Delete: ${SEEDED}` }))
    expect(within(dialog).getByText('Delete this discount?')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(within(dialog).getByRole('button', { name: `Delete: ${SEEDED}` })).toHaveFocus())
    await user.click(within(dialog).getByRole('button', { name: `Delete: ${SEEDED}` }))
    await user.click(within(dialog).getByRole('button', { name: /^Delete$/ }))
    expect(await within(dialog).findByText('No discounts yet.')).toBeInTheDocument()
    expect(within(dialog).getByRole('status')).toHaveTextContent('Discount deleted.')
    expect(within(dialog).getByRole('button', { name: 'Add discount' })).toHaveFocus()
  })

  it('marks a discount that has ended', async () => {
    const { user } = await renderPage('/en/admin/categories', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Discounts: ${categories[1].name.en}` }))
    const dialog = await screen.findByRole('dialog', { name: 'Discounts' })
    await user.click(within(dialog).getByRole('button', { name: 'Add discount' }))
    const form = await screen.findByRole('dialog', { name: 'New discount' })
    await user.type(within(form).getByLabelText('Value *'), '5')
    await user.clear(within(form).getByLabelText('Start date *'))
    await user.type(within(form).getByLabelText('Start date *'), '2020-01-01')
    await user.click(within(form).getByRole('checkbox', { name: 'No end date' }))
    await user.type(within(form).getByLabelText('End date'), '2020-01-31')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText(/^⁦5%⁩ off, from Jan 1, 2020 to Jan 31, 2020 \(ended\)$/)).toBeInTheDocument()
  })

  it('adds a category', async () => {
    const { user } = await renderPage('/en/admin/categories', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const dialog = await screen.findByRole('dialog', { name: 'New record' })
    const name = within(dialog).getByRole('group', { name: 'Name *' })
    await user.type(within(name).getByLabelText('Hebrew'), 'זוחלים')
    await user.type(within(name).getByLabelText('English'), 'Reptiles')
    await user.type(within(dialog).getByLabelText('URL name *'), 'reptiles')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(screen.getByRole('table')).findByText('Reptiles')).toBeInTheDocument()
  })

  it('refuses to delete a category that has products', async () => {
    const { user } = await renderPage('/en/admin/categories', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Delete ${categories[0].name.en}` }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/other records still use it/)
  })

  it('is in Hebrew on the Hebrew page', async () => {
    const { user } = await renderPage('/admin/categories', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'קטגוריות' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `הנחות: ${categories[0].name.he}` }))
    const dialog = await screen.findByRole('dialog', { name: 'הנחות' })
    expect(within(dialog).getByText('אין עדיין הנחות.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'הוספת הנחה' })).toBeInTheDocument()
  })
})

describe('/admin/products', () => {
  const first = products[0]

  it('lists the products with their category and list price', async () => {
    await renderPage('/en/admin/products', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument()
    const cells = within(rowOf(first.name.en)).getAllByRole('cell')
    expect(cells[2]).toHaveTextContent(categories.find((category) => category.slug === first.category)!.name.en)
    expect(cells[4]).toHaveTextContent('₪303.90')
    expect(screen.getByText(`Showing 1–25 of ${products.length}`)).toBeInTheDocument()
  })

  it('edits a product and sends only the changed fields', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Edit ${first.name.en}` }))
    const dialog = await screen.findByRole('dialog', { name: `Edit ${first.name.en}` })
    expect(within(dialog).getByLabelText('List price')).toHaveAccessibleDescription(/before VAT/)
    await user.clear(within(dialog).getByLabelText('List price'))
    await user.type(within(dialog).getByLabelText('List price'), '299.5')
    await user.clear(within(dialog).getByLabelText('Category *'))
    await user.type(within(dialog).getByLabelText('Category *'), 'dry cat')
    await user.click(within(dialog).getByRole('option', { name: categories[0].name.en }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'PATCH')).toEqual([{ categoryId: FIRST_CATEGORY_ID, listPrice: '299.5' }])
    const cells = within(rowOf(first.name.en)).getAllByRole('cell')
    expect(cells[2]).toHaveTextContent(categories[0].name.en)
    expect(cells[4]).toHaveTextContent('₪299.50')
  })

  it('adds a product in the first category by default', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const dialog = await screen.findByRole('dialog', { name: 'New record' })
    expect(within(dialog).getByLabelText('Category *')).toHaveDisplayValue(categories[0].name.en)
    const name = within(dialog).getByRole('group', { name: 'Name *' })
    await user.type(within(name).getByLabelText('Hebrew'), 'חטיף חדש')
    await user.type(within(dialog).getByLabelText('URL name *'), 'new-treat')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'POST')).toEqual([{ name: { he: 'חטיף חדש' }, categoryId: FIRST_CATEGORY_ID, isActive: true, slug: 'new-treat', sortOrder: 0 }])
  })

  it('adds a discount to a product', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Discounts: ${first.name.en}` }))
    const dialog = await screen.findByRole('dialog', { name: 'Discounts' })
    await user.click(within(dialog).getByRole('button', { name: 'Add discount' }))
    const form = await screen.findByRole('dialog', { name: 'New discount' })
    await user.type(within(form).getByLabelText('Value *'), '7.5')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText(/^⁦7\.5%⁩ off/)).toBeInTheDocument()
    expect(bodies(fetchSpy, 'POST')[0]).toMatchObject({ productId: '00000000-0000-4000-8002-000000000001', kind: 'percent', value: 7.5 })
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(rowOf(first.name.en)).getAllByRole('cell')[5]).toHaveTextContent(/7\.5%.+off/)
  })
})
