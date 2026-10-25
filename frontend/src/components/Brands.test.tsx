/**
 * Brands.test.tsx — Tests for the home page Brands section and its BrandCard: six cards in order, each a
 * real link to the brand page, texts in both languages, logo vs. wordmark, and a custom list via props.
 */
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Brands } from '@/components/Brands'
import type { Brand } from '@/config'
import { renderComponent, renderPage } from '@/test/utils'

const NAMES = ['Ultra Pet', 'Internutri', 'Greenheart Premiums', 'Paw', 'JR Farm', 'Ultra Clean']

describe('Brands section', () => {
  it('shows the six brands in order as links to their pages (Hebrew)', async () => {
    await renderPage('/')
    const section = document.getElementById('brands')!
    expect(within(section).getByRole('heading', { level: 2, name: 'מותגי פרימיום מהיצרנים המובילים בעולם' })).toBeInTheDocument()
    const links = within(section).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      ['ultra-pet', 'internutri', 'greenheart', 'paw', 'jr-farm', 'ultra-clean'].map((s) => `/brands/${s}`),
    )
    expect(links.map((a) => within(a).getByRole('heading', { level: 3 }).textContent)).toEqual(NAMES)
    expect(within(links[0]).getByText('תזונה פרמיום מלאה')).toBeInTheDocument()
  })

  it('uses the /en prefix and English texts in English', async () => {
    await renderPage('/en')
    const section = document.getElementById('brands')!
    expect(within(section).getAllByRole('link')[1]).toHaveAttribute('href', '/en/brands/internutri')
    expect(within(section).getByText('Science-Based Formulas')).toBeInTheDocument()
    expect(within(section).getByRole('heading', { level: 2, name: /Premium brands/ })).toBeInTheDocument()
  })

  it('shows a logo image for brands that have a logo file, and a text wordmark for the rest', async () => {
    await renderPage('/')
    const cards = within(document.getElementById('brands')!).getAllByRole('link')
    const withLogo = cards.filter((a) => a.querySelector('img'))
    expect(withLogo).toHaveLength(3)
    expect(cards[3].querySelector('img')).toBeNull()
  })

  it('renders any list of brands passed in', () => {
    const brands: Brand[] = [{ slug: 'ultra-pet', name: 'Only One', accent: '#000000', tagline: () => 'Just me' }]
    renderComponent(<Brands brands={brands} />, 'en')
    return screen.findByRole('heading', { level: 3, name: 'Only One' }).then(() => {
      expect(screen.getAllByRole('link')).toHaveLength(1)
    })
  })
})
