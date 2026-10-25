/**
 * Categories.test.tsx — Tests for the home page Categories section and its CategoryCard: six cards in
 * order, each a real link to its category page, texts in both languages, the icon fallback for a category
 * without a photo, and a custom list via props.
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
    expect(within(section).getByText('300+ מוצרים')).toBeInTheDocument()
  })

  it('uses the /en prefix and English texts in English', async () => {
    await renderPage('/en')
    const section = document.getElementById('categories')!
    expect(within(section).getAllByRole('link')[1]).toHaveAttribute('href', '/en/categories/cat-food')
    expect(within(section).getByText('250+ products')).toBeInTheDocument()
    expect(within(section).getByRole('region', { name: 'Product categories' })).toBeInTheDocument()
  })

  it('shows the icon panel for categories without a photo file', async () => {
    await renderPage('/')
    const cards = within(document.getElementById('categories')!).getAllByRole('link')
    expect(cards.every((a) => a.querySelector('img') === null)).toBe(true)
    expect(cards.every((a) => a.querySelector('svg') !== null)).toBe(true)
  })

  it('renders a custom list given by props, with a photo when the category has one', async () => {
    const categories: Category[] = [
      { slug: 'birds', label: () => 'Custom', description: () => 'Desc', skuCount: '9+', icon: Bird, image: '/photo.jpg' },
    ]
    renderComponent(<Categories categories={categories} />, 'en')
    const link = await screen.findByRole('link', { name: /Custom/ })
    expect(link.querySelector('img')).toHaveAttribute('src', '/photo.jpg')
    expect(screen.getByText('9+ products')).toBeInTheDocument()
  })
})
