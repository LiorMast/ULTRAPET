/**
 * ProductPage.test.tsx — Tests for the product page (/products/$slug, routes/products.$slug.tsx): the breadcrumbs,
 * title, details, gallery, description HTML, shipping and returns notes and related products in Hebrew and English;
 * no price for visitors and the customer's price once signed in; the head tags; "not found" for an unknown
 * product; and the catalog cards that lead to it.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TEST_USER } from '@/test/api'
import { renderPage } from '@/test/utils'
import brands from '@/stubs/brands.json'
import categories from '@/stubs/product-categories.json'
import products from '@/stubs/products.json'
import prices from '@/stubs/prices.json'

/** A product with a gallery of 3+ photos, a shown brand, an item code and a description. */
const product = products.find(
  (p) => p.images.length >= 3 && p.sku && p.description.he && brands.some((b) => b.slug === p.brand && b.active !== false),
)!
const brand = brands.find((b) => b.slug === product.brand)!
const category = categories.find((c) => c.slug === product.category)!
/** The product's page URL (the slug holds Hebrew words). */
const url = `/products/${encodeURIComponent(product.slug)}`
/** The products "You may also like" shows: the next 4 of the category, wrapping round. */
const siblings = products.filter((p) => p.category === product.category)
const at = siblings.indexOf(product)
const related = [...siblings.slice(at + 1), ...siblings.slice(0, at)].slice(0, 4)

describe('Product page', () => {
  it('shows the product like the old store did, without a price for visitors (Hebrew)', async () => {
    await renderPage(url)
    expect(screen.getByRole('heading', { level: 1, name: product.name.he })).toBeInTheDocument()

    const trail = screen.getByRole('navigation', { name: 'נתיב ניווט' })
    expect(within(trail).getByRole('link', { name: 'דף הבית' })).toHaveAttribute('href', '/')
    expect(within(trail).getByRole('link', { name: category.name.he })).toHaveAttribute('href', `/catalog?category=${category.slug}`)
    expect(within(trail).getByText(product.name.he)).toHaveAttribute('aria-current', 'page')

    const details = screen.getByText('מותג:').closest('dl')!
    expect(within(details).getByRole('link', { name: brand.name })).toHaveAttribute('href', `/brands/${brand.slug}`)
    expect(details).toHaveTextContent(`מק"ט:${product.sku}`)

    expect(screen.getByRole('heading', { level: 2, name: 'תיאור המוצר' })).toBeInTheDocument()
    expect(document.querySelector('.rich-text')!.innerHTML).toBe(product.description.he)
    expect(screen.getByText('עד 3 ימי עסקים')).toBeInTheDocument()
    expect(screen.getByText('בהתאם למדיניות ההחזרות, דרך הסוכן')).toBeInTheDocument()

    // The product's own price slot plus one per related card.
    expect(screen.getAllByRole('link', { name: 'התחברו לצפייה במחיר' })).toHaveLength(1 + related.length)
    expect(screen.getByRole('main').textContent).not.toMatch(/₪/)
  })

  it('suggests the next products of the category, each linking to its page', async () => {
    await renderPage(url)
    const section = screen.getByRole('region', { name: 'אולי תאהבו גם' })
    const cards = within(section).getAllByRole('article')
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual(related.map((p) => p.name.he))
    expect(within(cards[0]).getByRole('link', { name: related[0].name.he })).toHaveAttribute('href', `/products/${encodeURIComponent(related[0].slug)}`)
  })

  it('switches the large photo with the thumbnails', async () => {
    const { user } = await renderPage(url)
    const gallery = screen.getByRole('group', { name: 'תמונות המוצר' })
    const total = product.images.length
    const thumbs = within(gallery).getAllByRole('button')
    expect(thumbs).toHaveLength(total)
    expect(thumbs[0]).toHaveAttribute('aria-pressed', 'true')
    expect(within(gallery).getAllByRole('img')[0]).toHaveAttribute('src', `/api/media/${product.images[0].src}`)

    await user.click(within(gallery).getByRole('button', { name: `הצגת תמונה 2 מתוך ${total}` }))
    expect(thumbs[1]).toHaveAttribute('aria-pressed', 'true')
    expect(thumbs[0]).toHaveAttribute('aria-pressed', 'false')
    expect(within(gallery).getAllByRole('img')[0]).toHaveAttribute('src', `/api/media/${product.images[1].src}`)
  })

  it('is translated, with its title, canonical and Product + BreadcrumbList JSON-LD (English)', async () => {
    await renderPage(`/en${url}`)
    expect(screen.getByRole('heading', { level: 1, name: product.name.en })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Product description' })).toBeInTheDocument()
    expect(document.querySelector('.rich-text')!.innerHTML).toBe(product.description.en)
    expect(screen.getByRole('region', { name: 'You may also like' })).toBeInTheDocument()

    await waitFor(() => expect(document.title).toBe(`${product.name.en} | Ultra Pet Israel`))
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', `https://www.ultrapet.co.il/en${url}`)
    const description = document.querySelector('meta[name="description"]')!.getAttribute('content')!
    expect(description.length).toBeLessThanOrEqual(160)
    expect(description).not.toMatch(/[<>]/)
    const [ld, crumbs] = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent!))
    expect(ld).toMatchObject({ '@type': 'Product', name: product.name.en, sku: product.sku, brand: { name: brand.name } })
    expect(ld).not.toHaveProperty('offers')
    expect(ld.image[0]).toBe(`https://www.ultrapet.co.il/api/media/${product.images[0].src}`)
    expect(crumbs['@type']).toBe('BreadcrumbList')
    expect(crumbs.itemListElement.map((item: { name: string }) => item.name)).toEqual(['Home', 'All products', category.name.en, product.name.en])
  })

  it("shows a signed-in customer's price", async () => {
    const price = prices.prices[product.id as keyof typeof prices.prices]
    await renderPage(url, { user: TEST_USER })
    const formatted = new Intl.NumberFormat('he', { style: 'currency', currency: 'ILS' }).format(price).replace(/\s+/g, ' ')
    await waitFor(() => expect(screen.getByRole('main')).toHaveTextContent(formatted))
    expect(screen.queryByRole('link', { name: 'התחברו לצפייה במחיר' })).not.toBeInTheDocument()
  })

  it('shows "not found" for an unknown product', async () => {
    await renderPage('/en/products/no-such-product')
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  })

  it('opens from its catalog card', async () => {
    const { user, router } = await renderPage('/en/catalog')
    const first = products[0]
    await user.click(screen.getByRole('link', { name: first.name.en }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/products/${first.slug}`))
    expect(await screen.findByRole('heading', { level: 1, name: first.name.en })).toBeInTheDocument()
  })
})
