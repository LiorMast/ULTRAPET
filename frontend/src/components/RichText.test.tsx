/**
 * RichText.test.tsx — Tests for RichText: it renders the stored HTML as elements, and marks a text in another
 * language than the page's with its language and direction.
 */
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RichText } from '@/components/RichText'
import { renderComponent } from '@/test/utils'

describe('RichText', () => {
  it('renders the HTML as headings, lists and tables', async () => {
    renderComponent(<RichText html="<h2>Composition</h2>\n<ul><li>Beef 28%</li></ul>\n<table><tr><td>10 kg</td></tr></table>" />, 'en')
    expect(await screen.findByRole('heading', { level: 2, name: 'Composition' })).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('Beef 28%')
    expect(screen.getByRole('cell', { name: '10 kg' })).toBeInTheDocument()
  })

  it('marks a text in another language with its language and direction', async () => {
    renderComponent(<RichText html="<p>טעים</p>" lang="he" />, 'en')
    const text = (await screen.findByText('טעים')).parentElement!
    expect(text).toHaveAttribute('lang', 'he')
    expect(text).toHaveAttribute('dir', 'rtl')
  })
})
