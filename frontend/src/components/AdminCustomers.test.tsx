/**
 * AdminCustomers.test.tsx — Tests for the staff panel's customers page (/admin/customers, routes/admin.customers.tsx)
 * against the fake staff API (src/test/api.ts): the menu link and the table (last sign-in, no Delete: customers are
 * never deleted), opening an account with a generated password (what is sent, the password never shown in the
 * table), the password rules (required when adding, at least 8 characters, kept when an edit leaves it empty, reset
 * when one is typed), a taken email, switching an account off, the customer's own discounts (add on a category, edit
 * it into a product discount, a discount on all products, delete, a fixed price listed but not editable), the sign-in form when signed out, and
 * the Hebrew texts.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createStaffRow } from '@/api'
import { israelToday } from '@/components/DiscountDialog'
import categories from '@/stubs/product-categories.json'
import products from '@/stubs/products.json'
import { fakeFetch, signInFakeUser, STAFF_CUSTOMERS, TEST_STAFF } from '@/test/api'
import { renderPage } from '@/test/utils'

/** The ids the fake gives the first category and the first product (seeded rows have fixed ids). */
const CATEGORY_ID = '00000000-0000-4000-8001-000000000001'
const PRODUCT_ID = '00000000-0000-4000-8002-000000000001'

/** The fake's two customers: the active test customer and an inactive one. */
const [CUSTOMER, INACTIVE] = STAFF_CUSTOMERS

/** The first category's and product's English names, as the discount lines show them. */
const CATEGORY = `Category: ${categories[0].name.en}`
const PRODUCT = `Product: ${products[0].name.en}`

/**
 * The request bodies sent to a path with a method.
 * @param spy - The fetch spy.
 * @param method - E.g. "POST".
 * @param path - E.g. "/api/staff/customers" (a PATCH's path starts with it).
 * @returns The parsed bodies, oldest first.
 */
const bodies = (spy: { mock: { calls: [RequestInfo | URL, RequestInit?][] } }, method: string, path: string) =>
  spy.mock.calls
    .filter(([url, init]) => init?.method === method && String(url).startsWith(path))
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>)

/**
 * The table's rows (without the header), each as the text of its cells.
 * @param caption - The table's name in the page language.
 * @returns The cells' texts per row, in the table's order.
 */
const tableCells = (caption = 'Business customers') =>
  within(screen.getByRole('table', { name: caption }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))

/**
 * Stores price rules in the fake API before the page loads.
 * @param rules - The rules' fields (as the staff API takes them).
 * @returns Resolves when stored.
 */
async function seedRules(...rules: Record<string, unknown>[]) {
  signInFakeUser(TEST_STAFF)
  for (const rule of rules) await createStaffRow('price-rules', rule)
}

