/**
 * ui/spinner.tsx — The site's loading indicator (shadcn/ui's spinner, redrawn for UltraPet).
 *
 * A two-tone ring: a faint full circle (the track) and a quarter arc that turns, both in `currentColor`, so it
 * takes the color of the text around it (white on a red button, charcoal on a page). Under reduced motion it pulses in
 * place instead of turning (index.css). Standalone it is a polite `role="status"` region with a spoken label
 * (`t.common.loading` unless `label` says otherwise); with `label={false}` it is decorative, for a control that is
 * already named and marked busy (ui/button's `loading`). Used by Button, the router's pending page (routes/__root.tsx)
 * and every "loading…" line that waits on the server.
 */
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { useI18n } from "@/i18n"

/** The ring's sizes: sm inside buttons and text lines, md in a panel, lg for a whole page. */
const spinnerVariants = cva("inline-block shrink-0 animate-spinner", {
  variants: {
    size: { sm: "size-4", md: "size-6", lg: "size-10" },
  },
  defaultVariants: { size: "sm" },
})

/**
 * Draws the ring alone (always hidden from assistive technology).
 * @param props.className - Extra classes for the <svg> (size, color, placement).
 * @param props.size - sm, md or lg.
 * @returns The ring <svg>.
 */
function SpinnerRing({ className, size }: { className?: string } & VariantProps<typeof spinnerVariants>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" data-slot="spinner" className={cn(spinnerVariants({ size }), className)}>
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.5" />
      <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * A loading indicator.
 * @param props.label - What is loading, spoken by screen readers (default "Loading…"); false = decorative, for a
 *   control that already says it is busy.
 * @param props.size - sm (default, 16px), md (24px) or lg (40px).
 * @param props.className - Extra classes for the ring (e.g. a color such as text-brand-red).
 * @returns The ring, inside a status region unless `label` is false.
 */
function Spinner({ label, size, className }: { label?: string | false; className?: string } & VariantProps<typeof spinnerVariants>) {
  const { t } = useI18n()
  if (label === false) return <SpinnerRing size={size} className={className} />
  return (
    <span role="status" className="inline-flex">
      <SpinnerRing size={size} className={className} />
      <span className="sr-only">{label ?? t.common.loading}</span>
    </span>
  )
}

export { Spinner, SpinnerRing, spinnerVariants }
