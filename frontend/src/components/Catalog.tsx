/**
 * Catalog.tsx — A product catalog: heading, search box, category chips, the sort and filter toolbar
 * (CatalogToolbar), result count, a grid of CatalogCards and Pagination. Generic: it shows whatever page of results,
 * categories, brands and prices it is given (the server filters, sorts and pages, see fetchProducts), and keeps its
 * state (page, category, brands, search, sort, price range) in
 * the URL of the route that renders it, so every filtered page is a real, shareable, crawlable link; the
 * route reloads the results when the URL changes. Prices are shown only when the caller passes `prices`
 * (routes/catalog.tsx does that for signed-in customers), with each card's stock status; otherwise every card shows
 * "log in to see the price".
 */
import { useState } from 'react'
import { Link, linkOptions, useNavigate } from '@tanstack/react-router'
import { Download, Lock, Search } from 'lucide-react'
import { cn } from 'cn'
import { CatalogCard, priceFor, stockFor } from '@/components/CatalogCard'
import { CatalogToolbar } from '@/components/CatalogToolbar'
import { Pagination } from '@/components/Pagination'
import { Button } from '@/components/ui/button'
import type { Brand, CatalogSearch, ProductCategory, ProductPage } from '@/api'
import type { CustomerPrices } from '@/auth'
import { catalogPdfUrl, localized } from '@/config'
import { useI18n } from '@/i18n'

/**
 * One category filter chip: a link that keeps the search text and goes back to page 1. Its accessible
 * name is the category alone; the count is visual (the result status announces the count after filtering).
 * @param props.label - The chip text.
 * @param props.count - How many products it would show.
 * @param props.category - The category slug, or undefined for "all".
 * @param props.active - Whether it is the current filter (styling; the router sets aria-current on the exact URL).
 * @returns The chip link.
 */
function CategoryChip({ label, count, category, active }: { label: string; count: number; category?: string; active: boolean }) {
  return (
    <Link
      to="."
      search={(prev: CatalogSearch) => ({ ...prev, category, page: undefined })}
      activeOptions={{ exact: true }}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 whitespace-nowrap border px-4 py-2 text-sm font-medium outline-none transition-[color,background-color,border-color,scale] active:scale-[0.97] active:duration-100 focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2',
        active ? 'border-brand-charcoal bg-brand-charcoal text-white' : 'border-neutral-200 bg-white text-brand-charcoal hover:border-brand-red hover:text-brand-red-dark',
      )}
    >
      {label}
      <span aria-hidden="true" className={cn('text-xs', active ? 'text-neutral-300' : 'text-brand-charcoal-muted')}>{count}</span>
    </Link>
  )
}

/**
 * The banner shown to visitors who are not signed in: prices are for business customers.
 * @returns The banner with links to log in and to open an account.
 */
