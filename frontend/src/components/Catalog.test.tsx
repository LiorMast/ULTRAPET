/**
 * Catalog.test.tsx — Tests for the catalog page (/catalog), built from Catalog, CatalogCard and Pagination:
 * no prices for visitors who are not signed in, prices for signed-in customers in both languages, paging
 * through real links, category chips, search (in either language), product translations, the empty state,
 * the page-number window, the head tags, product photos served from our own file storage, and the toolbar: sorts
 * (the price ones for customers only), the brand filter with its counts, a customer's price range, the filter pills.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { pageWindow } from '@/components/Pagination'
import { TEST_USER } from '@/test/api'
import { renderPage } from '@/test/utils'
import products from '@/stubs/products.json'
import prices from '@/stubs/prices.json'

/** The product cards currently shown. */
const cards = () => within(screen.getByRole('list', { name: /^(מוצרים|Products)$/ })).getAllByRole('article')

/** The product names currently shown. */
const names = () => cards().map((card) => within(card).getByRole('heading').textContent)

/** A signed-in business customer. */
const customer = TEST_USER

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

  it("loads the product photos from the site's own file storage, never from the old WordPress store", async () => {
    await renderPage('/catalog')
    const photo = cards()[0].querySelector('img')!
    expect(photo).toHaveAttribute('src', `/api/media/${products[0].images[0].thumbnail}`)
    for (const card of cards()) {
      const img = card.querySelector('img')!
      for (const url of [img.getAttribute('src'), ...(img.getAttribute('srcset') ?? '').split(',').map((entry) => entry.trim().split(' ')[0])]) {
        expect(url).toMatch(/^\/api\/media\/products\//)
      }
    }
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

  it('is linked from the Products menu (its label and its first entry)', async () => {
    const { user } = await renderPage('/en')
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/en/catalog')
    await user.hover(screen.getByRole('link', { name: 'Products' }))
    expect(await screen.findByRole('menuitem', { name: 'All products' })).toHaveAttribute('href', '/en/catalog')
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

describe('Catalog sorting and filters', () => {
  /** The customer's stub price of a product (undefined = none). */
  const priceOf = (id: string) => (prices.prices as Record<string, number>)[id]

  it('sorts by name in the page language from the sort menu, back to page 1', async () => {
    const { user, router } = await renderPage('/en/catalog?page=2')
    await user.click(screen.getByRole('button', { name: 'Sort: Recommended' }))
    const options = (await screen.findAllByRole('menuitemradio')).map((option) => option.textContent)
    // Visitors get no price sorts: the order would give the prices away.
    expect(options).toEqual(['Recommended', 'Name: A to Z', 'Name: Z to A', 'Newest first'])
    await user.click(screen.getByRole('menuitemradio', { name: 'Name: Z to A' }))
    await waitFor(() => expect(router.state.location.search).toEqual({ sort: 'name-desc' }))
    const expected = products.map((p) => p.name.en).sort((a, b) => b.toLowerCase().localeCompare(a.toLowerCase()))
    await waitFor(() => expect(names()).toEqual(expected.slice(0, 24)))
    expect(screen.getByRole('button', { name: 'Sort: Name: Z to A' })).toBeInTheDocument()
  })

  it('lists the newest products first (the highest WooCommerce id)', async () => {
    await renderPage('/catalog?sort=newest')
    const expected = [...products].sort((a, b) => Number(b.id) - Number(a.id))
    expect(names()).toEqual(expected.slice(0, 24).map((p) => p.name.he))
  })

  it('ignores price sorts and ranges for visitors, and unknown URL values', async () => {
    await renderPage('/catalog?sort=price-asc&min=10&max=50&brand=No_Such,paw')
    expect(screen.getByRole('button', { name: 'מיון: מומלץ' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^מחיר/ })).not.toBeInTheDocument()
    expect(names()).toEqual(products.filter((p) => p.brand === 'paw').map((p) => p.name.he))
  })

  it('filters by several brands with counts, shows them as removable pills, and clears them', async () => {
    const paw = products.filter((p) => p.brand === 'paw')
    const farm = products.filter((p) => p.brand === 'jr-farm')
    const { user, router } = await renderPage('/en/catalog')
    const toolbar = screen.getByRole('group', { name: 'Sort and filter' })
    await user.click(within(toolbar).getByRole('button', { name: 'Brand' }))
    const pawItem = await screen.findByRole('menuitemcheckbox', { name: /^Paw/ })
    expect(pawItem).toHaveTextContent(`Paw${paw.length}`)
    await user.click(pawItem)
    await waitFor(() => expect(names()).toEqual(paw.map((p) => p.name.en)))
    // The menu stays open, so a second brand is one more click.
    await user.click(screen.getByRole('menuitemcheckbox', { name: /^JR Farm/ }))
    await waitFor(() => expect(router.state.location.search).toEqual({ brand: 'paw,jr-farm' }))
    const both = products.filter((p) => p.brand === 'paw' || p.brand === 'jr-farm')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(`of ${both.length} products`))
    await user.keyboard('{Escape}')
    expect(within(toolbar).getByRole('button', { name: 'Brand (2)' })).toBeInTheDocument()

    const pills = screen.getByRole('list', { name: 'Active filters' })
    await user.click(within(pills).getByRole('button', { name: 'Remove filter: Paw' }))
    await waitFor(() => expect(router.state.location.search).toEqual({ brand: 'jr-farm' }))
    await waitFor(() => expect(names()).toEqual(farm.slice(0, 24).map((p) => p.name.en)))

    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    await waitFor(() => expect(router.state.location.search).toEqual({}))
    expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument()
  })

  it('counts each brand within the chosen category', async () => {
    const { user } = await renderPage('/en/catalog?category=birds')
    await user.click(screen.getByRole('button', { name: 'Brand' }))
    const birds = products.filter((p) => p.category === 'birds')
    for (const [slug, name] of [['jr-farm', 'JR Farm'], ['paw', 'Paw']]) {
      const count = birds.filter((p) => p.brand === slug).length
      const item = await screen.findByRole('menuitemcheckbox', { name: new RegExp(`^${name}`) })
      expect(item).toHaveTextContent(`${name}${count}`)
      if (count === 0) expect(item).toHaveAttribute('aria-disabled', 'true')
    }
  })

  it('lets a customer sort by their price, the products without a price last', async () => {
    const { user } = await renderPage('/en/catalog', { user: customer })
    await user.click(screen.getByRole('button', { name: 'Sort: Recommended' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Price: high to low' }))
    const priced = products.filter((p) => priceOf(p.id) !== undefined).sort((a, b) => priceOf(b.id) - priceOf(a.id))
    await waitFor(() => expect(names()).toEqual(priced.slice(0, 24).map((p) => p.name.en)))
  })

  it('lets a customer filter by a price range, shown as a pill', async () => {
    const { user, router } = await renderPage('/en/catalog', { user: customer })
    await user.click(screen.getByRole('button', { name: 'Price' }))
    await user.type(await screen.findByRole('spinbutton', { name: 'Minimum price' }), '50')
    await user.type(screen.getByRole('spinbutton', { name: 'Maximum price' }), '100')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(router.state.location.search).toEqual({ min: 50, max: 100 }))
    const inRange = products.filter((p) => priceOf(p.id) >= 50 && priceOf(p.id) <= 100)
    await waitFor(() => expect(screen.getByText(/^Showing \d/)).toHaveTextContent(`of ${inRange.length} products`))
    expect(names()).toEqual(inRange.slice(0, 24).map((p) => p.name.en))
    const pills = screen.getByRole('list', { name: 'Active filters' })
    expect(within(pills).getByRole('button', { name: /^Remove filter: ₪50\.00 – ₪100\.00$/ })).toBeInTheDocument()

    await user.click(within(pills).getAllByRole('button')[0])
    await waitFor(() => expect(router.state.location.search).toEqual({}))
  })
})
