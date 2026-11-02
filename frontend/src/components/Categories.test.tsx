/**
 * Categories.test.tsx — Tests for the home page Categories section and its CategoryCard: six cards in
 * order, each a real link to its category page, titles in both languages, no description/count/explore
 * text, the icon fallback for a category without a photo, and a custom list via props.
 */
import { screen, within } from '@testing-library/react'
import { Bird } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { Categories } from '@/components/Categories'
import type { Category } from '@/config'
import { renderComponent, renderPage } from '@/test/utils'

const SLUGS = ['dog-food', 'cat-food', 'wet-food', 'litter', 'small-animals', 'birds']

describe('Categories section', () => {
  it('shows the six categories in order as links to their pages (Hebrew)', async () => {
    await renderPage('/')
    const section = document.getElementById('categories')!
    expect(within(section).getByRole('heading', { level: 2, name: 'כל מה שחיית המחמד צריכה' })).toBeInTheDocument()
    expect(within(section).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(SLUGS.map((s) => `/categories/${s}`))
    expect(within(section).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'מזון לכלבים', 'מזון לחתולים', 'מזון רטוב ומעדנים', 'חול לחתולים', 'בעלי חיים קטנים', 'בעלי כנף',
    ])
    expect(within(section).queryByText(/\d+\+ מוצרים/)).not.toBeInTheDocument()
  })

  it('uses the /en prefix and English texts in English', async () => {
    await renderPage('/en')
    const section = document.getElementById('categories')!
    expect(within(section).getAllByRole('link')[1]).toHaveAttribute('href', '/en/categories/cat-food')
    expect(within(section).queryByText(/\d+\+ products|Explore category/)).not.toBeInTheDocument()
    expect(within(section).getByRole('region', { name: 'Product categories' })).toBeInTheDocument()
  })

  it('covers each card with a placeholder photo from the catalog', async () => {
    await renderPage('/')
    const cards = within(document.getElementById('categories')!).getAllByRole('link')
    expect(cards.every((a) => a.querySelector('img')?.getAttribute('src')?.startsWith('https://'))).toBe(true)
  })

  it('shows the icon panel for a category without a photo', async () => {
    const categories: Category[] = [{ slug: 'birds', label: () => 'Plain', icon: Bird }]
    renderComponent(<Categories categories={categories} />, 'en')
    const link = await screen.findByRole('link', { name: 'Plain' })
    expect(link.querySelector('img')).toBeNull()
    expect(link.querySelector('svg')).not.toBeNull()
  })

  it('renders a custom list given by props, with a photo when the category has one', async () => {
    const categories: Category[] = [
      { slug: 'birds', label: () => 'Custom', icon: Bird, image: '/photo.jpg' },
    ]
    renderComponent(<Categories categories={categories} />, 'en')
    const link = await screen.findByRole('link', { name: /Custom/ })
    expect(link.querySelector('img')).toHaveAttribute('src', '/photo.jpg')
  })
})
