/**
 * Faq.test.tsx — Tests for the home page FAQ section: heading and questions in both languages, the first answer
 * open on load, one answer open at a time, the contact link, the FAQPage JSON-LD in the head, and custom
 * questions via props.
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Faq } from '@/components/Faq'
import { FAQ_ITEMS } from '@/config'
import { renderComponent, renderPage } from '@/test/utils'

/** The FAQ section of the rendered page. */
const section = () => document.getElementById('faq')!

describe('FAQ section', () => {
  it('shows the heading and every question, the first one open (Hebrew)', async () => {
    await renderPage('/')
    const faq = within(section())
    expect(faq.getByRole('heading', { level: 2, name: 'כל מה שחשוב לדעת' })).toBeInTheDocument()
    expect(faq.getAllByRole('button', { expanded: false })).toHaveLength(FAQ_ITEMS.length - 1)
    expect(faq.getByRole('button', { name: 'האם אתם מוכרים ללקוחות פרטיים?' })).toHaveAttribute('aria-expanded', 'true')
    expect(faq.getByRole('region', { name: 'האם אתם מוכרים ללקוחות פרטיים?' })).toHaveTextContent(/מכירה סיטונאית בלבד/)
    expect(faq.getByRole('link', { name: /דברו איתנו/ })).toHaveAttribute('href', '/#contact')
  })

  it('opens one answer at a time (English)', async () => {
    await renderPage('/en')
    const faq = within(section())
    const user = userEvent.setup()
    await user.click(faq.getByRole('button', { name: 'Is there a minimum order?' }))
    expect(faq.getByRole('region', { name: 'Is there a minimum order?' })).toHaveTextContent('₪2,000')
    expect(faq.getByRole('button', { name: 'Do you sell to private customers?' })).toHaveAttribute('aria-expanded', 'false')
    expect(faq.getByRole('link', { name: /Talk to us/ })).toHaveAttribute('href', '/en#contact')
  })

  it('puts every question and answer in the head as FAQPage data', async () => {
    await renderPage('/en')
    await waitFor(() => expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull())
    const data = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent ?? ''))
    const faq = data.find((d) => d['@type'] === 'FAQPage')
    expect(faq.mainEntity).toHaveLength(FAQ_ITEMS.length)
    expect(faq.mainEntity[3]).toEqual({ '@type': 'Question', name: 'Is there a minimum order?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, the minimum order is ₪2,000.' } })
  })

  it('renders custom questions given by props, all closed when asked', async () => {
    renderComponent(<Faq items={[{ id: 'x', question: () => 'Only question', answer: () => 'Only answer' }]} defaultOpen={null} />, 'en')
    expect(await screen.findByRole('button', { name: 'Only question' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Only answer')).not.toBeInTheDocument()
  })
})
