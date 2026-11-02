/**
 * Carousel.tsx — A generic horizontal carousel: a scroll-snapping row of slides with previous/next
 * arrow buttons. It knows nothing about its content (category cards, brand cards, ...): every child becomes
 * one slide. Used by the home page Categories and Brands sections.
 * Native scrolling does the work, so touch swipe, trackpads and keyboard focus keep working; the arrows
 * scroll the row by almost one view, flip direction in RTL, and are disabled at the ends (hidden when
 * everything fits). The arrows sit outside the two ends of the row and span its full height.
 * Paged mode (`pageSize`): the children are grouped into pages of that many items, each page is one full-width
 * snap slide holding a grid of its items, the arrows move exactly one page, and a row of dots below shows the
 * current page and jumps to any page. Used by the home page Brands section.
 */
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { useReducedMotion } from '@/components/useReducedMotion'
import { useI18n } from '@/i18n'

/** Which parts of the row can still be scrolled to. */
type ScrollState = { overflow: boolean; atStart: boolean; atEnd: boolean; page: number }

/** Both arrows per tone: a narrow button beside the row, as tall as the row; dims when disabled. */
const ARROW_CLASSES = {
  light: 'h-auto w-12 shrink-0 border-neutral-200 bg-white text-brand-charcoal hover:bg-brand-red hover:text-white disabled:opacity-40 sm:w-16',
  dark: 'h-auto w-12 shrink-0 border-white/30 bg-transparent text-white hover:bg-brand-red hover:text-white disabled:opacity-40 sm:w-16',
}

/** The grid of one page in paged mode: 1, 2 or 3 columns depending on the screen width. */
const PAGE_CLASSES = 'grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'

/** How far one arrow click scrolls, as a share of the visible width (the rest keeps context). */
const PAGE_SHARE = 0.9

/**
 * Splits a list into consecutive groups.
 * @param items - The list to split.
 * @param size - Items per group (at least 1).
 * @returns The groups, in order; the last one may be shorter.
 */
function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = []
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size))
  return groups
}

/**
 * The carousel.
 * @param props.children - The slides; each child is wrapped in its own list item (or, in paged mode, in a grid cell).
 * @param props.label - Accessible name of the whole carousel, e.g. "Product categories".
 * @param props.slideClassName - Classes for each slide's width; defaults to 1, 2 or 3 cards per view
 *   depending on the screen width. Ignored in paged mode, where a slide is a whole page.
 * @param props.pageSize - Turns on paged mode: items per page (the grid shows fewer columns on narrow screens, so
 *   a page then wraps into rows). Omit for the free-scrolling row.
 * @param props.pageClassName - Paged mode only: replaces the classes of each page's grid.
 * @param props.className - Extra classes for the outer wrapper.
 * @param props.tone - "light" (default) for pale sections, "dark" for black ones (arrows and dots invert).
 * @returns The carousel region with the arrow buttons, the slide row and, in paged mode, the page dots.
 */
export function Carousel({
  children,
  label,
  slideClassName = 'basis-[85%] sm:basis-[45%] lg:basis-[31%]',
  pageSize,
  pageClassName = PAGE_CLASSES,
  className,
  tone = 'light',
}: {
  children: ReactNode
  label: string
  slideClassName?: string
  pageSize?: number
  pageClassName?: string
  className?: string
  tone?: 'light' | 'dark'
}) {
  const { t, isRtl } = useI18n()
  const reducedMotion = useReducedMotion()
  const track = useRef<HTMLUListElement>(null)
  const [state, setState] = useState<ScrollState>({ overflow: false, atStart: true, atEnd: true, page: 0 })
  const items = Children.toArray(children)
  const pages = pageSize ? chunk(items, Math.max(1, pageSize)) : null

  /** Reads the row's scroll position and stores which arrows are usable (scrollLeft is negative in RTL). */
  const update = useCallback(() => {
    const el = track.current
    if (!el) return
    const offset = Math.abs(el.scrollLeft)
    const max = el.scrollWidth - el.clientWidth
    setState({ overflow: max > 1, atStart: offset <= 1, atEnd: offset >= max - 1, page: el.clientWidth ? Math.round(offset / el.clientWidth) : 0 })
  }, [])

  useEffect(() => {
    const el = track.current
    if (!el) return
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [update])

  /**
   * Scrolls the row one page towards the end ("next") or the start ("previous").
   * @param direction - 1 for next, -1 for previous (reading direction; flipped internally for RTL).
   */
  const scrollPage = (direction: 1 | -1) => {
    const el = track.current
    if (!el) return
    el.scrollBy({
      left: direction * (isRtl ? -1 : 1) * el.clientWidth * (pages ? 1 : PAGE_SHARE),
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  /**
   * Scrolls the row so that one page (paged mode) fills the view.
   * @param index - Zero-based page number.
   */
  const goToPage = (index: number) => {
    const el = track.current
    if (!el) return
    el.scrollTo({ left: (isRtl ? -1 : 1) * index * el.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label} className={className}>
      <div className="flex items-stretch gap-3 sm:gap-4">
        {state.overflow && (
          <Button variant="outline" size="icon-lg" aria-label={t.carousel.previous} disabled={state.atStart} onClick={() => scrollPage(-1)} className={ARROW_CLASSES[tone]}>
            <ChevronLeft aria-hidden="true" strokeWidth={2.5} className="size-8 rtl:rotate-180" />
          </Button>
        )}
        <ul
          ref={track}
          onScroll={update}
          className={cn(
            'flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            !pages && 'gap-6',
          )}
        >
          {pages
            ? pages.map((page, p) => (
                <li key={p} className="w-full shrink-0 snap-start">
                  <ul className={pageClassName}>
                    {page.map((child, i) => (
                      <li key={i} className="flex">
                        {child}
                      </li>
                    ))}
                  </ul>
                </li>
              ))
            : items.map((child, i) => (
                <li key={i} className={cn('flex shrink-0 snap-start', slideClassName)}>
                  {child}
                </li>
              ))}
        </ul>
        {state.overflow && (
          <Button variant="outline" size="icon-lg" aria-label={t.carousel.next} disabled={state.atEnd} onClick={() => scrollPage(1)} className={ARROW_CLASSES[tone]}>
            <ChevronRight aria-hidden="true" strokeWidth={2.5} className="size-8 rtl:rotate-180" />
          </Button>
        )}
      </div>
      {pages && state.overflow && (
        <nav aria-label={t.carousel.pages} className="mt-8 flex justify-center gap-2">
          {pages.map((_, p) => (
            <button
              key={p}
              type="button"
              aria-label={t.carousel.page.replace('{n}', String(p + 1)).replace('{total}', String(pages.length))}
              aria-current={p === state.page ? 'true' : undefined}
              onClick={() => goToPage(p)}
              className={cn(
                'h-1.5 w-8 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2',
                tone === 'dark' ? 'bg-white/30 aria-[current=true]:bg-white' : 'bg-neutral-300 aria-[current=true]:bg-brand-red',
              )}
            />
          ))}
        </nav>
      )}
    </div>
  )
}
