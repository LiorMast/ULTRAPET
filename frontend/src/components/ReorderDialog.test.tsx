/**
 * ReorderDialog.test.tsx — Tests for the reorder dialog (ReorderDialog, DataTable's onReorder) on the real
 * /admin/categories page against the fake staff API (src/test/api.ts): the categories table without its technical
 * fields (URL name, old site address, order), a new category named and placed by the server, "Change order" with the
 * arrow buttons (positions, announcements, focus), Save sending every id once and the table and home page carousel
 * following, Cancel, a refused save, Escape cancelling a keyboard drag before it closes the dialog, the Hebrew texts,
 * and the dialog on its own with any list.
 */
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReorderDialog } from '@/components/ReorderDialog'
import categories from '@/stubs/product-categories.json'
import { fakeFetch, TEST_STAFF } from '@/test/api'
import { renderComponent, renderPage } from '@/test/utils'

/** The category names in the table body, in display order. */
const tableNames = () =>
  within(screen.getByRole('table', { name: /^(Categories|קטגוריות)$/ }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent)

/** The entry labels of the open reorder dialog, in order. */
const entries = (dialog: HTMLElement) =>
  within(within(dialog).getByRole('list')).getAllByRole('listitem').map((item) => item.querySelector('.truncate')?.textContent)

/** The English names of the stub categories, in their order. */
const english = categories.map((category) => category.name.en)

/**
 * Opens "Change order" on /en/admin/categories.
 * @returns The dialog and the user-event instance.
 */
async function openReorder() {
  const page = await renderPage('/en/admin/categories', { staff: TEST_STAFF })
  await page.user.click(screen.getByRole('button', { name: 'Change order' }))
  const dialog = await screen.findByRole('dialog', { name: 'Change the order' })
  return { dialog, user: page.user }
}

describe('the categories table', () => {
  it('shows no URL name, old site address or order, in the table or the form', async () => {
    const { user } = await renderPage('/en/admin/categories', { staff: TEST_STAFF })
    const headers = within(screen.getByRole('table', { name: 'Categories' }))
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    expect(headers).toEqual(['Name', 'Discounts', 'Picture', 'Active', 'Actions'])
    expect(tableNames()).toEqual(english.slice(0, 15))

    await user.click(screen.getByRole('button', { name: `Edit ${english[0]}` }))
    const dialog = await screen.findByRole('dialog', { name: `Edit ${english[0]}` })
    for (const label of [/URL name/, /Old site address/, /^Order/]) expect(within(dialog).queryByLabelText(label)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Picture' })).toBeInTheDocument()
  })

  it('adds a category: the server names it after its English name and puts it last', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/categories', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const dialog = await screen.findByRole('dialog', { name: 'New record' })
    const name = within(dialog).getByRole('group', { name: 'Name *' })
    await user.type(within(name).getByLabelText('Hebrew'), 'זוחלים')
    await user.type(within(name).getByLabelText('English'), 'Reptiles & Turtles')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Record added.')).toBeInTheDocument()
    const post = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(String(post[1]?.body))).toEqual({ name: { he: 'זוחלים', en: 'Reptiles & Turtles' }, isActive: true })
    const created = (await (await fakeFetch('/api/staff/categories')).json()) as { slug: string; sortOrder: number }[]
    expect(created.at(-1)).toMatchObject({ slug: 'reptiles-turtles', sortOrder: categories.length })
  })
})

