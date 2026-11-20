/**
 * PrivateLabelPage.test.tsx — Tests for the Private Label page (routes/private-label.tsx, components/PrivateLabelPage.tsx):
 * the h1, breadcrumbs and calls to action in both languages, the capabilities, the process, the product categories,
 * the FAQ accordion with its FAQPage JSON-LD, the header's menu link to the page, and the page head; and the staff's
 * in-place editing of every section (the heading, a capability figure, a product format, the FAQ list, the process
 * shared with the home page), each language kept apart; defaultPageFaq.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FaqItemsContent, FlowStepsContent, SectionContent } from '@/api'
import { defaultPageFaq } from '@/components/PrivateLabelPage'
import { TEST_STAFF } from '@/test/api'
import { renderPage } from '@/test/utils'

/** The "Edit on page" names of the page's sections, in page order. */
const SECTIONS = ['Private label · OEM', 'Our approach', 'Private label', 'Product categories', 'Why Ultra Pet', 'FAQ', 'Call to action']

/**
 * The <section> whose "Edit on page" button has this name.
 * @param name - The section's name, e.g. "Our approach".
 * @returns Queries within it.
 */
const sectionOf = (name: string) => within(screen.getByRole('button', { name: `Edit on page: ${name}` }).closest('section')!)

/** Every section the fake API saved. */
const savedSections = async () => (await (await fetch('/api/sections')).json()) as Record<string, unknown>

