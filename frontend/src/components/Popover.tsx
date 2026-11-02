/**
 * Popover.tsx — A small message bubble with a background color, for short hover/focus labels.
 * Purely visual: the caller positions it and decides when it shows (e.g. `group-hover:opacity-100`).
 * Used by WhatsAppButton.
 */
import { cn } from 'cn'

/**
 * Renders a pill-shaped message bubble. It is hidden from assistive tech (the trigger carries the name).
 * @param props.message - The text to show.
 * @param props.color - Any CSS background color (e.g. "#1A1A1A"); the text is white, so pick a dark color.
 * @param props.className - Extra classes for position and visibility, merged after the defaults.
 * @returns The bubble element.
 */
export function Popover({ message, color, className }: { message: string; color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: color }}
      className={cn('pointer-events-none whitespace-nowrap px-4 py-2 text-sm font-medium text-white shadow-premium-sm', className)}
    >
      {message}
    </span>
  )
}
