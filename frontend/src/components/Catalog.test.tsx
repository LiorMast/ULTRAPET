/**
 * Catalog.test.tsx — Tests for the catalog page (/catalog), built from Catalog, CatalogCard and Pagination:
 * no prices for visitors who are not signed in, prices for signed-in customers in both languages, paging
 * through real links, category chips, search (in either language), product translations, the empty state,
 * the page-number window, and the head tags.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { pageWindow } from '@/components/Pagination'
import { renderPage } from '@/test/utils'
import products from '@/stubs/products.json'
import prices from '@/stubs/prices.json'

/** The product cards currently shown. */
const cards = () => within(screen.getByRole('list', { name: /^(מוצרים|Products)$/ })).getAllByRole('article')

/** The product names currently shown. */
const names = () => cards().map((card) => within(card).getByRole('heading').textContent)

/** A signed-in business customer. */
const customer = { email: 'shop@example.com' }

describe('Catalog page', () => {
  it('shows the first 24 products without any price to visitors (Hebrew)', async () => {
    await renderPage('/catalog')
    expect(screen.getByRole('heading', { level: 1, name: 'כל המוצרים שלנו' })).toBeInTheDocument()
    expect(names()).toEqual(products.slice(0, 24).map((p) => p.name.he))
    expect(screen.getByRole('status')).toHaveTextContent(`מציג 1–24 מתוך ${products.length} מוצרים`)
    expect(screen.getByRole('main').textContent).not.toMatch(/₪|\d+\.\d\d/)
    expect(within(cards()[0]).getByRole('link', { name: 'התחברו לצפייה במחיר' })).toHaveAttribute('href', '/login')
    expect(screen.getByText('מחירים סיטונאיים ללקוחות עסקיים')).toBeInTheDocument()
  })

  it('pages with real links and marks the current page', async () => {
    const { user } = await renderPage('/catalog')
    const pages = screen.getByRole('navigation', { name: 'עמודים' })
    expect(within(pages).getByRole('link', { name: 'עמוד 1' })).toHaveAttribute('aria-current', 'page')
    expect(within(pages).getByRole('link', { name: 'עמוד 2' })).toHaveAttribute('href', '/catalog?page=2')
    expect(within(pages).queryByRole('link', { name: 'לעמוד הקודם' })).not.toBeInTheDocument()

    await user.click(within(pages).getByRole('link', { name: 'לעמוד הבא' }))
    await waitFor(() => expect(names()[0]).toBe(products[24].name.he))
    const after = screen.getByRole('navigation', { name: 'עמודים' })
    expect(within(after).getByRole('link', { name: 'עמוד 2' })).toHaveAttribute('aria-current', 'page')
    expect(within(after).getByRole('link', { name: 'עמוד 1' })).not.toHaveAttribute('aria-current')
  })

  it('filters by category with chip links that keep counts', async () => {
    const birds = products.filter((p) => p.category === 'birds')
    const { user } = await renderPage('/en/catalog?page=3')
    const chips = screen.getByRole('navigation', { name: 'Filter by category' })
    const chip = within(chips).getByRole('link', { name: 'Birds' })
    expect(chip).toHaveTextContent(`Birds${birds.length}`)
    expect(chip).toHaveAttribute('href', '/en/catalog?category=birds')
    await user.click(chip)
    await waitFor(() => expect(names()).toEqual(birds.map((p) => p.name.en)))
    expect(within(chips).getByRole('link', { name: 'Birds' })).toHaveAttribute('aria-current', 'page')
    expect(within(chips).getByRole('link', { name: 'All' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument()
  })

  it('searches as you type, back to page 1, and shows an empty state', async () => {
    const { user, router } = await renderPage('/catalog?page=2')
    await user.type(screen.getByRole('searchbox', { name: 'חיפוש מוצר' }), 'internutri')
    const expected = products.filter((p) => [p.name.he, p.name.en, p.description.he, p.description.en].join(' ').toLowerCase().includes('internutri'))
    await waitFor(() => expect(names()).toEqual(expected.slice(0, 24).map((p) => p.name.he)))
    expect(router.state.location.search).toEqual({ q: 'internutri' })

    await user.type(screen.getByRole('searchbox', { name: 'חיפוש מוצר' }), 'zzzz')
    expect(await screen.findByText('לא נמצאו מוצרים. נסו חיפוש או קטגוריה אחרים.')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'ניקוי הסינון' }))
    await waitFor(() => expect(screen.getByRole('searchbox', { name: 'חיפוש מוצר' })).toHaveValue(''))
    expect(cards()).toHaveLength(24)
  })

  it('shows the English translation of every product on English pages', async () => {
    await renderPage('/en/catalog')
    expect(names()).toEqual(products.slice(0, 24).map((p) => p.name.en))
    expect(products.every((p) => p.name.en && (p.description.en || !p.description.he))).toBe(true)
  })

  it('finds products by a word in either language', async () => {
    const salmon = products.filter((p) => [p.name.he, p.name.en, p.description.he, p.description.en].join(' ').toLowerCase().includes('salmon'))
    const { user } = await renderPage('/catalog')
    await user.type(screen.getByRole('searchbox', { name: 'חיפוש מוצר' }), 'salmon')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(`מתוך ${salmon.length} מוצרים`))
    // A product whose Hebrew text never says "salmon" is found through its English translation.
    expect(salmon.some((p) => !`${p.name.he} ${p.description.he}`.toLowerCase().includes('salmon'))).toBe(true)
  })

  it('shows wholesale prices to a signed-in customer (Hebrew and English)', async () => {
    const first = prices.prices[products[0].id as keyof typeof prices.prices]
    const { unmount } = await renderPage('/catalog', { user: customer })
    /** Formats a price the way the card does, with whitespace normalized like toHaveTextContent does. */
    const format = (locale: string) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS' }).format(first).replace(/\s+/g, ' ')
    const he = format('he')
    await waitFor(() => expect(cards()[0]).toHaveTextContent(he))
    expect(cards()[0]).toHaveTextContent('לפני מע"מ')
    expect(screen.queryByText('מחירים סיטונאיים ללקוחות עסקיים')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'התחברו לצפייה במחיר' })).not.toBeInTheDocument()
    unmount()

    await renderPage('/en/catalog', { user: customer })
    const en = format('en')
    await waitFor(() => expect(cards()[0]).toHaveTextContent(`${en}excl. VAT`))
  })

  it('sets the title, canonical (category + page, no search) and JSON-LD', async () => {
    await renderPage('/en/catalog?category=beds&page=2&q=bed')
    await waitFor(() => expect(document.title).toBe('Pet product catalog | Ultra Pet Israel'))
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.ultrapet.co.il/en/catalog?category=beds&page=2')
    const types = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent!)['@type'])
    expect(types).toEqual(['CollectionPage', 'BreadcrumbList'])
  })

  it('is linked from the Products menu', async () => {
    const { user } = await renderPage('/en')
    await user.click(screen.getByRole('button', { name: 'Products' }))
    expect(await screen.findByRole('menuitem', { name: 'Product catalog' })).toHaveAttribute('href', '/en/catalog')
  })
})

describe('pageWindow', () => {
  it('keeps the first, last and nearby pages and gaps the rest', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3])
    expect(pageWindow(1, 17)).toEqual([1, 2, null, 17])
    expect(pageWindow(9, 17)).toEqual([1, null, 8, 9, 10, null, 17])
    expect(pageWindow(4, 17)).toEqual([1, 2, 3, 4, 5, null, 17])
  })
})
