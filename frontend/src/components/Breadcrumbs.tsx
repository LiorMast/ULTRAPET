/**
 * Breadcrumbs.tsx — The "you are here" trail above a page title (Home › Articles › ...). Real links for
 * every step but the last, which is the current page (aria-current). Used by the articles pages; pair it
 * with breadcrumbJsonLd() from seo.ts so search results can show the same trail.
 */
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import type { AppLink } from '@/config'
import { useI18n } from '@/i18n'

/** One step of the trail: its text, and a link for every step except the current page. */
export type Crumb = { label: string; link?: AppLink }

/**
 * Renders the trail.
 * @param props.items - The steps from the home page to the current page (the last one is the current page).
 * @param props.className - Extra classes, e.g. spacing.
 * @returns The breadcrumb <nav>.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const { t } = useI18n()
  return (
    <nav aria-label={t.articles.breadcrumbLabel} className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-heading text-xs font-semibold text-brand-charcoal-muted">
        {items.map((item, index) => {
          const current = index === items.length - 1
          return (
            <li key={index} className="flex min-w-0 items-center gap-2">
              {item.link && !current ? (
                <Link {...item.link} className="hover:text-brand-red-dark hover:underline focus-visible:ring-2 focus-visible:ring-brand-red/60">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={current ? 'page' : undefined} className={cn(current && 'truncate text-brand-charcoal')}>
                  {item.label}
                </span>
              )}
              {!current && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 rtl:rotate-180" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
