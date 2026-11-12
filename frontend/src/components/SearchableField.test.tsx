/**
 * SearchableField.test.tsx — Tests for the type-to-search field (SearchableField): in strict mode on the real
 * /admin/products edit form (the category and brand fields, against the fake staff API), and on its own for the
 * free mode and the server search (`loadOptions`): filtering and ranking, keyboard and mouse picking, Escape
 * closing only the list, putting back the last choice, the combobox ARIA wiring, Hebrew texts and aborting
 * an older search.
 */
import { useState } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchableField, type SearchOption } from '@/components/SearchableField'
import categories from '@/stubs/product-categories.json'
import products from '@/stubs/products.json'
import { TEST_STAFF } from '@/test/api'
import { renderComponent, renderPage } from '@/test/utils'

const first = products[0]
const firstCategory = categories.find((category) => category.slug === first.category)!

/** The PATCH bodies sent to the API so far. */
const patches = (spy: { mock: { calls: [RequestInfo | URL, RequestInit?][] } }) =>
  spy.mock.calls.filter(([, init]) => init?.method === 'PATCH').map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>)

/**
 * Opens the edit form of the first product on /admin/products.
 * @param url - The page URL (picks the language).
 * @param name - The product's name in that language.
 * @returns The dialog, the user-event instance and a fetch spy.
 */
async function openProductForm(url = '/en/admin/products', name = first.name.en) {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  const { user } = await renderPage(url, { staff: TEST_STAFF })
  await user.click(screen.getByRole('button', { name: `${url.startsWith('/en') ? 'Edit' : 'עריכה:'} ${name}` }))
  const dialog = await screen.findByRole('dialog')
  return { dialog, user, fetchSpy }
}

/** Fruit suggestions for the stand-alone tests. */
const FRUIT: SearchOption[] = [
  { value: '1', label: 'Pineapple' },
  { value: '2', label: 'Apple', detail: 'Green or red' },
  { value: '3', label: 'Red Apple' },
  { value: '4', label: 'Banana', detail: 'Rich in apple-like flavour' },
]

/**
 * A free field with its own state, the way a form uses it.
 * @param props.onChange - Spy for the values.
 * @param props.loadOptions - Optional server search.
 * @returns The labelled field and its current value.
 */
function FreeField({ onChange, loadOptions }: { onChange?: (value: string, option: SearchOption | null) => void; loadOptions?: (query: string, signal: AbortSignal) => Promise<SearchOption[]> }) {
  const [value, setValue] = useState('')
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <label htmlFor="fruit">Fruit</label>
      <SearchableField
        id="fruit"
        label="Fruit"
        value={value}
        options={loadOptions ? undefined : FRUIT}
        loadOptions={loadOptions}
        debounceMs={0}
        onChange={(next, option) => {
          setValue(next)
          onChange?.(next, option)
        }}
      />
      <output>{value}</output>
    </form>
  )
}

