/**
 * QuantityStepper.tsx — A quantity field: a minus button, a number box and a plus button. Used by the product page
 * (how many units "Add to cart" adds) and by the cart panel's lines (CartDrawer); any other quantity input should
 * use it too.
 *
 * The box accepts typing (digits only); a valid number is sent at once, clamped to `min`..`max`, and an empty or
 * invalid box shows the current value again when it loses the focus. The buttons are disabled at the limits.
 */
import { useState } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Minus, Plus } from 'lucide-react'
import { cn } from 'cn'
import { MAX_QUANTITY, MIN_QUANTITY } from '@/cart'
import { useI18n } from '@/i18n'

const stepperVariants = cva('inline-flex items-stretch border border-neutral-300 bg-white', {
  variants: {
    size: {
      sm: 'h-9 [&_button]:w-8 [&_input]:w-11 [&_input]:text-sm',
      md: 'h-12 [&_button]:w-11 [&_input]:w-14 [&_input]:text-base',
    },
  },
  defaultVariants: { size: 'md' },
})

/** Style of the minus and plus buttons. */
const BUTTON_CLASS =
  'flex shrink-0 items-center justify-center text-brand-charcoal transition-[color,background-color,scale] outline-none hover:bg-neutral-50 hover:text-brand-red focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-red active:scale-[0.97] active:duration-100 disabled:pointer-events-none disabled:opacity-40'

/**
 * The quantity field.
 * @param props.value - The current quantity.
 * @param props.onChange - Called with the new quantity (already clamped to min..max).
 * @param props.label - The box's accessible name; defaults to the dictionary's "Quantity" (give a line's name in a list).
 * @param props.min - The smallest quantity (default MIN_QUANTITY, 1).
 * @param props.max - The largest quantity (default MAX_QUANTITY, 9999).
 * @param props.size - 'md' (default, the product page) or 'sm' (cart lines).
 * @param props.className - Extra classes for the group.
 * @returns The group of the two buttons and the box.
 */
export function QuantityStepper({
  value,
  onChange,
  label,
  min = MIN_QUANTITY,
  max = MAX_QUANTITY,
  size,
  className,
}: {
  value: number
  onChange: (quantity: number) => void
  label?: string
  min?: number
  max?: number
  className?: string
} & VariantProps<typeof stepperVariants>) {
  const { t } = useI18n()
  // What the box shows while typing; null = the value itself.
  const [draft, setDraft] = useState<string | null>(null)

  /**
   * Sends a quantity, clamped to the limits.
   * @param quantity - The wanted quantity.
   */
  const send = (quantity: number) => onChange(Math.min(Math.max(quantity, min), max))

  /**
   * Typing in the box: keeps the digits, and sends a valid number at once.
   * @param text - The box's new text.
   */
  const handleType = (text: string) => {
    const digits = text.replace(/\D/g, '')
    setDraft(digits)
    if (digits) send(Number(digits))
  }

  return (
    <div role="group" aria-label={label ?? t.quantity.label} className={cn(stepperVariants({ size }), className)}>
      <button type="button" aria-label={t.quantity.decrease} disabled={value <= min} onClick={() => send(value - 1)} className={BUTTON_CLASS}>
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label ?? t.quantity.label}
        value={draft ?? String(value)}
        onChange={(event) => handleType(event.target.value)}
        onBlur={() => setDraft(null)}
        className="border-x border-neutral-300 text-center font-semibold tabular-nums text-brand-charcoal outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-red"
      />
      <button type="button" aria-label={t.quantity.increase} disabled={value >= max} onClick={() => send(value + 1)} className={BUTTON_CLASS}>
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
