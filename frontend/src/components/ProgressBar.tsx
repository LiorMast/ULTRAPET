/**
 * ProgressBar.tsx — A thin, rounded progress bar (role="progressbar") that fills on the brand spring as its value
 * grows. Used by the cart panel (CartDrawer): the minimum-order banner and each line's progress to its next bulk price.
 * The caller names it (`label`) and says it in words (`valueText`), since a bar alone says nothing to a screen reader.
 *
 * Usage:
 *   <ProgressBar label="Progress to the minimum order" value={1200} max={2000} valueText="₪1,200 / ₪2,000" />
 *   <ProgressBar tone="muted" label="…" value={4} max={12} valueText="4 of 12 units" />
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'

const trackVariants = cva('h-1.5 overflow-hidden rounded-full', {
  variants: {
    // The track's color: `onTint` on a tinted banner (white), `muted` on a white panel (light grey).
    tone: { onTint: 'bg-white', muted: 'bg-neutral-150' },
  },
  defaultVariants: { tone: 'onTint' },
})

/**
 * The progress bar.
 * @param props.label - Its accessible name, e.g. "Progress to the minimum order".
 * @param props.value - How far along, from 0 to `max` (clamped).
 * @param props.max - The goal.
 * @param props.valueText - The progress in words, e.g. "4 of 12 units".
 * @param props.tone - The track's color (see trackVariants); default `onTint`.
 * @param props.className - Extra classes on the track.
 * @returns The bar.
 */
export function ProgressBar({
  label,
  value,
  max,
  valueText,
  tone,
  className,
}: { label: string; value: number; max: number; valueText: string; className?: string } & VariantProps<typeof trackVariants>) {
  const shown = Math.min(Math.max(value, 0), max)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={valueText}
      className={cn(trackVariants({ tone }), className)}
    >
      <div className="h-full rounded-full bg-brand-red transition-[width] duration-500" style={{ width: `${max > 0 ? (shown / max) * 100 : 0}%` }} />
    </div>
  )
}
