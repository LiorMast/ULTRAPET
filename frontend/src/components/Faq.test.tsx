/**
 * Faq.test.tsx — Tests for the home page FAQ section: heading and questions from the API in both languages, the first
 * answer open on load, one answer open at a time, the contact link, the FAQPage JSON-LD in the head, custom questions
 * via props, a question shown only in the languages that have both its texts; and the staff's in-place editing:
 * change, add (the plus button) and delete questions and save the list at once, a question without its answer
 * refused, Cancel, the other language as a hint, and mergeFaq.
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FaqItem } from '@/api'
import { Faq, mergeFaq } from '@/components/Faq'
import faq from '@/stubs/faq.json'
import { TEST_STAFF } from '@/test/api'
import { renderComponent, renderPage } from '@/test/utils'

/** The FAQ section of the rendered page. */
const section = () => document.getElementById('faq')!

/** The questions the fake API serves now, every language. */
const servedFaq = async () => (await (await fetch('/api/faq')).json()) as FaqItem[]

/** A text of the editor's draft (FAQ texts have no font or size of their own). */
const plain = (text: string) => ({ text, font: 'default' as const, size: 'md' as const })

describe('FAQ section', () => {
  it('shows the heading and every question, the first one open (Hebrew)', async () => {
    await renderPage('/')
    const faqSection = within(section())
    expect(faqSection.getByRole('heading', { level: 2, name: 'כל מה שחשוב לדעת' })).toBeInTheDocument()
    expect(faqSection.getAllByRole('button', { expanded: false })).toHaveLength(faq.length - 1)
    expect(faqSection.getByRole('button', { name: 'האם אתם מוכרים ללקוחות פרטיים?' })).toHaveAttribute('aria-expanded', 'true')
    expect(faqSection.getByRole('region', { name: 'האם אתם מוכרים ללקוחות פרטיים?' })).toHaveTextContent(/מכירה סיטונאית בלבד/)
    expect(faqSection.getByRole('link', { name: /דברו איתנו/ })).toHaveAttribute('href', '/#contact')
    expect(faqSection.queryByRole('button', { name: /^עריכה בעמוד/ })).not.toBeInTheDocument()
  })

  it('opens one answer at a time (English)', async () => {
    await renderPage('/en')
    const faqSection = within(section())
    const user = userEvent.setup()
    await user.click(faqSection.getByRole('button', { name: 'Is there a minimum order?' }))
    expect(faqSection.getByRole('region', { name: 'Is there a minimum order?' })).toHaveTextContent('₪2,000')
    expect(faqSection.getByRole('button', { name: 'Do you sell to private customers?' })).toHaveAttribute('aria-expanded', 'false')
    expect(faqSection.getByRole('link', { name: /Talk to us/ })).toHaveAttribute('href', '/en#contact')
  })

  it('puts every question and answer in the head as FAQPage data', async () => {
    await renderPage('/en')
    await waitFor(() => expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull())
    const data = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent ?? ''))
    const faqPage = data.find((d) => d['@type'] === 'FAQPage')
    expect(faqPage.mainEntity).toHaveLength(faq.length)
    expect(faqPage.mainEntity[3]).toEqual({ '@type': 'Question', name: 'Is there a minimum order?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, the minimum order is ₪2,000.' } })
  })

  it('renders custom questions given by props, all closed when asked', async () => {
    renderComponent(<Faq items={[{ id: 'x', question: { en: 'Only question' }, answer: { en: 'Only answer' } }]} defaultOpen={null} />, 'en')
    expect(await screen.findByRole('button', { name: 'Only question' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Only answer')).not.toBeInTheDocument()
  })

  it('shows a question only in the languages that have both its texts, keeping its line breaks', async () => {
    const items: FaqItem[] = [
      { id: 'half', question: { he: 'שאלה', en: 'Half translated' }, answer: { he: 'תשובה' } },
      { id: 'full', question: { he: 'שאלה 2', en: 'Fully translated' }, answer: { he: 'תשובה 2', en: 'Line one\nLine two' } },
    ]
    renderComponent(<Faq items={items} />, 'en')
    expect(await screen.findByRole('button', { name: 'Fully translated' })).toBeInTheDocument()
    expect(screen.queryByText('Half translated')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Fully translated' }).firstElementChild).toHaveClass('whitespace-pre-line')
  })

  it('leaves the section out for visitors when no question has the page language', async () => {
    renderComponent(
      <>
        <p>Rendered</p>
        <Faq items={[{ id: 'he', question: { he: 'שאלה' }, answer: { he: 'תשובה' } }]} />
      </>,
      'en',
    )
    await screen.findByText('Rendered')
    expect(document.getElementById('faq')).toBeNull()
  })
})

describe('FAQ in-place editing', () => {
  it('staff change, add and delete questions and save the whole list at once', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const faqSection = within(section())
    await user.click(faqSection.getByRole('button', { name: 'Edit on page: FAQ' }))

    // One wrapping box per question and a box per answer, numbered; the first question is focused.
    expect(faqSection.getAllByRole('textbox', { name: /^Question \d+$/ })).toHaveLength(faq.length)
    expect(faqSection.getByRole('textbox', { name: 'Question 1' })).toHaveFocus()
    expect(faqSection.getByRole('textbox', { name: 'Question 1' })).toHaveValue('Do you sell to private customers?')
    expect(faqSection.queryByRole('toolbar')).not.toBeInTheDocument()

    // The texts are pasted, not typed key by key: every keystroke re-renders the whole home page, which made this
    // test slow enough to time out when every test file runs at once.
    await user.clear(faqSection.getByRole('textbox', { name: 'Question 1' }))
    await user.paste('Do you sell to the public?')

    // The plus button appends an empty question and focuses it.
    await user.click(faqSection.getByRole('button', { name: 'Add a question' }))
    const added = faqSection.getByRole('textbox', { name: `Question ${faq.length + 1}` })
    expect(added).toHaveFocus()
    expect(added).toHaveValue('')
    await user.paste('Do you ship abroad?')
    await user.click(faqSection.getByRole('textbox', { name: `Answer ${faq.length + 1}` }))
    await user.paste('No, within Israel only.')

    // Deleting a question moves the focus to the next one, which takes its number.
    await user.click(faqSection.getByRole('button', { name: 'Delete Question 2' }))
    expect(faqSection.getByRole('textbox', { name: 'Question 2' })).toHaveValue('Where can I see the prices?')
    expect(faqSection.getByRole('textbox', { name: 'Question 2' })).toHaveFocus()

    await user.click(within(section()).getByRole('button', { name: 'Save' }))
    expect(await faqSection.findByRole('button', { name: 'Do you ship abroad?' })).toBeInTheDocument()
    expect(faqSection.getByRole('button', { name: 'Do you sell to the public?' })).toBeInTheDocument()
    expect(faqSection.queryByRole('button', { name: 'How do I open a business account?' })).not.toBeInTheDocument()
    expect(faqSection.queryByRole('textbox')).not.toBeInTheDocument()
    await waitFor(() => expect(faqSection.getByRole('button', { name: 'Edit on page: FAQ' })).toHaveFocus())

    // The other language kept its texts; the new question exists in English only.
    const saved = await servedFaq()
    expect(saved).toHaveLength(faq.length)
    expect(saved[0].question).toEqual({ he: faq[0].question.he, en: 'Do you sell to the public?' })
    expect(saved.at(-1)).toMatchObject({ question: { en: 'Do you ship abroad?' }, answer: { en: 'No, within Israel only.' } })
    expect(saved.at(-1)!.question.he).toBeUndefined()
  })

  it('refuses a question without its answer and focuses the empty box', async () => {
    const onSave = vi.fn()
    const { user } = renderComponent(<Faq items={[{ id: 'a', question: { en: 'Kept' }, answer: { en: 'Yes' } }]} onSave={onSave} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page: FAQ' }))
    await user.click(screen.getByRole('button', { name: 'Add a question' }))
    await user.type(screen.getByRole('textbox', { name: 'Question 2' }), 'No answer yet{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('Every question needs an answer, and every answer a question.')
    expect(screen.getByRole('textbox', { name: 'Answer 2' })).toHaveFocus()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('throws added questions away on Cancel', async () => {
    const onSave = vi.fn()
    const { user } = renderComponent(<Faq items={[{ id: 'a', question: { en: 'Kept' }, answer: { en: 'Yes' } }]} onSave={onSave} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page: FAQ' }))
    await user.click(screen.getByRole('button', { name: 'Add a question' }))
    await user.type(screen.getByRole('textbox', { name: 'Question 2' }), 'Gone')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1)
    expect(screen.queryByText('Gone')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit on page: FAQ' })).toHaveFocus()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('focuses "Add a question" when the last question is deleted, and saves the empty list', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { user } = renderComponent(<Faq items={[{ id: 'a', question: { en: 'Only' }, answer: { en: 'One' } }]} onSave={onSave} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page: FAQ' }))
    await user.click(screen.getByRole('button', { name: 'Delete Question 1' }))
    expect(screen.getByRole('button', { name: 'Add a question' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    // The list goes first; the second argument is the section's own texts (none changed here).
    expect(onSave).toHaveBeenCalledWith([], expect.any(Object))
  })

  it('shows staff a question missing the page language as empty boxes, with the other language as a hint', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const item = { id: 'a', question: { he: 'שאלה בעברית' }, answer: { he: 'תשובה בעברית' } }
    const { user } = renderComponent(<Faq items={[item]} onSave={onSave} />, 'en')
    expect(await screen.findByText('No questions in English yet. Use "Edit on page" to add some.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit on page: FAQ' }))
    expect(screen.getByRole('textbox', { name: 'Question 1' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Question 1' })).toHaveAttribute('placeholder', 'שאלה בעברית')
    expect(screen.getByRole('textbox', { name: 'Answer 1' })).toHaveAttribute('placeholder', 'תשובה בעברית')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    // Left untranslated, the question keeps its Hebrew.
    expect(onSave).toHaveBeenCalledWith([item], expect.any(Object))
  })

  it('merges one language into the list: other languages kept, new questions without an id, empty ones dropped', () => {
    const items: FaqItem[] = [
      { id: 'a', question: { he: 'א', en: 'A' }, answer: { he: 'תא', en: 'Answer A' } },
      { id: 'b', question: { en: 'B' }, answer: { en: 'Answer B' } },
    ]
    const draft = {
      'b:question': plain(' B2 '),
      'b:answer': plain('Answer B'),
      'a:question': plain(''),
      'a:answer': plain(''),
      'new-1:question': plain('New'),
      'new-1:answer': plain('Answer new'),
      'new-2:question': plain(''),
      'new-2:answer': plain(''),
    }
    expect(mergeFaq(items, 'en', draft)).toEqual([
      { id: 'b', question: { en: 'B2' }, answer: { en: 'Answer B' } },
      { id: 'a', question: { he: 'א' }, answer: { he: 'תא' } },
      { question: { en: 'New' }, answer: { en: 'Answer new' } },
    ])
    // A question emptied in its only language is gone.
    expect(mergeFaq([items[1]], 'en', { 'b:question': plain(''), 'b:answer': plain('') })).toEqual([])
  })
})
