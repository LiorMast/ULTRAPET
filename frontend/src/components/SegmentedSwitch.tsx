/**
 * SegmentedSwitch.tsx — The site's multi-choice switch: two or more options drawn as one segmented bar, the chosen
 * one under a thumb that slides between them (on the shared spring; reduced motion drops the slide).
 *
 * Under the look it is a native radio group (a <fieldset> with a <legend> and sr-only radio inputs), so the arrow
 * keys move the choice, the group is one tab stop, and each option's accessible name is its visible label. The thumb
 * is placed with logical inset, so it slides the right way in Hebrew and English. Used by DiscountDialog (the
 * discount type, category or product, and customers switches); use it for any choice of one option among a few.
 */
import { useId } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { LABEL_CLASS } from '@/components/RecordDialog'

/** One choice of the switch: its value, visible label, optional lucide icon (before the label), and whether it is off. */
export type SegmentedOption<Value extends string> = { value: Value; label: string; icon?: LucideIcon; disabled?: boolean }

const barVariants = cva('relative grid auto-cols-fr grid-flow-col border', {
  variants: {
    tone: {
      light: 'border-neutral-300 bg-white',
      dark: 'border-white/40',
    },
  },
  defaultVariants: { tone: 'light' },
})

const thumbVariants = cva('pointer-events-none absolute inset-y-0 transition-[inset-inline-start] duration-300', {
  variants: {
    tone: {
      light: 'bg-brand-charcoal',
      dark: 'bg-white',
    },
  },
  defaultVariants: { tone: 'light' },
})

const optionVariants = cva(
  'relative z-10 flex cursor-pointer items-center justify-center gap-2 px-3 text-center font-medium transition-[color,scale] not-has-disabled:active:scale-[0.97] not-has-disabled:active:duration-100 has-disabled:cursor-not-allowed has-disabled:opacity-50 has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-brand-red',
  {
    variants: {
      tone: {
        light: 'text-brand-charcoal has-checked:text-white',
        dark: 'text-white has-checked:text-brand-charcoal',
      },
      size: {
        default: 'py-2.5 text-sm',
        sm: 'py-1.5 text-xs',
      },
    },
    defaultVariants: { tone: 'light', size: 'default' },
  },
)

/**
 * A switch of one choice among two or more options, drawn as a segmented bar with a sliding thumb.
 * @param props.legend - The group's name, shown above the bar (and its accessible name).
 * @param props.hideLegend - Keeps the legend for screen readers only (e.g. a toolbar toggle with its own context).
 * @param props.options - The choices, in order (see SegmentedOption).
 * @param props.value - The chosen value; one that matches no option shows no thumb.
 * @param props.onChange - Called with the newly chosen value.
 * @param props.name - The radio group's name (unique on the page); a generated one by default.
 * @param props.disabled - Turns the whole switch off.
 * @param props.tone - "light" (dark thumb, for white backgrounds; default) or "dark" (white thumb, for black sections).
 * @param props.size - "default" (forms) or "sm" (compact toolbars).
 * @param props.className - Extra classes on the fieldset.
 * @returns The fieldset.
 */
export function SegmentedSwitch<Value extends string>({
  legend,
  hideLegend = false,
  options,
  value,
  onChange,
  name,
  disabled = false,
  tone,
  size,
  className,
}: {
  legend: string
  hideLegend?: boolean
  options: SegmentedOption<Value>[]
  value: Value
  onChange: (value: Value) => void
  name?: string
  disabled?: boolean
} & VariantProps<typeof optionVariants> & { className?: string }) {
  const generated = useId()
  const group = name ?? generated
  const index = options.findIndex((option) => option.value === value)
  const share = `100% / ${options.length}`
  return (
    <fieldset disabled={disabled} className={className}>
      <legend className={hideLegend ? 'sr-only' : LABEL_CLASS}>{legend}</legend>
      <div className={cn(barVariants({ tone }), !hideLegend && 'mt-2')}>
        {index >= 0 && (
          <span
            aria-hidden="true"
            data-slot="segmented-thumb"
            className={thumbVariants({ tone })}
            style={{ width: `calc(${share})`, insetInlineStart: `calc(${index} * ${share})` }}
          />
        )}
        {options.map((option) => {
          const Icon = option.icon
          return (
            <label key={option.value} className={optionVariants({ tone, size })}>
              <input
                type="radio"
                name={group}
                value={option.value}
                checked={value === option.value}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