describe('Change order (ReorderDialog)', () => {
  it('lists the categories in their order, with Save off until something moves', async () => {
    const { dialog } = await openReorder()
    expect(entries(dialog)).toEqual(english)
    expect(within(dialog).getByRole('list', { name: 'Change the order' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: `Move ${english[0]} up` })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: `Move ${english.at(-1)} down` })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: `Move ${english[0]}` })).toHaveAccessibleDescription(/press Space on its handle/)
  })

  it('moves entries with the arrows, announces each move and keeps the focus on the arrow', async () => {
    const { dialog, user } = await openReorder()
    const down = within(dialog).getByRole('button', { name: `Move ${english[0]} down` })
    await user.click(down)
    expect(entries(dialog).slice(0, 2)).toEqual([english[1], english[0]])
    // Our live region (dnd-kit has its own for drags).
    expect(within(dialog).getAllByRole('status').map((region) => region.textContent)).toContain(`${english[0]} moved to position 2 of ${english.length}.`)
    expect(within(dialog).getByRole('button', { name: `Move ${english[0]} down` })).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: `Move ${english[0]} up` }))
    expect(entries(dialog)).toEqual(english)
    // At the top "up" is off, so the focus moves to "down".
    expect(within(dialog).getByRole('button', { name: `Move ${english[0]} down` })).toHaveFocus()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('saves the new order at once; the table and the home page carousel follow', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { dialog, user } = await openReorder()
    await user.click(within(dialog).getByRole('button', { name: `Move ${english[1]} up` }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Order saved.')).toBeInTheDocument()
    const put = fetchSpy.mock.calls.find(([url, init]) => url === '/api/staff/categories/order' && init?.method === 'PUT')!
    const ids = (JSON.parse(String(put[1]?.body)) as { ids: string[] }).ids
    expect(ids).toHaveLength(categories.length)
    expect(new Set(ids).size).toBe(categories.length)
    await waitFor(() => expect(tableNames().slice(0, 2)).toEqual([english[1], english[0]]))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change order' })).toHaveFocus())

    cleanup()
    await renderPage('/en')
    const cards = within(document.getElementById('categories')!).getAllByRole('link', { name: new RegExp(`^(${english.slice(0, 2).join('|')})$`) })
    expect(cards.map((card) => card.textContent)).toEqual([english[1], english[0]])
  })

  it('Cancel sends nothing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { dialog, user } = await openReorder()
    await user.click(within(dialog).getByRole('button', { name: `Move ${english[0]} down` }))
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetchSpy.mock.calls.some(([url]) => url === '/api/staff/categories/order')).toBe(false)
    expect(tableNames()[0]).toBe(english[0])
  })

  it("keeps the dialog open with the server's refusal", async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      input === '/api/staff/categories/order' ? Promise.resolve(Response.json({ error: 'invalid', field: 'ids' }, { status: 400 })) : fakeFetch(input, init),
    )
    const { dialog, user } = await openReorder()
    await user.click(within(dialog).getByRole('button', { name: `Move ${english[0]} down` }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Invalid value')
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('Escape during a keyboard drag cancels the drag, and only then closes the dialog', async () => {
    const { dialog, user } = await openReorder()
    within(dialog).getByRole('button', { name: `Move ${english[0]}` }).focus()
    await user.keyboard(' ')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Change the order' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('is in Hebrew on the Hebrew page', async () => {
    const { user } = await renderPage('/admin/categories', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'שינוי הסדר' }))
    const dialog = await screen.findByRole('dialog', { name: 'שינוי הסדר' })
    expect(within(dialog).getByRole('button', { name: `הזזת ${categories[0].name.he} למטה` })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'שמירה' })).toBeDisabled()
  })

  it('reorders any list on its own, with a detail line', async () => {
    const onSave = vi.fn(() => Promise.resolve())
    const { user } = renderComponent(
      <ReorderDialog
        items={[
          { id: 'a', label: 'Alpha', detail: 'First' },
          { id: 'b', label: 'Beta' },
          { id: 'c', label: 'Gamma' },
        ]}
        title="Sort the letters"
        description="Any list works."
        onSave={onSave}
        onClose={() => {}}
        onCloseAutoFocus={() => {}}
      />,
      'en',
    )
    const dialog = await screen.findByRole('dialog', { name: 'Sort the letters' })
    expect(within(dialog).getByText('Any list works.')).toBeInTheDocument()
    expect(within(dialog).getByText('First')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Move Gamma up' }))
    await user.click(within(dialog).getByRole('button', { name: 'Move Gamma up' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(['c', 'a', 'b'])
  })
})
