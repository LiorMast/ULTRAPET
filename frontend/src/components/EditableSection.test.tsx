/**
 * EditableSection.test.tsx — Tests for editing the home page sections in place (EditableSection.tsx) on the real home
 * page against the fake API (src/test/api.ts): the edit buttons (staff only, one per section); each section's save
 * (Brands: the heading's words, font and size (Categories' heading-only editing is in Categories.test.tsx); About:
 * a pillar and the closing paragraph, in the page language only; Stats: the numbers and suffixes into the settings,
 * a number that is not a whole number refused; Contact: the details into the settings and every link that uses them,
 * an invalid email refused; FAQ: the heading together with the questions); the style bar only for the heading's
 * texts; and the pure helpers sectionDraft / mergeSection.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createStaffRow } from '@/api'
import { mergeSection, sectionDraft, type SectionOptions } from '@/components/EditableSection'
import { signInFakeUser, TEST_STAFF } from '@/test/api'
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
 * A home page section by its anchor id.
 * @param id - E.g. "brands".
 * @returns Queries bound to the section.
 */
const sectionOf = (id: string) => within(document.getElementById(id)!)

/** The content the fake API serves for one section now. */
const servedSection = async (key: string) => ((await (await fetch('/api/sections')).json()) as Record<string, Record<string, { text?: Record<string, string> }>>)[key]

