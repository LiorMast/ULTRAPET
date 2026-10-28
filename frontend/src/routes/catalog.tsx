/**
 * routes/catalog.tsx — The product catalog page (/catalog): all products from the store, filterable by
 * category and search text, 24 per page. The URL holds the state: ?category=dry-dog-food&q=salmon&page=2.
 *
 * Prices: the public product data never contains prices. For a signed-in business customer (useAuth) the
 * route loads the prices separately (stubs/prices.json, standing in for the signed-in-only prices API of
 * Phase 4) and passes them to <Catalog>; signed-out visitors get "log in to see the price" on every card.
 * The stub's prices are PLACEHOLDERS, not real prices.
 *
 * SEO: title, description, canonical (keeps category and page, drops the search text), hreflang and
 * CollectionPage + BreadcrumbList JSON-LD. No price ever appears in the head tags.
 */
import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/auth'
import { Catalog, type CatalogPrices, type CatalogSearch } from '@/components/Catalog'
import type { Product, ProductCategory } from '@/config'
import { dictionaryFor, localizePath } from '@/i18n'
import { absoluteUrl, breadcrumbJsonLd, pageHead } from '@/seo'
import categoriesData from '@/stubs/product-categories.json'
import productsData from '@/stubs/products.json'

/**
 * The products (from the WooCommerce store export). Backend phase: GET /api/products. Only the page
 * component may use it: the router code-splits the component, so the large product list stays out of the
 * main bundle (validateSearch and head are not split).
 */
const PRODUCTS = productsData as Product[]

/** The store's 15 categories, in display order. Backend phase: GET /api/product-categories. */
const CATEGORIES = categoriesData as ProductCategory[]

/**
 * Loads the prices of a signed-in customer. Stub: a dynamic import, so the price file is fetched only after
 * sign-in and is not part of the public page code. Phase 4: an authenticated API call.
 * @returns Product id → price in shekels (before VAT).
 */
async function fetchPrices(): Promise<Record<string, number>> {
  const { default: data } = await import('@/stubs/prices.json')
  return data.prices
}

/**
 * Turns the URL state into a query string for canonical links: category and page only (search results are
 * not separate pages for search engines).
 * @param search - The catalog URL state.
 * @returns E.g. "?category=birds&page=2", or "" for the first unfiltered page.
 */
function canonicalQuery({ category, page }: CatalogSearch) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (page && page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const Route = createFileRoute('/catalog')({
  validateSearch: (raw: Record<string, unknown>): CatalogSearch => {
    const page = Number(raw.page)
    const category = typeof raw.category === 'string' && CATEGORIES.some((c) => c.slug === raw.category) ? raw.category : undefined
    const q = typeof raw.q === 'string' && raw.q.trim() ? raw.q.trim() : undefined
    return { page: Number.isInteger(page) && page > 1 ? page : undefined, category, q }
  },
  head: ({ match }) => {
    const { locale } = match.context
    const t = dictionaryFor(locale)
    const path = `/catalog${canonicalQuery(match.search)}`
    return pageHead({
      locale,
      path,
      title: t.catalog.metaTitle,
      description: t.catalog.description,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: t.catalog.title,
          description: t.catalog.description,
          url: absoluteUrl(localizePath(path, locale)),
          inLanguage: locale,
        },
        breadcrumbJsonLd(locale, [
          { name: t.articles.home, path: '/' },
          { name: t.nav.fullCatalog, path: '/catalog' },
        ]),
      ],
    })
  },
  component: CatalogPage,
})

/**
 * The catalog page: loads prices when a customer is signed in, then renders the catalog.
 * @returns The Catalog with the products, categories, URL state and (signed in) prices.
 */
function CatalogPage() {
  const search = Route.useSearch()
  const { user } = useAuth()
  const [loaded, setLoaded] = useState<{ email: string; prices: Record<string, number> } | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchPrices().then((prices) => {
      if (!cancelled) setLoaded({ email: user.email, prices })
    })
    return () => {
      cancelled = true
    }
  }, [user])

  // Prices belong to the customer they were loaded for; anything else is still loading (or signed out).
  const prices: CatalogPrices | undefined = !user
    ? undefined
    : loaded?.email === user.email
      ? { status: 'loaded', prices: loaded.prices }
      : { status: 'loading' }

  return <Catalog products={PRODUCTS} categories={CATEGORIES} search={search} prices={prices} />
}
