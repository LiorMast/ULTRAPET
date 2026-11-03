/**
 * DataTable.test.tsx — Tests for the admin data table (DataTable, RecordDialog) on the real /admin/brands page
 * against the fake staff API (src/test/api.ts): the staff sign-in gate, listing, search and sorting, editing
 * (only the changed fields are sent), adding, deleting with confirmation, server and client errors shown on
 * their field, Hebrew/RTL and English texts, and a read-only table without action buttons.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTable, type DataColumn } from '@/components/DataTable'
import brands from '@/stubs/brands.json'
import { TEST_STAFF } from '@/test/api'
import { renderComponent, renderPage } from '@/test/utils'

/** The brands table on the page. */
const table = () => screen.getByRole('table', { name: /^(מותגים|Brands)$/ })

/** The brand names in the table body, in display order. */
const names = () =>
  within(table())
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent)

describe('DataTable on /admin/brands', () => {
  it('asks for the staff sign-in, then shows the brands', async () => {
    const { user } = await renderPage('/en/admin/brands')
    expect(screen.getByRole('heading', { level: 1, name: 'Staff sign-in' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), 'admin@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Brands' })).toBeInTheDocument()
    expect(names()).toEqual(brands.map((brand) => brand.name))
    expect(screen.getByText('Test Admin')).toBeInTheDocument()
  })

  it('opens /admin on the brands page', async () => {
    const { router } = await renderPage('/en/admin', { staff: TEST_STAFF })
    expect(router.state.location.pathname).toBe('/admin/brands')
  })

  it('searches every language and sorts by a column', async () => {
    const { user } = await renderPage('/en/admin/brands', { staff: TEST_STAFF })
    await user.type(screen.getByRole('searchbox'), brands[1].tagline.he)
    await waitFor(() => expect(names()).toEqual([brands[1].name]))
    await user.clear(screen.getByRole('searchbox'))
    await waitFor(() => expect(names()).toHaveLength(brands.length))
    await user.click(within(table()).getByRole('columnheader', { name: /Name/ }))
    expect(names()).toEqual(brands.map((brand) => brand.name).sort((a, b) => a.localeCompare(b)))
  })

  it('edits a brand and sends only the changed fields', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/brands', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Edit ${brands[0].name}` }))
    const dialog = await screen.findByRole('dialog', { name: `Edit ${brands[0].name}` })
    const tagline = within(dialog).getByRole('group', { name: 'Tagline' })
    const english = within(tagline).getByLabelText('English')
    await user.clear(english)
    await user.type(english, 'Complete nutrition')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const patch = fetchSpy.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ tagline: { he: brands[0].tagline.he, en: 'Complete nutrition' } })
    expect(screen.getByText('Changes saved.')).toHaveAttribute('role', 'status')
    expect(await within(table()).findByText('Complete nutrition')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: `Edit ${brands[0].name}` })).toHaveFocus())
  })

  it('adds a brand', async () => {
    const { user } = await renderPage('/en/admin/brands', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const dialog = await screen.findByRole('dialog', { name: 'New record' })
    await user.type(within(dialog).getByLabelText('Name *'), 'Acme Pets')
    await user.type(within(dialog).getByLabelText('URL name *'), 'acme-pets')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await within(table()).findByText('Acme Pets')).toBeInTheDocument()
    expect(screen.getByText('Record added.')).toHaveAttribute('role', 'status')
  })

  it('checks required fields and patterns before sending', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/brands', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const dialog = await screen.findByRole('dialog', { name: 'New record' })
    await user.type(within(dialog).getByLabelText('URL name *'), 'Not A Slug')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(dialog).getByLabelText('Name *')).toHaveAccessibleDescription('Required')
    expect(within(dialog).getByLabelText('Name *')).toHaveFocus()
    expect(within(dialog).getByLabelText('URL name *')).toHaveAttribute('aria-invalid', 'true')
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it("shows the server's duplicate error on the field it is about", async () => {
    const { user } = await renderPage('/en/admin/brands', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Edit ${brands[0].name}` }))
    const dialog = await screen.findByRole('dialog')
    const slug = within(dialog).getByLabelText('URL name *')
    await user.clear(slug)
    await user.type(slug, brands[1].slug)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(slug).toHaveAttribute('aria-invalid', 'true'))
    expect(slug).toHaveAccessibleDescription(/Another record already has this value/)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('deletes a brand after confirming', async () => {
    const { user } = await renderPage('/en/admin/brands', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Delete ${brands[2].name}` }))
    const dialog = await screen.findByRole('alertdialog', { name: `Delete ${brands[2].name}?` })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(names()).toContain(brands[2].name)
    await user.click(screen.getByRole('button', { name: `Delete ${brands[2].name}` }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(names()).not.toContain(brands[2].name))
    expect(screen.getByText('Record deleted.')).toHaveAttribute('role', 'status')
  })

  it('keeps the dialog open with the reason when a delete is refused', async () => {
    const { user } = await renderPage('/en/admin/brands', { staff: TEST_STAFF })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: 'in_use' }), { status: 409 }))
    await user.click(screen.getByRole('button', { name: `Delete ${brands[0].name}` }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/other records still use it/)
  })

  it('is right-to-left with Hebrew texts on the Hebrew page', async () => {
    const { user } = await renderPage('/admin/brands', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'מותגים' })).toBeInTheDocument()
    expect(table().closest('.data-table')).toHaveAttribute('dir', 'rtl')
    expect(within(table()).getByText(brands[0].tagline.he)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `עריכה: ${brands[0].name}` }))
    expect(await screen.findByRole('dialog', { name: `עריכת ${brands[0].name}` })).toBeInTheDocument()
  })
})

describe('DataTable without handlers', () => {
  it('is read-only: no Add, Edit or Delete buttons and no actions column', async () => {
    type Item = { id: string; name: string; isActive: boolean }
    const columns: DataColumn<Item>[] = [
      { key: 'name', label: 'Name' },
      { key: 'isActive', label: 'Active', type: 'boolean' },
    ]
    renderComponent(
      <DataTable<Item> rows={[{ id: '1', name: 'Alpha', isActive: true }]} columns={columns} caption="Items" rowKey={(item) => item.id} rowLabel={(item) => item.name} />,
      'en',
    )
    const items = await screen.findByRole('table', { name: 'Items' })
    expect(within(items).getByText('Alpha')).toBeInTheDocument()
    expect(within(items).getByRole('img', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^(Add|Edit|Delete)/ })).not.toBeInTheDocument()
    expect(within(items).queryByRole('columnheader', { name: /Actions/ })).not.toBeInTheDocument()
  })
})
