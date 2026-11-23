/**
 * Breadcrumbs.tsx — The "you are here" trail above a page title (Home › Articles › ...). Real links for
 * every step but the last, which is the current page (aria-current). Used by the articles, product and brand pages
 * and the staff's customer profile; pair it with breadcrumbJsonLd() from seo.ts so search results can show the same
 * trail. Mobile-first: on a phone (below sm) it is one 44px back link to the step above the current page ("‹ Rodents"),
 * like a phone app's back button, instead of a trail that wraps over several lines.
 */
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import type { AppLink } from '@/config'
import { useMediaQuery } from '@/components/useMediaQuery'
import { useI18n } from '@/i18n'

/** A phone narrower than Tailwind's sm (40rem): the trail becomes a back link. */
const PHONE_SM_QUERY = '(width < 40rem)'

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
  const phone = useMediaQuery(PHONE_SM_QUERY)
  // The phone's back link: the last step with a link before the current page.
  const parent = items.slice(0, -1).findLast((item) => item.link)
  if (phone && parent?.link) {
    return (
      <nav aria-label={t.articles.breadcrumbLabel} className={className}>
        <Link
          {...parent.link}
          className="-ms-2 inline-flex min-h-11 max-w-full items-center gap-1 rounded-lg ps-1 pe-2 font-heading text-sm font-semibold text-brand-charcoal transition-colors duration-300 hover:text-brand-red-dark focus-visible:ring-2 focus-visible:ring-brand-red/60 active:scale-[0.97] active:duration-100"
        >
          <ChevronLeft aria-hidden="true" className="size-5 shrink-0 rtl:rotate-180" />
          <span className="truncate">{parent.label}</span>
        </Link>
      </nav>
    )
  }
  return (
    <nav aria-label={t.articles.breadcrumbLabel} className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-heading text-sm font-medium text-brand-charcoal-muted">
        {items.map((item, index) => {
          const current = index === items.length - 1
          return (
            <li key={index} className="flex min-w-0 items-center gap-2">
              {item.link && !current ? (
                <Link {...item.link} className="link-underline relative touch-target rounded-sm transition-colors duration-300 hover:text-brand-red-dark focus-visible:ring-2 focus-visible:ring-brand-red/60">
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