describe('home page sections edited in place', () => {
  it('gives staff one edit button per section, and visitors none', async () => {
    await renderPage('/en')
    expect(screen.queryAllByRole('button', { name: /^Edit on page/ })).toHaveLength(0)
  })

  it('lists an edit button for every section for staff', async () => {
    await renderPage('/en', { staff: TEST_STAFF })
    const names = screen.getAllByRole('button', { name: /^Edit on page/ }).map((button) => button.getAttribute('aria-label'))
    expect(names).toEqual([
      'Edit on page: Hero',
      'Edit on page: Ultra Pet in numbers',
      'Edit on page: Our Brands',
      'Edit on page: Product Categories',
      'Edit on page: About Ultra Pet',
      'Edit on page: FAQ',
      'Edit on page: Contact',
    ])
  })

  it('leaves edit mode in every section when staff sign out while editing', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Edit on page: Hero' }))
    await user.click(screen.getByRole('button', { name: 'Edit on page: About Ultra Pet' }))
    await user.click(screen.getByRole('button', { name: 'Edit on page: FAQ' }))
    await user.type(sectionOf('about').getByRole('textbox', { name: 'Closing paragraph' }), 'Unsaved words')
    expect(screen.getAllByRole('toolbar', { name: 'Text style' }).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Main menu' })).getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(screen.queryAllByRole('button', { name: /^Edit on page/ })).toHaveLength(0))
    for (const id of ['home', 'about', 'faq']) expect(sectionOf(id).queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryByRole('toolbar', { name: 'Text style' })).not.toBeInTheDocument()
    expect(screen.queryByText('Unsaved words')).not.toBeInTheDocument()
    expect(sectionOf('faq').getByRole('button', { name: 'Do you sell to private customers?' })).toBeInTheDocument()
  })

  it('saves the Brands heading with its font and size, creating the section on the first save', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const brands = sectionOf('brands')
    await user.click(brands.getByRole('button', { name: 'Edit on page: Our Brands' }))
    expect(brands.getByRole('toolbar', { name: 'Text style' })).toHaveTextContent('Editing: Eyebrow')
    const title = brands.getByRole('textbox', { name: 'Title' })
    expect(title).toHaveValue('')
    expect(title).toHaveAttribute('placeholder', "Premium brands from the world's leading manufacturers")
    await user.type(title, 'Our partners')
    await user.selectOptions(brands.getByRole('combobox', { name: 'Title size' }), 'Large')
    await user.click(brands.getByRole('button', { name: 'Save' }))

    const heading = await brands.findByRole('heading', { level: 2, name: 'Our partners' })
    expect(heading).toHaveClass('text-5xl', 'text-white')
    expect(brands.getByRole('button', { name: 'Edit on page: Our Brands' })).toHaveFocus()
    const posts = sent(fetchSpy, 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0][1].key).toBe('brands')
    expect(posts[0][1].content.title).toEqual({ text: { en: 'Our partners' }, font: { en: 'default' }, size: { en: 'lg' } })
    // The other texts are stored empty, so they keep showing the dictionary's words.
    expect(posts[0][1].content.eyebrow.text).toEqual({})
    expect(brands.getByText('Our Brands')).toBeInTheDocument()
  })

  it('saves About texts in the page language only and keeps the other language', async () => {
    signInFakeUser(TEST_STAFF)
    await createStaffRow('page-sections', { key: 'about', content: { closing: { text: { he: 'סיום בעברית' } } } })
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const about = sectionOf('about')
    await user.click(about.getByRole('button', { name: 'Edit on page: About Ultra Pet' }))
    await user.type(about.getByRole('textbox', { name: 'Text: Professional expertise' }), 'Decades of know-how.')
    await user.type(about.getByRole('textbox', { name: 'Closing paragraph' }), 'We look forward to working with you.')
    await user.click(about.getByRole('button', { name: 'Save' }))

    expect(await about.findByText('Decades of know-how.')).toBeInTheDocument()
    expect(about.getByText('We look forward to working with you.')).toBeInTheDocument()
    const saved = await servedSection('about')
    expect(saved['pillar.expertise.text'].text).toEqual({ en: 'Decades of know-how.' })
    expect(saved.closing.text).toEqual({ he: 'סיום בעברית', en: 'We look forward to working with you.' })
  })

  it('saves a dragged width of a section text in the page language, and gives the data texts no handle', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const about = sectionOf('about')
    await user.click(about.getByRole('button', { name: 'Edit on page: About Ultra Pet' }))
    about.getByRole('slider', { name: 'Width: Closing paragraph' }).focus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    await user.click(about.getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await servedSection('about')).closing).toEqual({ text: {}, width: { en: 90 } }))

    const contact = sectionOf('contact')
    await user.click(contact.getByRole('button', { name: /^Edit on page/ }))
    const handles = contact.getAllByRole('slider').map((slider) => slider.getAttribute('aria-label'))
    expect(handles).toContain('Width: Title')
    expect(handles.some((name) => /phone|email|whatsapp/i.test(name ?? '') && !/label|sub/i.test(name ?? ''))).toBe(false)
  })

  it('cancels without saving and keeps the old texts', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const about = sectionOf('about')
    await user.click(about.getByRole('button', { name: 'Edit on page: About Ultra Pet' }))
    await user.type(about.getByRole('textbox', { name: 'Title: Vision & mission' }), 'Changed')
    await user.click(about.getByRole('button', { name: 'Cancel' }))
    expect(about.getByRole('heading', { level: 3, name: 'Vision & mission' })).toBeInTheDocument()
    expect(sent(fetchSpy, 'POST')).toHaveLength(0)
  })

  it('saves the stats numbers and suffixes to the settings and refuses a number that is not whole', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const stats = sectionOf('stats')
    await user.click(stats.getByRole('button', { name: 'Edit on page: Ultra Pet in numbers' }))
    const retail = stats.getByRole('textbox', { name: 'Number: Retail locations' })
    expect(retail).toHaveValue('350')
    await user.clear(retail)
    await user.type(retail, '4.5')
    await user.click(stats.getByRole('button', { name: 'Save' }))
    expect(await stats.findByRole('alert')).toHaveTextContent('Enter a whole number, in digits only.')
    expect(retail).toHaveFocus()
    expect(sent(fetchSpy, 'PATCH')).toHaveLength(0)

    await user.clear(retail)
    await user.type(retail, '400')
    const suffix = stats.getByRole('textbox', { name: 'Suffix: Retail locations' })
    await user.clear(suffix)
    await user.type(suffix, ' % ')
    await user.type(stats.getByRole('textbox', { name: 'Label: Retail locations' }), 'Points of sale')
    await user.click(stats.getByRole('button', { name: 'Save' }))

    // The number shows twice: the visible one and the screen readers' copy.
    expect(await stats.findAllByText('400%')).toHaveLength(2)
    expect(stats.getByText('Points of sale')).toBeInTheDocument()
    expect(sent(fetchSpy, 'PATCH').map(([url, body]) => [url, body])).toEqual([
      ['/api/staff/settings/stat_retail_value', { value: 400 }],
      ['/api/staff/settings/stat_retail_suffix', { value: '%' }],
    ])
    expect((await servedSection('stats'))['label.retail'].text).toEqual({ en: 'Points of sale' })
  })

  it('saves the contact details to the settings; the cards and the WhatsApp button follow', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const contact = sectionOf('contact')
    expect(contact.getByRole('link', { name: /1700-55-99-92/ })).toHaveAttribute('href', 'tel:1700559992')
    await user.click(contact.getByRole('button', { name: 'Edit on page: Contact' }))
    const email = contact.getByRole('textbox', { name: 'Email address' })
    await user.clear(email)
    await user.type(email, 'not-an-email')
    await user.click(contact.getByRole('button', { name: 'Save' }))
    expect(await contact.findByRole('alert')).toHaveTextContent('Enter a valid email address.')
    expect(email).toHaveFocus()

    await user.clear(email)
    await user.type(email, 'sales@ultrapet.co.il')
    const whatsapp = contact.getByRole('textbox', { name: 'WhatsApp number' })
    await user.clear(whatsapp)
    await user.type(whatsapp, '+972 50-123-4567')
    await user.type(contact.getByRole('textbox', { name: 'Sub-line: Email' }), 'Answered within a day')
    await user.click(contact.getByRole('button', { name: 'Save' }))

    expect(await contact.findByRole('link', { name: /sales@ultrapet\.co\.il/ })).toHaveAttribute('href', 'mailto:sales@ultrapet.co.il')
    expect(contact.getByText('Answered within a day')).toBeInTheDocument()
    expect(contact.getByRole('link', { name: /\+972 50-123-4567/ })).toHaveAttribute('href', 'https://wa.me/972501234567')
    await waitFor(() => expect(screen.getByRole('link', { name: /– WhatsApp$/ })).toHaveAttribute('href', 'https://wa.me/972501234567'))
    expect(await (await fetch('/api/contact')).json()).toEqual({ phone: '1700-55-99-92', whatsapp: '+972 50-123-4567', email: 'sales@ultrapet.co.il' })
  })

  it('saves the FAQ heading together with the questions', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const faq = sectionOf('faq')
    await user.click(faq.getByRole('button', { name: 'Edit on page: FAQ' }))
    await user.type(faq.getByRole('textbox', { name: 'Title' }), 'Questions and answers')
    await user.type(faq.getByRole('textbox', { name: 'Title: Still have a question?' }), 'Need more help?')
    await user.click(faq.getByRole('button', { name: 'Save' }))

    expect(await faq.findByRole('heading', { level: 2, name: 'Questions and answers' })).toBeInTheDocument()
    expect(faq.getByRole('heading', { level: 3, name: 'Need more help?' })).toBeInTheDocument()
    expect(sent(fetchSpy, 'PUT')).toHaveLength(1)
    const saved = await servedSection('faq')
    expect(saved.title.text).toEqual({ en: 'Questions and answers' })
    expect(saved.moreTitle).toEqual({ text: { en: 'Need more help?' } })
  })
})

