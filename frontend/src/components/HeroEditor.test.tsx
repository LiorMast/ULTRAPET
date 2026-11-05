/**
 * HeroEditor.test.tsx — Tests for the staff's hero editing on the real home page against the fake API
 * (src/test/api.ts): who sees the edit buttons; the two-language dialog (what it starts from, saving: create first,
 * then update, the hero showing the saved texts, fonts and sizes, the fonts offered per language, a refused save);
 * and editing in place (one Save for every text, the page's language only, the other language kept).
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createStaffRow } from '@/api'
import { signInFakeUser, TEST_STAFF, TEST_USER } from '@/test/api'
import { renderPage } from '@/test/utils'

/**
 * The request bodies sent with a method.
 * @param spy - The fetch spy.
 * @param method - E.g. "POST".
 * @returns The [url, parsed body] pairs, oldest first.
 */
const sent = (spy: { mock: { calls: [RequestInfo | URL, RequestInit?][] } }, method: string) =>
  spy.mock.calls.filter(([, init]) => init?.method === method).map(([url, init]) => [String(url), JSON.parse(String(init?.body))] as const)

/**
 * The fields of one text in one language inside the open dialog.
 * @param text - The text's group name, e.g. "Title".
 * @param language - The language's group name, e.g. "English".
 * @returns The language's group.
 */
const fieldsOf = (text: string, language: string) => within(within(screen.getByRole('dialog')).getByRole('group', { name: text })).getByRole('group', { name: language })