function PricesHiddenBanner() {
  const { t } = useI18n()
  return (
    <div className="mt-10 flex flex-col gap-4 border-s-4 border-brand-red bg-neutral-50 p-6 md:flex-row md:items-center md:justify-between">
      <div className="flex gap-4">
        <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-red" />
        <div>
          <p className="font-heading text-sm font-bold text-brand-charcoal">{t.catalog.pricesHiddenTitle}</p>
          <p className="mt-1 text-sm text-brand-charcoal-muted">{t.catalog.pricesHiddenText}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-3">
        <Button asChild size="sm">
          <Link to="/login">{t.catalog.login}</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/" hash="business">
            {t.catalog.openAccount}
          </Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * The catalog.
 * @param props.results - One page of matching products with the totals and chip counts (see ProductPage).
 * @param props.categories - The categories for the chips; products are labelled with their names.
 * @param props.brands - The active brands (the brand filter).
 * @param props.search - The URL state (page, category, brands, search text, sort, price range), as validated by the route.
 * @param props.prices - Prices and stock statuses for a signed-in customer; omit to hide every price.
 * @returns The catalog <section>.
 */
export function Catalog({
  results,
  categories,
  brands,
  search,
  prices,
}: {
  results: ProductPage
  categories: ProductCategory[]
  brands: Brand[]
  search: CatalogSearch
  prices?: CustomerPrices
}) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [query, setQuery] = useState(search.q ?? '')
  // When ?q= changes from outside the box (clear filters, back button), show the new value.
  const [syncedQ, setSyncedQ] = useState(search.q)
  if (search.q !== syncedQ) {
    setSyncedQ(search.q)
    if ((search.q ?? '') !== query.trim()) setQuery(search.q ?? '')
  }

  const { items, page, pageSize, pageCount, total, category: activeCategory, categoryCounts } = results
  const allCount = Object.values(categoryCounts).reduce((sum, n) => sum + n, 0)
  const categoryName = new Map(categories.map((c) => [c.slug, localized(c.name, locale)]))

  /**
   * Search box change: filters as you type, by updating ?q= in place (no new history entry, no scroll jump)
   * and going back to page 1.
   * @param value - The new search text.
   */
  const handleQuery = (value: string) => {
    setQuery(value)
    navigate({ to: '.', search: (prev: CatalogSearch) => ({ ...prev, q: value.trim() || undefined, page: undefined }), replace: true, resetScroll: false })
  }

  return (
    <section aria-labelledby="catalog-title" className="mx-auto max-w-screen-2xl px-6 py-16 lg:px-10 lg:py-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-red">{t.catalog.eyebrow}</p>
          <h1 id="catalog-title" className="mt-4 font-display text-4xl font-bold text-brand-charcoal lg:text-5xl">
            {t.catalog.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-brand-charcoal-muted">{t.catalog.description}</p>
        </div>
        <a
          href={catalogPdfUrl(locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-2 font-heading text-xs font-bold uppercase tracking-widest text-brand-red-dark hover:underline focus-visible:ring-2 focus-visible:ring-brand-red/60"
        >
          <Download aria-hidden="true" className="size-4" />
          {t.catalog.download}
        </a>
      </div>

      {!prices && <PricesHiddenBanner />}

      <div className={cn('flex flex-col gap-5', prices ? 'mt-12' : 'mt-8')}>
        <form role="search" aria-label={t.catalog.searchLabel} onSubmit={(e) => e.preventDefault()} className="relative max-w-xl">
          <label htmlFor="catalog-search" className="sr-only">
            {t.catalog.searchLabel}
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-brand-charcoal-muted" />
          <input
            id="catalog-search"
            type="search"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            placeholder={t.catalog.searchPlaceholder}
            autoComplete="off"
            className="block h-12 w-full border border-neutral-300 bg-neutral-50 ps-12 pe-4 text-sm text-brand-charcoal focus:border-brand-red focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40"
          />
        </form>

        <nav aria-label={t.catalog.categoriesLabel} className="-mx-6 overflow-x-auto px-6 pb-1 md:mx-0 md:overflow-visible md:px-0">
          <ul className="flex gap-2 md:flex-wrap">
            <li>
              <CategoryChip label={t.catalog.all} count={allCount} active={!activeCategory} />
            </li>
            {categories.map((category) => (
              <li key={category.slug}>
                <CategoryChip
                  label={localized(category.name, locale)}
                  count={categoryCounts[category.slug] ?? 0}
                  category={category.slug}
                  active={activeCategory === category.slug}
                />
              </li>
            ))}
          </ul>
        </nav>

        <CatalogToolbar results={results} brands={brands} canUsePrices={prices !== undefined} />
      </div>

      <p role="status" className="mt-8 border-b border-neutral-150 pb-4 text-sm text-brand-charcoal-muted">
        {items.length > 0 &&
          t.catalog.results
            .replace('{from}', String((page - 1) * pageSize + 1))
            .replace('{to}', String((page - 1) * pageSize + items.length))
            .replace('{n}', String(total))}
      </p>

      {items.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-lg text-brand-charcoal-muted">{t.catalog.empty}</p>
          <Link to="." search={{}} className="mt-4 inline-block text-sm font-semibold text-brand-red-dark underline underline-offset-4">
            {t.catalog.clearFilters}
          </Link>
        </div>
      ) : (
        <ul aria-label={t.catalog.listLabel} className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((product) => (
            <li key={product.id} className="flex">
              <CatalogCard product={product} categoryName={categoryName.get(product.category)} price={priceFor(prices, product.id)} stock={stockFor(prices, product.id)} className="w-full" />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        linkFor={(n) => linkOptions({ to: '.', search: (prev: CatalogSearch) => ({ ...prev, page: n > 1 ? n : undefined }) })}
        className="mt-14"
      />
    </section>
  )
}