describe('Private Label page', () => {
  it('shows the heading, breadcrumbs, calls to action and every part of the page (Hebrew)', async () => {
    await renderPage('/private-label')
    expect(screen.getByRole('heading', { level: 1, name: 'בנו מותג משלכם למוצרי חיות מחמד' })).toBeInTheDocument()
    const crumbs = screen.getByRole('navigation', { name: 'נתיב ניווט' })
    expect(within(crumbs).getByRole('link', { name: 'דף הבית' })).toHaveAttribute('href', '/')
    expect(within(crumbs).getByText('תווית פרטית')).toHaveAttribute('aria-current', 'page')
    const main = within(screen.getByRole('main'))
    expect(main.getAllByRole('link', { name: 'התחילו פרויקט תווית פרטית' })[0]).toHaveAttribute('href', '/#contact')
    expect(main.getByRole('link', { name: 'למותגים שלנו' })).toHaveAttribute('href', '/#brands')

    expect(main.getByText('מפעלים בינלאומיים')).toBeInTheDocument()
    const process = main.getByRole('list', { name: 'שלבי פרויקט תווית פרטית' })
    expect(within(process).getAllByRole('listitem')).toHaveLength(5)
    expect(main.getByRole('heading', { level: 3, name: 'חול לחתולים' })).toBeInTheDocument()
    expect(main.getByRole('heading', { level: 3, name: 'שותף אחד מקצה לקצה' })).toBeInTheDocument()
    // The process is the home section's, read-only: no edit button and no link back to this page.
    expect(main.queryByRole('link', { name: 'עוד על תווית פרטית' })).not.toBeInTheDocument()
  })

  it('opens a FAQ answer and puts the questions in the head (English)', async () => {
    const { user } = await renderPage('/en/private-label')
    expect(screen.getByRole('heading', { level: 1, name: 'Build your own pet product brand' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Can we get a sample before ordering?' }))
    expect(screen.getByRole('region', { name: 'Can we get a sample before ordering?' })).toHaveTextContent(/you approve the product/)

    await waitFor(() => expect(document.title).toBe('Private label pet food and pet products | Ultra Pet Israel'))
    const data = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent ?? ''))
    expect(data.find((d) => d['@type'] === 'FAQPage').mainEntity).toHaveLength(4)
    expect(data.find((d) => d['@type'] === 'BreadcrumbList')).toBeDefined()
  })

  it('gives staff an "Edit on page" button on every section, and visitors none', async () => {
    await renderPage('/en/private-label', { staff: TEST_STAFF })
    const names = screen.getAllByRole('button', { name: /^Edit on page: / }).map((button) => button.getAttribute('aria-label') ?? button.textContent)
    expect(names).toHaveLength(SECTIONS.length)
    for (const name of SECTIONS) expect(screen.getByRole('button', { name: `Edit on page: ${name}` })).toBeInTheDocument()
  })

  it('shows visitors no edit buttons', async () => {
    await renderPage('/en/private-label')
    expect(screen.queryByRole('button', { name: /^Edit on page/ })).not.toBeInTheDocument()
  })

  it('staff edit the page heading in English; Hebrew keeps its own words', async () => {
    const { user } = await renderPage('/en/private-label', { staff: TEST_STAFF })
    const intro = sectionOf('Private label · OEM')
    await user.click(screen.getByRole('button', { name: 'Edit on page: Private label · OEM' }))
    await user.clear(intro.getByRole('textbox', { name: 'Title' }))
    await user.paste('Your brand, made by us')
    await user.click(intro.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Your brand, made by us' })).toBeInTheDocument()

    const saved = (await savedSections()).private_label_page_intro as SectionContent
    expect(saved.title?.text).toEqual({ en: 'Your brand, made by us' })
  })

  it('staff edit a capability figure and a product format', async () => {
    const { user } = await renderPage('/en/private-label', { staff: TEST_STAFF })
    const approach = sectionOf('Our approach')
    await user.click(approach.getByRole('button', { name: 'Edit on page: Our approach' }))
    await user.clear(approach.getByRole('textbox', { name: 'Value: International factories' }))
    await user.paste('20+')
    await user.click(approach.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('20+')).toBeInTheDocument()
    expect(screen.queryByText('15+')).not.toBeInTheDocument()

    const categories = sectionOf('Product categories')
    await user.click(categories.getByRole('button', { name: 'Edit on page: Product categories' }))
    await user.clear(categories.getByRole('textbox', { name: 'Product format 2: Dry food' }))
    await user.paste('Adult dogs and cats')
    await user.click(categories.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Adult dogs and cats')).toBeInTheDocument()

    const saved = await savedSections()
    expect((saved.private_label_page_approach as SectionContent)['capability.factories.value']?.text).toEqual({ en: '20+' })
    expect((saved.private_label_page_categories as SectionContent)['category.dry.format.1']?.text).toEqual({ en: 'Adult dogs and cats' })
  })

  it('staff add and delete FAQ questions; the head follows the saved list', async () => {
    const { user } = await renderPage('/en/private-label', { staff: TEST_STAFF })
    const faq = sectionOf('FAQ')
    await user.click(faq.getByRole('button', { name: 'Edit on page: FAQ' }))
    expect(faq.getAllByRole('textbox', { name: /^Question \d+$/ })).toHaveLength(4)
    await user.click(faq.getByRole('button', { name: 'Delete Question 1' }))
    await user.click(faq.getByRole('button', { name: 'Add a question' }))
    await user.paste('What is the minimum order?')
    await user.click(faq.getByRole('textbox', { name: 'Answer 4' }))
    await user.paste('It depends on the product.')
    await user.click(faq.getByRole('button', { name: 'Save' }))

    expect(await faq.findByRole('button', { name: 'What is the minimum order?' })).toBeInTheDocument()
    expect(faq.queryByRole('button', { name: 'Which products can be made under our brand?' })).not.toBeInTheDocument()
    await waitFor(() => {
      const data = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent ?? ''))
      expect(data.find((d) => d['@type'] === 'FAQPage').mainEntity.map((q: { name: string }) => q.name)).toContain('What is the minimum order?')
    })

    const items = ((await savedSections()).private_label_page_faq_items as FaqItemsContent).items!
    expect(items).toHaveLength(4)
    // The built-in questions kept their Hebrew; the new one has an id and English only.
    expect(items[0]).toMatchObject({ id: 'q2', question: { he: defaultPageFaq()[1].question.he } })
    expect(items[3].id).toMatch(/\S/)
    expect(items[3].question).toEqual({ en: 'What is the minimum order?' })
  })

  it('staff edit the process here, and the home page shows the same steps', async () => {
    const { user } = await renderPage('/en/private-label', { staff: TEST_STAFF })
    const process = sectionOf('Private label')
    await user.click(process.getByRole('button', { name: 'Edit on page: Private label' }))
    await user.clear(process.getByRole('textbox', { name: 'Step 1 title' }))
    await user.paste('Concept')
    await user.click(process.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(process.queryByRole('textbox')).not.toBeInTheDocument())

    const steps = ((await savedSections()).private_label_steps as FlowStepsContent).steps!
    expect(steps[0]).toMatchObject({ id: 'idea', title: { en: 'Concept' } })
    const home = await renderPage('/en')
    expect(within(home.container.querySelector('#private-label') as HTMLElement).getByRole('heading', { level: 3, name: 'Concept' })).toBeInTheDocument()
  })

  it('builds the built-in FAQ in every enabled language', () => {
    const items = defaultPageFaq()
    expect(items.map((item) => item.id)).toEqual(['q1', 'q2', 'q3', 'q4'])
    expect(items[2].question.en).toBe('Can we get a sample before ordering?')
    expect(items[2].question.he).toBeTruthy()
  })

  it('is the header menu’s Private Label link', async () => {
    await renderPage('/en')
    const nav = screen.getByRole('navigation', { name: 'Main menu' })
    expect(within(nav).getByRole('link', { name: 'Private Label' })).toHaveAttribute('href', '/en/private-label')
  })
})
