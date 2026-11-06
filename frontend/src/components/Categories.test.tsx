/**
 * Categories.test.tsx — Tests for the home page Categories section and its CategoryCard: the catalog categories from
 * the API (the database's active ones, in order) as cards in both languages, each a real link to the catalog filtered
 * by it; the photo staff set on a category, the icon panel without one; a hidden category left out; and editing in
 * place limited to the heading (the cards stay links showing the database's names).
 */
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fetchStaffRows, updateStaffRow, type ProductCategory } from '@/api'
import { Categories } from '@/components/Categories'
import categories from '@/stubs/product-categories.json'
import { signInFakeUser, TEST_STAFF } from '@/test/api'
import { renderComponent, renderPage } from '@/test/utils'

/** The section's queries. */
const section = () => within(document.getElementById('categories')!)

/**
 * Changes one category through the fake staff API (as /admin/categories does).
 * @param slug - The category.
 * @param changes - The changed fields.
 */
async function changeCategory(slug: string, changes: Record<string, unknown>) {
  signInFakeUser(TEST_STAFF)
  const rows = await fetchStaffRows<{ id: string; slug: string }>('categories')
  await updateStaffRow('categories', rows.find((row) => row.slug === slug)!.id, changes)
}

describe('Categories section', () => {
  it('shows the catalog categories in order as links to the catalog (Hebrew)', async () => {
    await renderPage('/')
    expect(section().getByRole('heading', { level: 2, name: 'כל מה שחיית המחמד צריכה' })).toBeInTheDocument()
    expect(section().getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(categories.map((c) => `/catalog?category=${c.slug}`))
    expect(section().getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(categories.map((c) => c.name.he))
  })

  it('uses the /en prefix and the English names in English', async () => {
    await renderPage('/en')
    expect(section().getByRole('link', { name: 'Cat Litter' })).toHaveAttribute('href', '/en/catalog?category=cat-litter')
    expect(section().getByRole('region', { name: 'Product categories' })).toBeInTheDocument()
  })

  it('shows the photo staff set on a category, and the icon panel for one without', async () => {
    await changeCategory('birds', { imageUrl: 'https://example.com/birds.jpg' })
    await renderPage('/en')
    expect(section().getByRole('link', { name: 'Birds' }).querySelector('img')).toHaveAttribute('src', 'https://example.com/birds.jpg')
    const plain = section().getByRole('link', { name: 'Rodents' })
    expect(plain.querySelector('img')).toBeNull()
    expect(plain.querySelector('svg')).not.toBeNull()
  })

  it('leaves out a category staff hid', async () => {
    await changeCategory('plastics', { isActive: false })
    await renderPage('/en')
    expect(section().queryByRole('link', { name: 'Plastics' })).not.toBeInTheDocument()
    expect(section().getAllByRole('link')).toHaveLength(categories.length - 1)
  })

  it('lets staff edit only the heading; the cards stay links with the database names', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    await user.click(section().getByRole('button', { name: 'Edit on page: Product Categories' }))
    expect(section().getAllByRole('textbox').map((box) => box.getAttribute('aria-label'))).toEqual(['Eyebrow', 'Title', 'Intro'])
    expect(section().getByRole('link', { name: 'Cat Litter' })).toHaveAttribute('href', '/en/catalog?category=cat-litter')
    await user.type(section().getByRole('textbox', { name: 'Title' }), 'Our range')
    await user.click(section().getByRole('button', { name: 'Save' }))
    expect(await section().findByRole('heading', { level: 2, name: 'Our range' })).toBeInTheDocument()
    expect(section().getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(categories.map((c) => c.name.en))
  })

  it('renders a custom list given by props', async () => {
    const custom: ProductCategory[] = [{ slug: 'birds', name: { he: 'ציפורים', en: 'Custom' }, legacyPath: null, imageUrl: '/photo.jpg' }]
    renderComponent(<Categories categories={custom} />, 'en')
    const link = await screen.findByRole('link', { name: 'Custom' })
    expect(link.querySelector('img')).toHaveAttribute('src', '/photo.jpg')
  })
})