// The product form sits on the 400-product admin table, which renders slowly when the whole suite runs at once.
describe('SearchableField, strict, on the product form', { timeout: 15_000 }, () => {
  it('shows the saved category and picks another one by typing and Enter', async () => {
    const { dialog, user, fetchSpy } = await openProductForm()
    const field = within(dialog).getByRole('combobox', { name: 'Category *' })
    expect(field).toHaveValue(firstCategory.name.en)
    expect(field).toHaveAttribute('aria-expanded', 'false')
    await user.clear(field)
    await user.type(field, 'litter')
    expect(field).toHaveAttribute('aria-expanded', 'true')
    const list = screen.getByRole('listbox', { name: 'Category' })
    expect(within(list).getAllByRole('option').map((option) => option.textContent)).toEqual(['Cat Litter'])
    expect(field).toHaveAttribute('aria-activedescendant', within(list).getByRole('option').id)
    expect(screen.getByText('1 suggestions')).toHaveAttribute('role', 'status')
    await user.keyboard('{Enter}')
    expect(field).toHaveValue('Cat Litter')
    expect(dialog).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(patches(fetchSpy)).toEqual([{ categoryId: '00000000-0000-4000-8001-000000000007' }])
  })

  it('ranks labels that start with the text first and moves with the arrows', async () => {
    const { dialog, user } = await openProductForm()
    const field = within(dialog).getByRole('combobox', { name: 'Category *' })
    await user.clear(field)
    await user.type(field, 'cat')
    const names = within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent)
    expect(names).toEqual(['Cat Cans & Treats', 'Cat Snacks', 'Cat Litter', 'Cat Scratchers', 'Dry Cat Food'])
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('option', { name: 'Cat Litter' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}')
    expect(screen.getByRole('option', { name: 'Dry Cat Food' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Enter}')
    expect(field).toHaveValue('Dry Cat Food')
  })

  it('closes only the list on Escape and puts back the last choice', async () => {
    const { dialog, user } = await openProductForm()
    const field = within(dialog).getByRole('combobox', { name: 'Category *' })
    // Typing over the selected text (clearing first would empty the field: an empty field has no value).
    await user.tripleClick(field)
    await user.keyboard('zzz')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(within(dialog).getByText('No matches', { selector: 'p' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(field).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(field).toHaveValue(firstCategory.name.en)
  })

  it('never keeps text that names no option, and picks an exact label on Tab', async () => {
    const { dialog, user, fetchSpy } = await openProductForm()
    const field = within(dialog).getByRole('combobox', { name: 'Category *' })
    await user.tripleClick(field)
    await user.keyboard('Something new')
    await user.tab()
    expect(field).toHaveValue(firstCategory.name.en)
    await user.clear(field)
    await user.type(field, 'birds')
    await user.tab()
    expect(field).toHaveValue('Birds')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(patches(fetchSpy)).toEqual([{ categoryId: '00000000-0000-4000-8001-000000000012' }])
  })

  it('opens on a click, picks with the mouse, and an emptied required field is refused', async () => {
    const { dialog, user, fetchSpy } = await openProductForm()
    const brand = within(dialog).getByRole('combobox', { name: 'Brand' })
    await user.click(brand)
    expect(screen.getByRole('listbox', { name: 'Brand' })).toBeInTheDocument()
    const category = within(dialog).getByRole('combobox', { name: 'Category *' })
    await user.clear(category)
    await user.tab()
    expect(category).toHaveValue('')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(category).toHaveAccessibleDescription('Required')
    await user.type(category, 'rod')
    await user.click(screen.getByRole('option', { name: 'Rodents' }))
    expect(category).toHaveValue('Rodents')
    expect(category).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(patches(fetchSpy)).toEqual([{ categoryId: '00000000-0000-4000-8001-000000000011' }])
  })

  it('searches the Hebrew names on the Hebrew page and speaks Hebrew', async () => {
    const { dialog, user } = await openProductForm('/admin/products', first.name.he)
    const field = within(dialog).getByRole('combobox', { name: 'קטגוריה *' })
    expect(field).toHaveValue(firstCategory.name.he)
    await user.clear(field)
    await user.type(field, 'ציפ')
    expect(screen.getByRole('option', { name: 'ציפורים' })).toBeInTheDocument()
    await user.clear(field)
    await user.type(field, 'קקק')
    expect(within(dialog).getByText('אין תוצאות', { selector: 'p' })).toBeInTheDocument()
  })
})

describe('SearchableField, free', () => {
  it('keeps any text and fills in a picked suggestion', async () => {
    const onChange = vi.fn()
    const { user } = renderComponent(<FreeField onChange={onChange} />, 'en')
    const field = await screen.findByRole('combobox', { name: 'Fruit' })
    await user.type(field, 'apple')
    const names = within(screen.getByRole('listbox', { name: 'Fruit' })).getAllByRole('option').map((option) => option.textContent)
    // Starts with, then a word starting with it, then contains, then the detail.
    expect(names).toEqual(['AppleGreen or red', 'Red Apple', 'Pineapple', 'BananaRich in apple-like flavour'])
    expect(field).not.toHaveAttribute('aria-activedescendant')
    expect(onChange).toHaveBeenLastCalledWith('apple', null)
    await user.keyboard('{Enter}')
    expect(field).toHaveValue('apple')
    await user.click(screen.getByRole('option', { name: /^Red Apple/ }))
    expect(field).toHaveValue('Red Apple')
    expect(onChange).toHaveBeenLastCalledWith('Red Apple', FRUIT[2])
    await user.clear(field)
    await user.type(field, 'Mango')
    expect(field).toHaveAttribute('aria-expanded', 'false')
    await user.tab()
    expect(screen.getByText('Mango', { selector: 'output' })).toBeInTheDocument()
  })

  it('searches the server after a pause, shows the results and aborts an older search', async () => {
    const signals: AbortSignal[] = []
    const loadOptions = vi.fn((query: string, signal: AbortSignal) => {
      signals.push(signal)
      return new Promise<SearchOption[]>((resolve) => setTimeout(() => resolve(FRUIT.filter((fruit) => fruit.label.toLowerCase().includes(query.toLowerCase()))), 20))
    })
    const { user } = renderComponent(<FreeField loadOptions={loadOptions} />, 'en')
    const field = await screen.findByRole('combobox', { name: 'Fruit' })
    await user.click(field)
    expect(loadOptions).not.toHaveBeenCalled()
    await user.type(field, 'ban')
    expect(await screen.findByRole('option', { name: /^Banana/ })).toBeInTheDocument()
    expect(loadOptions).toHaveBeenLastCalledWith('ban', expect.any(AbortSignal))
    expect(signals.slice(0, -1).every((signal) => signal.aborted)).toBe(true)
    await user.keyboard('{ArrowDown}{Enter}')
    expect(field).toHaveValue('Banana')
  })

  it('shows "Searching" and a failed search', async () => {
    let fail: (reason: Error) => void = () => {}
    const loadOptions = () => new Promise<SearchOption[]>((_, reject) => (fail = reject))
    const { user } = renderComponent(<FreeField loadOptions={loadOptions} />, 'en')
    await user.type(await screen.findByRole('combobox', { name: 'Fruit' }), 'x')
    expect(await screen.findByText('Searching…', { selector: 'p' })).toBeInTheDocument()
    fail(new Error('offline'))
    // A free field has nothing to suggest after a failure, so the list closes.
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false'))
  })

  it('a strict server search asks for text first and reports a failure', async () => {
    const loadOptions = vi.fn(() => Promise.reject(new Error('offline')))
    const { user } = renderComponent(
      <>
        <label htmlFor="supplier">Supplier</label>
        <SearchableField id="supplier" label="Supplier" value="" strict loadOptions={loadOptions} debounceMs={0} onChange={() => {}} />
      </>,
      'en',
    )
    const field = await screen.findByRole('combobox', { name: 'Supplier' })
    await user.click(field)
    expect(screen.getByText('Type to search', { selector: 'p' })).toBeInTheDocument()
    await user.type(field, 'a')
    expect(await screen.findByText('The search failed. Please try again.', { selector: 'p' })).toBeInTheDocument()
  })
})