describe('sectionDraft and mergeSection', () => {
  const options: SectionOptions<'title' | 'text' | 'number'> = {
    content: { title: { text: { he: 'כותרת', en: 'Title' }, size: { he: 'lg' } }, text: { text: { he: 'טקסט' } } },
    defaults: { title: 'Built-in title', text: 'Built-in text', number: '350' },
    labels: { title: 'Title', text: 'Text', number: 'Number' },
    styled: ['title'],
    data: { number: '350' },
  }

  it('starts from the saved words of the language (or none), the shown style, and the data values', () => {
    expect(sectionDraft(options, 'he')).toEqual({
      title: { text: 'כותרת', font: 'default', size: 'lg' },
      text: { text: 'טקסט', font: 'default', size: 'md' },
      number: { text: '350', font: 'default', size: 'md' },
    })
    expect(sectionDraft(options, 'en').text.text).toBe('')
  })

  it('reads, writes and removes the widths of every text in one language, never of the data texts', () => {
    const sized: SectionOptions<'title' | 'text' | 'number'> = {
      ...options,
      content: { title: { text: { he: 'כותרת' }, width: { he: 60, en: 70 } }, text: { width: { he: 150 } } },
    }
    // A width outside 20-99 is ignored (full width).
    expect(sectionDraft(sized, 'he')).toEqual({
      title: { text: 'כותרת', font: 'default', size: 'md', width: 60 },
      text: { text: '', font: 'default', size: 'md' },
      number: { text: '350', font: 'default', size: 'md' },
    })
    const merged = mergeSection(sized, 'he', {
      title: { text: 'כותרת', font: 'default', size: 'md' },
      text: { text: 'טקסט', font: 'default', size: 'md', width: 45 },
      number: { text: '400', font: 'default', size: 'md', width: 30 },
    })
    // The title's Hebrew width is removed (full width), its English one kept; the words-only text stores a width too.
    expect(merged.title?.width).toEqual({ en: 70 })
    expect(merged.text).toEqual({ text: { he: 'טקסט' }, width: { he: 45 } })
    expect(merged.number).toBeUndefined()
    // The last width removed: no width map is left.
    expect(mergeSection(sized, 'he', { text: { text: '', font: 'default', size: 'md' } }).text).toEqual({ text: {} })
  })

  it('writes one language back, styles for styled texts only, and leaves out the data texts', () => {
    const merged = mergeSection(options, 'en', {
      title: { text: ' New ', font: 'rubik', size: 'sm' },
      text: { text: '', font: 'default', size: 'md' },
      number: { text: '400', font: 'default', size: 'md' },
    })
    expect(merged).toEqual({
      title: { text: { he: 'כותרת', en: 'New' }, font: { en: 'rubik' }, size: { he: 'lg', en: 'sm' } },
      text: { text: { he: 'טקסט' } },
    })
  })
})
