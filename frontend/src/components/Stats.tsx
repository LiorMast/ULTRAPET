/**
 * Stats.tsx — The home page "Stats" band (anchor #stats): the company's key figures, each a large number
 * with a short label. Used by routes/index.tsx, which loads the figures from the API (fetchStats); the labels
 * come from the dictionaries through STAT_LABELS in config.ts. The numbers count up once when they scroll into view
 * (skipped for visitors who prefer reduced motion); the final value is always in the page for screen readers.
 * Phones get a smaller number size, so the widest figure ("1,000+") fits its half of the row even at 360px.
 *
 * With `onSave`, staff edit the band in place (EditableSection, the page's language): each figure's number and suffix
 * (settings stat_<id>_value / stat_<id>_suffix, the same in every language) and its label (words only, page_sections
 * "stats", key "label.<id>"). A number that is not a whole number in digits is refused before anything is saved.
 */
import { useEffect, useRef, useState } from 'react'
import { cn } from 'cn'
import { fieldLabel, SectionEditBar, useEditableSection, type EditableField } from '@/components/EditableSection'
import { EditableText, InlineEditError } from '@/components/InlineEditor'
import { useReducedMotion } from '@/components/useReducedMotion'
import type { SectionContent, Stat } from '@/api'
import { STAT_LABELS, type Label } from '@/config'
import { useI18n } from '@/i18n'

/** The settings a save changes, by key (e.g. { stat_retail_value: 400 }). */
export type SettingChanges = Record<string, string | number>

/** The look of the figure's number, in read and edit mode. */
const NUMBER_CLASS = 'font-display text-4xl font-bold leading-none text-brand-red sm:text-5xl lg:text-6xl'

/** The look of the figure's label, in read and edit mode. */
const LABEL_CLASS = 'mt-4 font-heading text-xs font-bold uppercase tracking-widest text-brand-charcoal'

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
 * One figure: the number (counting up when first visible) above its label; while editing, the boxes of its number,
 * suffix and label.
 * @param props.stat - The figure to show.
 * @param props.label - Its label's EditableText props.
 * @param props.edit - Its number's and suffix's EditableText props while editing; omitted = read mode.
 * @param props.className - Extra classes for the <li>.
 * @returns The list item.
 */
function StatFigure({ stat, label, edit, className }: { stat: Stat; label: EditableField; edit?: { value: EditableField; suffix: EditableField }; className?: string }) {
  const { locale } = useI18n()
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
      {edit ? (
        <div dir="ltr" className={cn(NUMBER_CLASS, 'flex items-baseline gap-2 rtl:justify-end')}>
          <EditableText as="span" {...edit.value} dir="ltr" inputMode="numeric" />
          <EditableText as="span" {...edit.suffix} dir="ltr" />
        </div>
      ) : (
        <p className={NUMBER_CLASS}>
          <span aria-hidden="true" dir="ltr" className="inline-block tabular-nums">{format(shown)}</span>
          <span className="sr-only">{format(stat.value)}</span>
        </p>
      )}
      <EditableText wrap {...label} className={LABEL_CLASS} />
    </li>
  )
}

/**
 * The stats band.
 * @param props.stats - The figures to show, in order (from the API); a figure without a label is left out.
 * @param props.labels - The built-in label of each figure id; defaults to STAT_LABELS in config.ts.
 * @param props.content - The labels staff saved ("label.<id>"); null or omitted = the dictionary's.
 * @param props.onSave - Stores the new content and the changed settings (the numbers and suffixes); rejects with an
 *   ApiError on refusal. Given = staff can edit in place.
 * @returns The <section> with a visually hidden heading and the figure list.
 */
export function Stats({
  stats,
  labels = STAT_LABELS,
  content,
  onSave,
}: {
  stats: Stat[]
  labels?: Record<string, Label>
  content?: SectionContent | null
  onSave?: (content: SectionContent, settings: SettingChanges) => Promise<unknown>
}) {
  const { t } = useI18n()
  const shown = stats.filter((stat) => labels[stat.id])
  const defaults: Record<string, string> = {}
  const names: Record<string, string> = {}
  const data: Record<string, string> = {}
  for (const stat of shown) {
    const label = labels[stat.id](t)
    defaults[`value.${stat.id}`] = String(stat.value)
    defaults[`suffix.${stat.id}`] = stat.suffix
    defaults[`label.${stat.id}`] = label
    names[`value.${stat.id}`] = fieldLabel(t, 'number', label)
    names[`suffix.${stat.id}`] = fieldLabel(t, 'suffix', label)
    names[`label.${stat.id}`] = fieldLabel(t, 'label', label)
    data[`value.${stat.id}`] = String(stat.value)
    data[`suffix.${stat.id}`] = stat.suffix
  }
  const section = useEditableSection<string>({
    content,
    defaults,
    labels: names,
    data,
    onSave:
      onSave &&
      (async (next, draft) => {
        const settings: SettingChanges = {}
        for (const stat of shown) {
          const value = draft[`value.${stat.id}`].text.trim()
          if (!/^\d+$/.test(value)) throw new InlineEditError(t.inlineEdit.errors.number, `value.${stat.id}`)
          const suffix = draft[`suffix.${stat.id}`].text.trim()
          if (Number(value) !== stat.value) settings[`stat_${stat.id}_value`] = Number(value)
          if (suffix !== stat.suffix) settings[`stat_${stat.id}_suffix`] = suffix
        }
        await onSave(next, settings)
      }),
  })
  const { field } = section
  return (
    <section id="stats" aria-labelledby="stats-title" className="border-b border-neutral-150 bg-white">
      <h2 id="stats-title" className="sr-only">{t.stats.title}</h2>
      {section.edit && (
        <div className="mx-auto max-w-7xl px-6 pt-6 lg:px-10">
          <SectionEditBar edit={section.edit} label={t.stats.title} className="mb-0 bg-white" />
        </div>
      )}
      <form {...section.formProps}>
        <ul className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
          {shown.map((stat, i) => (
            <StatFigure
              key={stat.id}
              stat={stat}
              label={field(`label.${stat.id}`)}
              edit={section.editing ? { value: field(`value.${stat.id}`), suffix: field(`suffix.${stat.id}`) } : undefined}
              className={cn(i % 2 === 1 && 'border-s border-neutral-150', i > 1 && 'border-t border-neutral-150 lg:border-t-0', i > 0 && 'lg:border-s lg:border-neutral-150')}
            />
          ))}
        </ul>
      </form>
    </section>
  )
}
