/**
 * Carousel.tsx — A generic horizontal carousel: a scroll-snapping row of slides with previous/next
 * arrow buttons. It knows nothing about its content (category cards, brand cards, ...): every child becomes
 * one slide. Used by the home page Categories section.
 * Native scrolling does the work, so touch swipe, trackpads and keyboard focus keep working; the arrows
 * scroll the row by almost one view, flip direction in RTL, and are disabled at the ends (hidden when
 * everything fits). The arrows sit outside the two ends of the row and span its full height.
 */
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { useReducedMotion } from '@/components/useReducedMotion'
import { useI18n } from '@/i18n'

/** Which parts of the row can still be scrolled to. */
type ScrollState = { overflow: boolean; atStart: boolean; atEnd: boolean }

/** Both arrows: a narrow button beside the row, as tall as the row; dims when disabled. */
const ARROW_CLASSES = 'h-auto w-12 shrink-0 border-neutral-200 bg-white text-brand-charcoal hover:bg-brand-red hover:text-white disabled:opacity-40 sm:w-16'

/** How far one arrow click scrolls, as a share of the visible width (the rest keeps context). */
const PAGE_SHARE = 0.9

/**
 * The carousel.
 * @param props.children - The slides; each child is wrapped in its own list item.
 * @param props.label - Accessible name of the whole carousel, e.g. "Product categories".
 * @param props.slideClassName - Classes for each slide's width; defaults to 1, 2 or 3 cards per view
 *   depending on the screen width.
 * @param props.className - Extra classes for the outer wrapper.
 * @returns The carousel region with the arrow buttons and the slide row.
 */
export function Carousel({
  children,
  label,
  slideClassName = 'basis-[85%] sm:basis-[45%] lg:basis-[31%]',
  className,
}: {
  children: ReactNode
  label: string
  slideClassName?: string
  className?: string
}) {
  const { t, isRtl } = useI18n()
  const reducedMotion = useReducedMotion()
  const track = useRef<HTMLUListElement>(null)
  const [state, setState] = useState<ScrollState>({ overflow: false, atStart: true, atEnd: true })

  /** Reads the row's scroll position and stores which arrows are usable (scrollLeft is negative in RTL). */
  const update = useCallback(() => {
    const el = track.current
    if (!el) return
    const offset = Math.abs(el.scrollLeft)
    const max = el.scrollWidth - el.clientWidth
    setState({ overflow: max > 1, atStart: offset <= 1, atEnd: offset >= max - 1 })
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
      left: direction * (isRtl ? -1 : 1) * el.clientWidth * PAGE_SHARE,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label} className={cn('flex items-stretch gap-3 sm:gap-4', className)}>
      {state.overflow && (
        <Button variant="outline" size="icon-lg" aria-label={t.carousel.previous} disabled={state.atStart} onClick={() => scrollPage(-1)} className={ARROW_CLASSES}>
          <ChevronLeft aria-hidden="true" strokeWidth={2.5} className="size-8 rtl:rotate-180" />
        </Button>
      )}
      <ul
        ref={track}
        onScroll={update}
        className="flex min-w-0 flex-1 snap-x snap-mandatory gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Children.toArray(children).map((child, i) => (
          <li key={i} className={cn('flex shrink-0 snap-start', slideClassName)}>
            {child}
          </li>
        ))}
      </ul>
      {state.overflow && (
        <Button variant="outline" size="icon-lg" aria-label={t.carousel.next} disabled={state.atEnd} onClick={() => scrollPage(1)} className={ARROW_CLASSES}>
          <ChevronRight aria-hidden="true" strokeWidth={2.5} className="size-8 rtl:rotate-180" />
        </Button>
      )}
    </div>
  )
}
