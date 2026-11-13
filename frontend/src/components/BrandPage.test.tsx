/**
 * BrandPage.test.tsx — Tests for the brand page (/brands/$slug, routes/brands.$slug.tsx): the breadcrumbs, tagline,
 * name, description and details (product count, categories into the filtered catalog) in Hebrew and English; the
 * first products as catalog cards (no price for visitors, the customer's price once signed in); "View all" links to
 * the catalog filtered by the brand; the other brands; the head tags; "not found" for an unknown or hidden brand;
 * and the home page brand card that leads to it.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TEST_USER } from '@/test/api'
import { renderPage } from '@/test/utils'
import brands from '@/stubs/brands.json'
import categories from '@/stubs/product-categories.json'
import products from '@/stubs/products.json'
import prices from '@/stubs/prices.json'

/** A shown brand with many products (more than the page shows) and a description. */
const brand = brands.find((b) => b.slug === 'jr-farm')!
/** The brand's products in the catalog's staff order. */
const brandProducts = products.filter((p) => p.brand === brand.slug)
/** The 8 the page shows. */
const shown = brandProducts.slice(0, 8)
/** The categories the brand's products are in, in the categories' order. */
const brandCategories = categories.filter((c) => brandProducts.some((p) => p.category === c.slug))
/** The other shown brands. */
const others = brands.filter((b) => b.active !== false && b.slug !== brand.slug)

describe('Brand page', () => {
  it('shows the brand, its details and its first products (Hebrew)', async () => {
    await renderPage(`/brands/${brand.slug}`)
    expect(screen.getByRole('heading', { level: 1, name: brand.name })).toBeInTheDocument()
    expect(screen.getByText(brand.tagline.he)).toBeInTheDocument()
    expect(screen.getByText(brand.description!.he)).toBeInTheDocument()

    const trail = screen.getByRole('navigation', { name: 'נתיב ניווט' })
    expect(within(trail).getByRole('link', { name: 'דף הבית' })).toHaveAttribute('href', '/')
    expect(within(trail).getByRole('link', { name: 'מותגים' })).toHaveAttribute('href', '/#brands')
    expect(within(trail).getByText(brand.name)).toHaveAttribute('aria-current', 'page')

    const details = screen.getByText('מוצרים:').closest('dl')!
    expect(details).toHaveTextContent(`מוצרים:${brandProducts.length}`)
    for (const category of brandCategories) {
      expect(within(details).getByRole('link', { name: category.name.he })).toHaveAttribute(
        'href',
        `/catalog?brand=${brand.slug}&category=${category.slug}`,
      )
    }
    expect(screen.getByRole('link', { name: `לכל ${brandProducts.length} המוצרים` })).toHaveAttribute('href', `/catalog?brand=${brand.slug}`)
    expect(screen.getByRole('link', { name: 'הפוך ללקוח עסקי' })).toHaveAttribute('href', '/#business')

    const section = screen.getByRole('region', { name: `המוצרים של ${brand.name}` })
    const cards = within(section).getAllByRole('article')
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual(shown.map((p) => p.name.he))
    expect(within(section).getByRole('link', { name: 'לכל המוצרים' })).toHaveAttribute('href', `/catalog?brand=${brand.slug}`)
    expect(within(section).getAllByRole('link', { name: 'התחברו לצפייה במחיר' }).length).toBe(shown.length)
  })

  it('lists the other brands, without this one', async () => {
    await renderPage(`/en/brands/${brand.slug}`)
    const section = screen.getByRole('region', { name: 'More brands' })
    for (const other of others) {
      expect(within(section).getByRole('link', { name: new RegExp(other.name) })).toHaveAttribute('href', `/en/brands/${other.slug}`)
    }
    expect(within(section).queryByRole('link', { name: new RegExp(brand.name) })).not.toBeInTheDocument()
  })

  it('is in English at /en, with its head tags', async () => {
    await renderPage(`/en/brands/${brand.slug}`)
    expect(screen.getByRole('heading', { level: 1, name: brand.name })).toBeInTheDocument()
    expect(screen.getByText(brand.description!.en)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: `Products of ${brand.name}` })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `View all ${brandProducts.length} products` })).toHaveAttribute('href', `/en/catalog?brand=${brand.slug}`)

    await waitFor(() => expect(document.title).toBe(`${brand.name} | Ultra Pet Israel`))
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', `https://www.ultrapet.co.il/en/brands/${brand.slug}`)
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', brand.description!.en)
    const [ld, crumbs] = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent!))
    expect(ld).toMatchObject({ '@type': 'Brand', name: brand.name, slogan: brand.tagline.en, url: `https://www.ultrapet.co.il/en/brands/${brand.slug}` })
    expect(crumbs.itemListElement.map((item: { name: string }) => item.name)).toEqual(['Home', 'Brands', brand.name])
  })

  it("shows a signed-in customer's prices on the cards", async () => {
    const price = prices.prices[String(shown[0].id) as keyof typeof prices.prices]
    await renderPage(`/brands/${brand.slug}`, { user: TEST_USER })
    const formatted = new Intl.NumberFormat('he', { style: 'currency', currency: 'ILS' }).format(price).replace(/\s+/g, ' ')
    await waitFor(() => expect(screen.getByRole('region', { name: `המוצרים של ${brand.name}` })).toHaveTextContent(formatted))
    expect(screen.queryByRole('link', { name: 'התחברו לצפייה במחיר' })).not.toBeInTheDocument()
  })

  it('shows "not found" for an unknown or hidden brand', async () => {
    await renderPage('/en/brands/no-such-brand')
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    await renderPage('/en/brands/yagu')
    expect(screen.getAllByRole('heading', { level: 1, name: 'Page not found' }).length).toBeGreaterThan(0)
  })

  it('opens from its home page card', async () => {
    const { user, router } = await renderPage('/en')
    const section = document.getElementById('brands')!
    await user.click(within(section).getByRole('link', { name: new RegExp(brands[0].name) }))
    expect(await screen.findByRole('heading', { level: 1, name: brands[0].name })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/brands/${brands[0].slug}`)
  })
})