describe('HeroEditor', () => {
  it('is not shown to visitors', async () => {
    await renderPage('/en')
    expect(screen.queryByRole('button', { name: 'Edit both languages' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Edit on page/ })).not.toBeInTheDocument()
  })

  it('is not shown to business customers', async () => {
    await renderPage('/en', { user: TEST_USER })
    expect(screen.queryByRole('button', { name: 'Edit both languages' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Edit on page/ })).not.toBeInTheDocument()
  })

  it('lets staff edit every text in place and save them at once, in the page language only', async () => {
    signInFakeUser(TEST_STAFF)
    await createStaffRow('page-sections', { key: 'hero', content: { tagline: { text: { he: 'שורה בעברית' } } } })
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await user.click(screen.getByRole('button', { name: 'Edit on page: Hero' }))
    // The dialog's button steps aside while editing in place.
    expect(screen.queryByRole('button', { name: 'Edit both languages' })).not.toBeInTheDocument()

    // One style bar, on the title first; it follows the focused box.
    expect(screen.getByRole('toolbar', { name: 'Text style' })).toHaveTextContent('Editing: Title words')
    await user.type(screen.getByRole('textbox', { name: 'Tagline' }), 'Wholesale only')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tagline font' }), 'Assistant')
    await user.type(screen.getByRole('textbox', { name: 'Red word' }), 'Group')
    expect(screen.getByRole('toolbar')).toHaveTextContent('Editing: Title words')
    await user.click(screen.getByRole('textbox', { name: 'Description' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Description size' }), 'Small')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Ultra Group' })).toBeInTheDocument()
    expect(screen.getByText('Wholesale only')).toHaveClass('text-lg')
    expect(screen.getByText(/^Supplying premium pet brands/)).toHaveClass('text-sm')
    expect(screen.getByRole('button', { name: 'Edit on page: Hero' })).toHaveFocus()
    const patches = sent(fetchSpy, 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0][1].content.tagline.text).toEqual({ he: 'שורה בעברית', en: 'Wholesale only' })
    expect(patches[0][1].content.title.accent).toEqual({ en: 'Group' })
    expect(patches[0][1].content.tagline.font).toEqual({ en: 'assistant' })
    expect(patches[0][1].content.description.size).toEqual({ en: 'sm' })
    expect(patches[0][1].content.title.size).toEqual({ en: 'md' })
  })

  it('lets staff change the texts, fonts and sizes, creating the section on the first save', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await user.click(screen.getByRole('button', { name: 'Edit both languages' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit the hero' })

    // Nothing saved yet: empty texts with the built-in ones as placeholders, the site's font, the design size.
    const englishTitle = fieldsOf('Title', 'English')
    expect(within(englishTitle).getByRole('textbox', { name: 'Title words' })).toHaveValue('')
    expect(within(englishTitle).getByRole('textbox', { name: 'Title words' })).toHaveAttribute('placeholder', 'Ultra')
    expect(within(englishTitle).getByRole('combobox', { name: 'Font' })).toHaveValue('default')
    expect(within(englishTitle).getByRole('combobox', { name: 'Size' })).toHaveValue('md')

    await user.type(within(englishTitle).getByRole('textbox', { name: 'Title words' }), 'Premium')
    await user.selectOptions(within(englishTitle).getByRole('combobox', { name: 'Font' }), 'Frank Ruhl Libre')
    await user.selectOptions(within(englishTitle).getByRole('combobox', { name: 'Size' }), 'Large')
    await user.type(within(fieldsOf('Description', 'עברית')).getByRole('textbox', { name: 'Text' }), 'מכירה סיטונאית')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const heading = await screen.findByRole('heading', { level: 1, name: 'Premium Pet' })
    expect(heading.style.fontFamily).toContain('Frank Ruhl Libre')
    expect(heading).toHaveClass('text-[clamp(3.4rem,8.5vw,7.5rem)]')
    expect(screen.getByText('Changes saved.')).toHaveAttribute('role', 'status')
    expect(screen.getByRole('button', { name: 'Edit both languages' })).toHaveFocus()

    const [[url, body]] = sent(fetchSpy, 'POST')
    expect(url).toBe('/api/staff/page-sections')
    expect(body.key).toBe('hero')
    expect(body.content.title).toEqual({
      text: { en: 'Premium' },
      accent: {},
      font: { he: 'default', en: 'frank-ruhl-libre' },
      size: { he: 'md', en: 'lg' },
    })
    expect(body.content.description.text).toEqual({ he: 'מכירה סיטונאית' })

    // The second save changes the stored row and starts from what was saved.
    await user.click(screen.getByRole('button', { name: 'Edit both languages' }))
    await screen.findByRole('dialog')
    const title = within(fieldsOf('Title', 'English')).getByRole('textbox', { name: 'Title words' })
    expect(title).toHaveValue('Premium')
    await user.clear(title)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Ultra Pet' })).toBeInTheDocument()
    expect(sent(fetchSpy, 'PATCH').map(([path]) => path)).toEqual(['/api/staff/page-sections/hero'])
  })

  it('shows what staff saved before to every visitor', async () => {
    signInFakeUser(TEST_STAFF)
    await createStaffRow('page-sections', { key: 'hero', content: { tagline: { text: { he: 'שורה חדשה' }, size: { he: 'xl' } } } })
    await renderPage('/')
    expect(screen.getByText('שורה חדשה')).toHaveClass('text-2xl', 'lg:text-3xl')
  })

  it('offers Hebrew texts only the fonts with Hebrew letters', async () => {
    const { user } = await renderPage('/', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'עריכה בשתי השפות' }))
    await screen.findByRole('dialog')
    const options = (language: string) =>
      within(within(fieldsOf('כותרת', language)).getByRole('combobox', { name: 'גופן' }))
        .getAllByRole('option')
        .map((option) => option.textContent)
    expect(options('עברית')).toEqual(['ברירת המחדל של האתר', 'Heebo', 'Rubik', 'Assistant', 'Frank Ruhl Libre'])
    expect(options('English')).toEqual(['ברירת המחדל של האתר', 'Heebo', 'Rubik', 'Assistant', 'Frank Ruhl Libre', 'Inter', 'Montserrat'])
  })

  it('shows a refused save and keeps the dialog open', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Edit both languages' }))
    const dialog = await screen.findByRole('dialog')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid', field: 'content' }), { status: 400 }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
