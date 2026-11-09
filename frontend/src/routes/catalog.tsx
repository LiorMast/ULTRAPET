/**
 * routes/catalog.tsx — The product catalog page (/catalog): the store's products, filterable by category, brand
 * and search text (and price, for customers), sortable, 24 per page. The URL holds the state:
 * ?category=dry-dog-food&brand=paw,jr-farm&q=salmon&sort=name-asc&min=10&max=90&page=2. The loader fetches the
 * categories, the brands and the matching page from the API (the server filters, searches, sorts and pages), and
 * runs again whenever the URL state changes, or when a customer signs in or out (the price sorts and range are
 * theirs); the previous results stay on screen until the new ones arrive.
 *
 * Prices: the product data never contains prices. For a signed-in business customer (useCustomerPrices) the page loads
 * the customer's prices separately and passes them to <Catalog>; signed-out visitors get "log in
 * to see the price" on every card.
 *
 * SEO: title, description, canonical (keeps category and page, drops the search text, brands, sort and prices), hreflang and
 * CollectionPage + BreadcrumbList JSON-LD. No price ever appears in the head tags.
 */
import { useEffect, useRef } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { CATALOG_SORTS, fetchBrands, fetchCategories, fetchProducts, type CatalogSearch, type CatalogSort } from '@/api'
import { useAuth, useCustomerPrices } from '@/auth'
import { Catalog } from '@/components/Catalog'
import { dictionaryFor, localizePath } from '@/i18n'
import { absoluteUrl, breadcrumbJsonLd, pageHead } from '@/seo'

/** What a category slug in the URL may look like (the server ignores slugs it does not know). */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

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

/**
 * Reads a shekel amount of the price range from the URL.
 * @param value - The raw search value (a number or text).
 * @returns The amount, or undefined when it is missing, not a number or negative.
 */
function amount(value: unknown) {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

/**
 * Reads the brand slugs from the URL ("paw,jr-farm"), keeping the well-formed ones once each.
 * @param value - The raw search value.
 * @returns The slugs joined by commas, or undefined when there are none.
 */
function brandSlugs(value: unknown) {
  const slugs = new Set(typeof value === 'string' ? value.split(',').filter((part) => SLUG.test(part)) : [])
  return slugs.size ? [...slugs].join(',') : undefined
}

export const Route = createFileRoute('/catalog')({
  validateSearch: (raw: Record<string, unknown>): CatalogSearch => {
    const page = Number(raw.page)
    const category = typeof raw.category === 'string' && SLUG.test(raw.category) ? raw.category : undefined
    const q = typeof raw.q === 'string' && raw.q.trim() ? raw.q.trim() : undefined
    const sort = CATALOG_SORTS.find((s) => s === raw.sort) as CatalogSort | undefined
    let [min, max] = [amount(raw.min), amount(raw.max)]
    if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min]
    return { page: Number.isInteger(page) && page > 1 ? page : undefined, category, brand: brandSlugs(raw.brand), q, sort, min, max }
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context, abortController }) => {
    const { signal } = abortController
    const [categories, brands, results] = await Promise.all([fetchCategories(signal), fetchBrands(signal), fetchProducts(deps, context.locale, signal)])
    return { categories, brands, results }
  },
  head: ({ match, loaderData }) => {
    const { locale } = match.context
    const t = dictionaryFor(locale)
    // An unknown category is not part of the page's identity: the server ignored it.
    const category = loaderData ? (loaderData.results.category ?? undefined) : match.search.category
    const path = `/catalog${canonicalQuery({ ...match.search, category })}`
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
 * The catalog page: loads prices when a customer is signed in, reloads the results when the signed-in customer
 * changes (their price sorts and range), then renders the catalog.
 * @returns The Catalog with the page of products, the categories, the brands, the URL state and (signed in) prices.
 */
function CatalogPage() {
  const search = Route.useSearch()
  const { categories, brands, results } = Route.useLoaderData()
  const prices = useCustomerPrices()
  const router = useRouter()
  const { user } = useAuth()
  const customer = user?.kind === 'business' ? user.email : null
  const shownFor = useRef(customer)

  useEffect(() => {
    if (shownFor.current === customer) return
    shownFor.current = customer
    void router.invalidate()
  }, [customer, router])

  return <Catalog results={results} categories={categories} brands={brands} search={search} prices={prices} />
}
