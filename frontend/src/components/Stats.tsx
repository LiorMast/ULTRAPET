/**
 * Stats.tsx — The home page "Stats" band (anchor #stats): the company's key figures, each a large number
 * with a short label. Used by routes/index.tsx. The numbers count up once when they scroll into view
 * (skipped for visitors who prefer reduced motion); the final value is always in the page for screen readers.
 */
import { useEffect, useRef, useState } from 'react'
import { cn } from 'cn'
import { useReducedMotion } from '@/components/useReducedMotion'
import { STATS, type Stat } from '@/config'
import { useI18n } from '@/i18n'

const COUNT_UP_MS = 1600

/**
 * Animates a number from 0 to `target` once `run` becomes true (ease-out). Without
 * `animate` it returns `target` straight away.
 * @param target - The final number.
 * @param run - Start the animation when this turns true.
 * @param animate - false to skip the animation (reduced motion, or no IntersectionObserver).
 * @returns The number to display right now.
 */
function useCountUp(target: number, run: boolean, animate: boolean) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!animate || !run) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / COUNT_UP_MS, 1)
      setValue(Math.round((1 - (1 - progress) ** 4) * target))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animate, run, target])
  return animate ? value : target
}

/**
 * One figure: the number (counting up when first visible) above its label.
 * @param props.stat - The figure to show.
 * @param props.className - Extra classes for the <li>.
 * @returns The list item.
 */
function StatFigure({ stat, className }: { stat: Stat; className?: string }) {
  const { t, locale } = useI18n()
  const reducedMotion = useReducedMotion()
  const ref = useRef<HTMLLIElement>(null)
  const canObserve = typeof IntersectionObserver !== 'undefined'
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!canObserve || !ref.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.4 })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [canObserve])
  const shown = useCountUp(stat.value, visible, canObserve && !reducedMotion)
  const format = (n: number) => `${n.toLocaleString(locale)}${stat.suffix}`
  return (
    <li ref={ref} className={cn('px-6 py-10 lg:px-10 lg:py-14', className)}>
      <p className="font-display text-5xl font-bold leading-none text-brand-red lg:text-6xl">
        <span aria-hidden="true" dir="ltr" className="inline-block tabular-nums">{format(shown)}</span>
        <span className="sr-only">{format(stat.value)}</span>
      </p>
      <p className="mt-4 font-heading text-xs font-bold uppercase tracking-widest text-brand-charcoal">{stat.label(t)}</p>
    </li>
  )
}

/**
 * The stats band.
 * @param props.stats - The figures to show, in order; defaults to STATS in config.ts.
 * @returns The <section> with a visually hidden heading and the figure list.
 */
export function Stats({ stats = STATS }: { stats?: Stat[] }) {
  const { t } = useI18n()
  return (
    <section id="stats" aria-labelledby="stats-title" className="border-b border-neutral-150 bg-white">
      <h2 id="stats-title" className="sr-only">{t.stats.title}</h2>
      <ul className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <StatFigure
            key={stat.id}
            stat={stat}
            className={cn(i % 2 === 1 && 'border-s border-neutral-150', i > 1 && 'border-t border-neutral-150 lg:border-t-0', i > 0 && 'lg:border-s lg:border-neutral-150')}
          />
        ))}
      </ul>
    </section>
  )
}
