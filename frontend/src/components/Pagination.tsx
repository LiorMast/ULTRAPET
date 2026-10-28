/**
 * Pagination.tsx — Page links for any paged list: previous, the page numbers (with "…" gaps on long lists)
 * and next. Every entry is a real link (crawlable, works without JavaScript state), the router
 * marks the current page's link with aria-current (exact URL match), and the arrows flip in right-to-left pages. Used by the catalog; reusable for any list
 * whose page lives in the URL.
 */
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import type { AppLink } from '@/config'
import { useI18n } from '@/i18n'

/** Shared look of a page entry (number or arrow). */
const ITEM =
  'flex size-11 items-center justify-center border font-heading text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2'

/**
 * The page numbers to show: always the first and last, the current page with `siblings` pages on each side,
 * and null where pages are left out.
 * @param page - The current page (1-based).
 * @param pageCount - The number of pages.
 * @param siblings - Pages shown on each side of the current one.
 * @returns E.g. [1, null, 4, 5, 6, null, 17].
 */
export function pageWindow(page: number, pageCount: number, siblings = 1): (number | null)[] {
  const pages: (number | null)[] = []
  for (let n = 1; n <= pageCount; n++) {
    const near = Math.abs(n - page) <= siblings
    // A gap of a single page shows that page instead of "…".
    const edge = n === 1 || n === pageCount || (n === 2 && page - siblings === 3) || (n === pageCount - 1 && page + siblings === pageCount - 2)
    if (near || edge) pages.push(n)
    else if (pages.at(-1) !== null) pages.push(null)
  }
  return pages
}

/**
 * The pagination bar; renders nothing for a single page.
 * @param props.page - The current page (1-based).
 * @param props.pageCount - The number of pages.
 * @param props.linkFor - Builds the link of a page, e.g. (n) => ({ to: '/catalog', search: { page: n } }).
 * @param props.className - Extra classes, e.g. spacing.
 * @returns The <nav> with the page links, or null.
 */
export function Pagination({ page, pageCount, linkFor, className }: { page: number; pageCount: number; linkFor: (page: number) => AppLink; className?: string }) {
  const { t } = useI18n()
  if (pageCount <= 1) return null
  const arrow = cn(ITEM, 'border-neutral-200 text-brand-charcoal hover:border-brand-red hover:text-brand-red')
  const disabledArrow = cn(ITEM, 'border-neutral-150 text-neutral-400')
  return (
    <nav aria-label={t.pagination.label} className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          {page > 1 ? (
            <Link {...linkFor(page - 1)} rel="prev" aria-label={t.pagination.previous} className={arrow}>
              <ChevronLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
            </Link>
          ) : (
            <span aria-hidden="true" className={disabledArrow}>
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </span>
          )}
        </li>
        {pageWindow(page, pageCount).map((n, index) => (
          <li key={n ?? `gap-${index}`}>
            {n === null ? (
              <span aria-hidden="true" className="flex size-11 items-end justify-center pb-3 text-brand-charcoal-muted">
                …
              </span>
            ) : (
              <Link
                {...linkFor(n)}
                aria-label={t.pagination.page.replace('{n}', String(n))}
                activeOptions={{ exact: true }}
                className={cn(
                  ITEM,
                  n === page
                    ? 'border-brand-charcoal bg-brand-charcoal text-white'
                    : 'border-neutral-200 text-brand-charcoal hover:border-brand-red hover:text-brand-red',
                )}
              >
                {n}
              </Link>
            )}
          </li>
        ))}
        <li>
          {page < pageCount ? (
            <Link {...linkFor(page + 1)} rel="next" aria-label={t.pagination.next} className={arrow}>
              <ChevronRight aria-hidden="true" className="size-4 rtl:rotate-180" />
            </Link>
          ) : (
            <span aria-hidden="true" className={disabledArrow}>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  )
}