// The page loads the 400-product list, which renders slowly when the whole suite runs at once.
describe('/admin/customers', { timeout: 20_000 }, () => {
  it('lists every customer, active or not, with their last sign-in and no Delete', async () => {
    await renderPage('/en/admin/customers', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'Business customers' })).toBeInTheDocument()
    const menu = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(menu).getByRole('link', { name: 'Customers' })).toHaveAttribute('aria-current', 'page')
    const rows = tableCells()
    expect(rows.map((cells) => cells.slice(0, 6))).toEqual([
      [CUSTOMER.companyName, CUSTOMER.fullName, CUSTOMER.email, CUSTOMER.phone, CUSTOMER.businessNumber, CUSTOMER.city],
      [INACTIVE.companyName, INACTIVE.fullName, INACTIVE.email, '—', '—', INACTIVE.city],
    ])
    expect(rows[1]).toContain('Never')
    expect(screen.getByRole('columnheader', { name: /Last sign-in/ })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Password/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Edit ${CUSTOMER.companyName}` })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
  })

  it('opens an account with a generated password', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/customers', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const form = await screen.findByRole('dialog', { name: 'New record' })
    await user.type(within(form).getByLabelText('Company name *'), 'Pet Land')
    await user.type(within(form).getByLabelText('Contact person *'), 'Yossi Cohen')
    await user.type(within(form).getByLabelText('Email (sign-in name) *'), 'New@Shop.co.il')
    const password = within(form).getByLabelText('Password *')
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveAttribute('autocomplete', 'new-password')
    await user.click(within(form).getByRole('button', { name: 'Generate a random password' }))
    expect(password).toHaveAttribute('type', 'text')
    const generated = (password as HTMLInputElement).value
    expect(generated).toHaveLength(12)
    await user.type(within(form).getByLabelText('City'), 'Ashdod')
    expect(within(form).getByLabelText('Active')).toBeChecked()
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(bodies(fetchSpy, 'POST', '/api/staff/customers')).toEqual([
      { companyName: 'Pet Land', fullName: 'Yossi Cohen', email: 'New@Shop.co.il', password: generated, city: 'Ashdod', isActive: true },
    ])
    const row = (await screen.findByRole('cell', { name: 'Pet Land' })).closest('tr')!
    expect(row).toHaveTextContent('new@shop.co.il')
    expect(row).not.toHaveTextContent(generated)
    const stored = (await (await fakeFetch('/api/staff/customers')).json()) as Record<string, unknown>[]
    expect(stored.find((customer) => customer.companyName === 'Pet Land')).not.toHaveProperty('password')
  })

  it('needs a password of at least 8 characters for a new account', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/customers', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const form = await screen.findByRole('dialog', { name: 'New record' })
    await user.type(within(form).getByLabelText('Company name *'), 'Pet Land')
    await user.type(within(form).getByLabelText('Contact person *'), 'Yossi Cohen')
    await user.type(within(form).getByLabelText('Email (sign-in name) *'), 'new@shop.co.il')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    const password = within(form).getByLabelText('Password *')
    expect(password).toHaveFocus()
    expect(password).toHaveAttribute('aria-invalid', 'true')
    expect(password).toHaveAccessibleDescription(expect.stringContaining('Required'))

    await user.type(password, 'short')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    expect(password).toHaveAccessibleDescription(expect.stringContaining('At least 8 characters.'))
    expect(bodies(fetchSpy, 'POST', '/api/staff/customers')).toEqual([])
  })

  it('keeps the password when an edit leaves it empty, and resets it when one is typed', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/customers', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Edit ${CUSTOMER.companyName}` }))
    let form = await screen.findByRole('dialog', { name: `Edit ${CUSTOMER.companyName}` })
    // Never filled in, and not required on an edit.
    let password = within(form).getByLabelText('Password')
    expect(password).toHaveValue('')
    expect(password).not.toHaveAttribute('aria-required')
    expect(password).toHaveAccessibleDescription('Leave empty to keep the current password, or type or generate a new one.')
    await user.clear(within(form).getByLabelText('City'))
    await user.type(within(form).getByLabelText('City'), 'Eilat')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'PATCH', '/api/staff/customers')).toEqual([{ city: 'Eilat' }])
    // The table puts the focus back on the row's Edit button once its cells settle.
    await waitFor(() => expect(screen.getByRole('button', { name: `Edit ${CUSTOMER.companyName}` })).toHaveFocus())

    await user.click(screen.getByRole('button', { name: `Edit ${CUSTOMER.companyName}` }))
    form = await screen.findByRole('dialog', { name: `Edit ${CUSTOMER.companyName}` })
    password = within(form).getByLabelText('Password')
    await user.type(password, 'brand-new-pass')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'PATCH', '/api/staff/customers')).toEqual([{ city: 'Eilat' }, { password: 'brand-new-pass' }])
  })

  it('refuses an email another account has', async () => {
    const { user } = await renderPage('/en/admin/customers', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Edit ${INACTIVE.companyName}` }))
    const form = await screen.findByRole('dialog', { name: `Edit ${INACTIVE.companyName}` })
    const email = within(form).getByLabelText('Email (sign-in name) *')
    await user.clear(email)
    await user.type(email, CUSTOMER.email.toUpperCase())
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(email).toHaveFocus())
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('Another record already has this value.')
  })

  it('switches an account off instead of deleting it', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/customers', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Edit ${CUSTOMER.companyName}` }))
    const form = await screen.findByRole('dialog', { name: `Edit ${CUSTOMER.companyName}` })
    const active = within(form).getByLabelText('Active')
    expect(active).toHaveAccessibleDescription('An inactive customer cannot sign in. Customers are never deleted.')
    await user.click(active)
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'PATCH', '/api/staff/customers')).toEqual([{ isActive: false }])
    // The server refuses to delete a customer too.
    expect((await fakeFetch(`/api/staff/customers/${CUSTOMER.id}`, { method: 'DELETE' })).status).toBe(405)
  })

  it("sets the customer's own discounts on a category or a product", async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/customers', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Discounts: ${CUSTOMER.companyName}` }))
    const list = await screen.findByRole('dialog', { name: 'Discounts' })
    expect(list).toHaveTextContent(CUSTOMER.companyName)
    expect(list).toHaveTextContent('No discounts yet.')

    await user.click(within(list).getByRole('button', { name: 'Add discount' }))
    const form = await screen.findByRole('dialog', { name: 'New discount' })
    // The customer is fixed: only what it applies to is asked.
    expect(within(form).queryByRole('radio', { name: 'One customer' })).not.toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    const target = within(form).getByRole('combobox', { name: 'Applies to *' })
    expect(target).toHaveFocus()
    await user.type(target, categories[0].name.en)
    await user.keyboard('{Enter}')
    await user.type(within(form).getByLabelText('Value *'), '10')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New discount' })).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'POST', '/api/staff/price-rules')).toEqual([
      { categoryId: CATEGORY_ID, productId: null, businessUserId: CUSTOMER.id, kind: 'percent', value: 10, minQuantity: null, startsAt: `${israelToday()}T00:00:00`, endsAt: null },
    ])
    const line = `${CATEGORY}: ⁦10%⁩ off`
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Discounts' })).getByText(new RegExp(`^${line}`))).toBeInTheDocument())

    // Edit it into a product discount.
    await user.click(within(screen.getByRole('dialog', { name: 'Discounts' })).getByRole('button', { name: new RegExp(`^Edit: ${CATEGORY}`) }))
    const edit = await screen.findByRole('dialog', { name: 'Edit discount' })
    const editTarget = within(edit).getByRole('combobox', { name: 'Applies to *' })
    expect(editTarget).toHaveValue(CATEGORY)
    await user.clear(editTarget)
    await user.type(editTarget, products[0].name.en)
    await user.keyboard('{Enter}')
    await user.click(within(edit).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit discount' })).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'PATCH', '/api/staff/price-rules')).toEqual([
      { categoryId: null, productId: PRODUCT_ID, businessUserId: CUSTOMER.id, kind: 'percent', value: 10, minQuantity: null, startsAt: `${israelToday()}T00:00:00`, endsAt: null },
    ])
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Discounts' })).getByText(new RegExp(`^${PRODUCT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: `))).toBeInTheDocument())

    // The table's cell lists it too.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('cell', { name: new RegExp(`^${PRODUCT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).closest('tr')).toHaveTextContent(CUSTOMER.companyName)
  })

  it("sets the customer's own discount on all products", async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/customers', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Discounts: ${CUSTOMER.companyName}` }))
    const list = await screen.findByRole('dialog', { name: 'Discounts' })
    await user.click(within(list).getByRole('button', { name: 'Add discount' }))
    const form = await screen.findByRole('dialog', { name: 'New discount' })
    await user.click(within(form).getByRole('radio', { name: 'All products' }))
    expect(within(form).queryByRole('combobox', { name: 'Applies to *' })).not.toBeInTheDocument()
    expect(within(form).queryByRole('combobox', { name: 'Customer *' })).not.toBeInTheDocument()
    await user.type(within(form).getByLabelText('Value *'), '3')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New discount' })).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'POST', '/api/staff/price-rules')).toEqual([
      { categoryId: null, productId: null, businessUserId: CUSTOMER.id, kind: 'percent', value: 3, minQuantity: null, startsAt: `${israelToday()}T00:00:00`, endsAt: null },
    ])
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Discounts' })).getByText(/^All products: ⁦3%⁩ off/)).toBeInTheDocument())
  })

  it("lists the customer's fixed price, which can be deleted but not edited", async () => {
    await seedRules({ productId: PRODUCT_ID, businessUserId: CUSTOMER.id, kind: 'fixed_price', value: 40 })
    const { user } = await renderPage('/en/admin/customers', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Discounts: ${CUSTOMER.companyName}` }))
    const list = await screen.findByRole('dialog', { name: 'Discounts' })
    const line = `${PRODUCT}: Fixed price ⁦₪40.00⁩`
    expect(within(list).getByText(line)).toBeInTheDocument()
    expect(within(list).queryByRole('button', { name: `Edit: ${line}` })).not.toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: `Delete: ${line}` }))
    await user.click(within(list).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(within(list).getByText('No discounts yet.')).toBeInTheDocument())
    expect(await (await fakeFetch('/api/staff/price-rules')).json()).toEqual([])
  })

  it('shows the sign-in form when signed out', async () => {
    await renderPage('/en/admin/customers')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument()
  })

  it('reads in Hebrew', async () => {
    const { user } = await renderPage('/admin/customers', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'לקוחות עסקיים' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'ניהול' })).getByRole('link', { name: 'לקוחות' })).toHaveAttribute('aria-current', 'page')
    expect(tableCells('לקוחות עסקיים')[1]).toContain('טרם נכנס')
    await user.click(screen.getByRole('button', { name: 'הוספה' }))
    const form = await screen.findByRole('dialog')
    expect(within(form).getByLabelText('סיסמה *')).toHaveAttribute('dir', 'ltr')
    expect(within(form).getByRole('button', { name: 'יצירת סיסמה אקראית' })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'הצגת הסיסמה' })).toBeInTheDocument()
  })
})
