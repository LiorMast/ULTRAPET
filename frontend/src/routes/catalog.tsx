/**
 * routes/catalog.tsx — The product catalog page (/catalog): the store's products, filterable by category and
 * search text, 24 per page. The URL holds the state: ?category=dry-dog-food&q=salmon&page=2. The loader
 * fetches the categories and the matching page from the API (the server filters, searches and pages), and runs
 * again whenever the URL state changes; the previous results stay on screen until the new ones arrive.
 *
 * Prices: the product data never contains prices. For a signed-in business customer (useCustomerPrices) the page loads
 * the customer's prices separately and passes them to <Catalog>; signed-out visitors get "log in
 * to see the price" on every card.
 *
 * SEO: title, description, canonical (keeps category and page, drops the search text), hreflang and
 * CollectionPage + BreadcrumbList JSON-LD. No price ever appears in the head tags.
 */
import { createFileRoute } from '@tanstack/react-router'
import { fetchCategories, fetchProducts, type CatalogSearch } from '@/api'
import { useCustomerPrices } from '@/auth'
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

export const Route = createFileRoute('/catalog')({
  validateSearch: (raw: Record<string, unknown>): CatalogSearch => {
    const page = Number(raw.page)
    const category = typeof raw.category === 'string' && SLUG.test(raw.category) ? raw.category : undefined
    const q = typeof raw.q === 'string' && raw.q.trim() ? raw.q.trim() : undefined
    return { page: Number.isInteger(page) && page > 1 ? page : undefined, category, q }
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, abortController }) => {
    const { signal } = abortController
    const [categories, results] = await Promise.all([fetchCategories(signal), fetchProducts(deps, signal)])
    return { categories, results }
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
 * The catalog page: loads prices when a customer is signed in, then renders the catalog.
 * @returns The Catalog with the page of products, the categories, the URL state and (signed in) prices.
 */
function CatalogPage() {
  const search = Route.useSearch()
  const { categories, results } = Route.useLoaderData()
  const prices = useCustomerPrices()

  return <Catalog results={results} categories={categories} search={search} prices={prices} />
}
