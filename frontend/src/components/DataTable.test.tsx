/**
 * DataTable.test.tsx — Tests for the admin data table (DataTable, RecordDialog) on the real /admin/brands page
 * against the fake staff API (src/test/api.ts): the staff sign-in gate, listing, search and sorting, editing
 * (only the changed fields are sent), adding without a URL name or order (the server fills them), "Change order",
 * deleting with confirmation, server and client errors shown on their field (a table of its own for patterns and
 * duplicates), Hebrew/RTL and English texts, a caller's own Add/Edit dialog (formDialog) with Edit hidden on some
 * rows (canEdit), and a read-only table without action buttons.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import { DataTable, type DataColumn, type FormDialogProps } from '@/components/DataTable'
import brands from '@/stubs/brands.json'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { fakeFetch, TEST_STAFF } from '@/test/api'
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

  it('adds a brand without a URL name or order: the server names it and puts it last', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/brands', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const dialog = await screen.findByRole('dialog', { name: 'New record' })
    for (const label of [/URL name/, /^Order/]) expect(within(dialog).queryByLabelText(label)).not.toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Name *'), 'Acme Pets')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await within(table()).findByText('Acme Pets')).toBeInTheDocument()
    expect(names().at(-1)).toBe('Acme Pets')
    expect(screen.getByText('Record added.')).toHaveAttribute('role', 'status')
    const post = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(String(post[1]?.body))).toEqual({ name: 'Acme Pets', isActive: true })
    const saved = (await (await fakeFetch('/api/staff/brands')).json()) as { slug: string }[]
    expect(saved.at(-1)?.slug).toBe('acme-pets')
  })

  it('shows no URL name or order column, and reorders the brands in "Change order"', async () => {
    const { user } = await renderPage('/en/admin/brands', { staff: TEST_STAFF })
    const headers = within(table()).getAllByRole('columnheader').map((header) => header.textContent)
    expect(headers).toEqual(['Name', 'Tagline', 'Colour', 'Active', 'Actions'])
    await user.click(screen.getByRole('button', { name: 'Change order' }))
    const dialog = await screen.findByRole('dialog', { name: 'Change the order' })
    await user.click(within(dialog).getByRole('button', { name: `Move ${brands[1].name} up` }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(names().slice(0, 2)).toEqual([brands[1].name, brands[0].name]))
  })

  it('checks required fields before sending', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/brands', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const dialog = await screen.findByRole('dialog', { name: 'New record' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(dialog).getByLabelText('Name *')).toHaveAccessibleDescription('Required')
    expect(within(dialog).getByLabelText('Name *')).toHaveFocus()
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
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

describe('DataTable with a column config of its own', () => {
  type Coded = { id: string; name: string; code: string }
  const columns: DataColumn<Coded>[] = [
    { key: 'name', label: 'Name', required: true },
    { key: 'code', label: 'Code', required: true, ltr: true, pattern: '[A-Z]{3}' },
  ]

  it('checks patterns before sending', async () => {
    const onCreate = vi.fn(() => Promise.resolve())
    const { user } = renderComponent(
      <DataTable<Coded> rows={[]} columns={columns} caption="Items" rowKey={(item) => item.id} rowLabel={(item) => item.name} onCreate={onCreate} />,
      'en',
    )
    await user.click(await screen.findByRole('button', { name: 'Add' }))
    const dialog = await screen.findByRole('dialog', { name: 'New record' })
    await user.type(within(dialog).getByLabelText('Name *'), 'Alpha')
    await user.type(within(dialog).getByLabelText('Code *'), 'not a code')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(dialog).getByLabelText('Code *')).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialog).getByLabelText('Code *')).toHaveFocus()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it("shows the server's duplicate error on the field it is about", async () => {
    const onUpdate = vi.fn(() => Promise.reject(new ApiError(409, { error: 'duplicate', constraint: 'items_code_key' })))
    const { user } = renderComponent(
      <DataTable<Coded>
        rows={[{ id: '1', name: 'Alpha', code: 'AAA' }]}
        columns={columns}
        caption="Items"
        rowKey={(item) => item.id}
        rowLabel={(item) => item.name}
        onUpdate={onUpdate}
      />,
      'en',
    )
    await user.click(await screen.findByRole('button', { name: 'Edit Alpha' }))
    const dialog = await screen.findByRole('dialog')
    const code = within(dialog).getByLabelText('Code *')
    await user.clear(code)
    await user.type(code, 'BBB')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(code).toHaveAttribute('aria-invalid', 'true'))
    expect(code).toHaveAccessibleDescription(/Another record already has this value/)
    expect(onUpdate).toHaveBeenCalledWith('1', { code: 'BBB' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('DataTable with a form dialog of its own', () => {
  type Item = { id: string; name: string; locked: boolean }
  const columns: DataColumn<Item>[] = [{ key: 'name', label: 'Name' }]

  /**
   * A minimal caller's dialog: one button that saves a fixed value.
   * @param props.row - The edited row, or undefined for Add.
   * @param props.onSave - DataTable's save.
   * @param props.onClose - Closes it.
   * @param props.onCloseAutoFocus - DataTable's focus return.
   * @returns The dialog.
   */
  function NameDialog({ row, onSave, onClose, onCloseAutoFocus }: FormDialogProps & { row?: Item }) {
    return (
      <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent closeLabel="Close" onCloseAutoFocus={onCloseAutoFocus} aria-describedby={undefined}>
          <DialogTitle>{row ? `Rename ${row.name}` : 'Make one'}</DialogTitle>
          <button type="button" onClick={() => onSave({ name: row ? `${row.name}!` : 'New' })}>
            Go
          </button>
        </DialogContent>
      </Dialog>
    )
  }

  it('opens it for Add and Edit, saves through the handlers, and hides Edit where canEdit says no', async () => {
    const onCreate = vi.fn(() => Promise.resolve())
    const onUpdate = vi.fn(() => Promise.resolve())
    const { user } = renderComponent(
      <DataTable<Item>
        rows={[
          { id: '1', name: 'Alpha', locked: false },
          { id: '2', name: 'Beta', locked: true },
        ]}
        columns={columns}
        caption="Items"
        rowKey={(item) => item.id}
        rowLabel={(item) => item.name}
        onCreate={onCreate}
        onUpdate={onUpdate}
        canEdit={(item) => !item.locked}
        formDialog={(row, props) => <NameDialog row={row} {...props} />}
      />,
      'en',
    )
    await user.click(await screen.findByRole('button', { name: 'Add' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Make one' })).getByRole('button', { name: 'Go' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onCreate).toHaveBeenCalledWith({ name: 'New' })
    expect(screen.getByText('Record added.')).toHaveAttribute('role', 'status')

    expect(screen.queryByRole('button', { name: 'Edit Beta' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit Alpha' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Rename Alpha' })).getByRole('button', { name: 'Go' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onUpdate).toHaveBeenCalledWith('1', { name: 'Alpha!' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Alpha' })).toHaveFocus())
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
    expect(screen.queryByRole('button', { name: /^(Add|Edit|Delete|Change order)/ })).not.toBeInTheDocument()
    expect(within(items).queryByRole('columnheader', { name: /Actions/ })).not.toBeInTheDocument()
  })
})
