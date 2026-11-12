/**
 * ui/tooltip.tsx — Accessible tooltip (shadcn/ui on Radix Tooltip), restyled for the brand: a small charcoal label
 * with an arrow that appears beside a control on hover or keyboard focus (never on touch), and is read as the
 * control's description while shown. Used by CartDrawer (the header cart icon's summary); use it for any other
 * icon-only control instead of a `title` attribute.
 *
 * Each <Tooltip> brings its own provider (short delay, no hover-able content), so no app-level provider is needed.
 * Radix positions it (flipping to stay on screen), closes it on Escape, on pointer down and on scroll, and takes
 * the reading direction from the Direction.Provider in src/i18n/index.tsx.
 */
import * as React from "react"
import { cn } from "cn"
import { Tooltip as TooltipPrimitive } from "radix-ui"

/** How long the pointer must rest on the trigger before the tooltip shows, in ms. */
const DELAY_MS = 300

/**
 * Root of a tooltip; holds the open state and its own provider.
 * @param props.delayDuration - Hover delay before opening, in ms; defaults to DELAY_MS.
 * @param props - Other Radix Tooltip.Root props (open, onOpenChange, ...).
 * @returns The tooltip root.
 */
function Tooltip({ delayDuration = DELAY_MS, ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} disableHoverableContent>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipPrimitive.Provider>
  )
}

/**
 * The element the tooltip describes; with `asChild` it is your own button.
 * @param props - Radix Tooltip.Trigger props.
 * @returns The trigger.
 */
function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

/**
 * The tooltip's label, rendered in a portal beside the trigger.
 * @param props.className - Extra classes merged over the defaults.
 * @param props.sideOffset - Gap between trigger and label in px; defaults to 6.
 * @param props.children - The label's content.
 * @param props - Other Radix Tooltip.Content props (side, align, ...).
 * @returns The label with its arrow.
 */
function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-w-64 origin-(--radix-tooltip-content-transform-origin) bg-brand-charcoal px-3 py-2 text-xs text-white shadow-premium-sm duration-150 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=instant-open]:animate-in data-[state=instant-open]:fade-in-0 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-brand-charcoal" width={10} height={5} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipTrigger }
