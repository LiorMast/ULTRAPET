/**
 * ui/popover.tsx — Accessible popover (shadcn/ui on Radix Popover), restyled for the brand.
 *
 * Used by the Navbar's login popover (LoginPopover). Radix handles opening (click, Enter / Space), focus
 * moving into the panel and back to the trigger, Escape and outside-click closing, and right-to-left
 * layouts (the direction comes from the Direction.Provider in src/i18n/index.tsx). It is non-modal by
 * default: the page behind stays scrollable and accessible.
 */
import * as React from "react"
import { cn } from "cn"
import { Popover as PopoverPrimitive } from "radix-ui"

/**
 * Root of a popover; holds the open/closed state.
 * @param props - Radix Popover.Root props (open, onOpenChange, modal, ...).
 * @returns The popover root.
 */
function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

/**
 * The element that opens the popover; it gets aria-expanded and aria-haspopup automatically.
 * @param props - Radix Popover.Trigger props (use `asChild` to style your own button).
 * @returns The trigger.
 */
function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

/**
 * The popover panel, rendered in a portal above the page.
 * @param props.className - Extra classes merged over the defaults.
 * @param props.align - Alignment against the trigger; defaults to "end".
 * @param props.sideOffset - Gap between trigger and panel in px; defaults to 12.
 * @param props - Other Radix Popover.Content props.
 * @returns The panel.
 */
function PopoverContent({
  className,
  align = "end",
  sideOffset = 12,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-80 max-w-[calc(100vw-2rem)] origin-(--radix-popover-content-transform-origin) bg-popover p-6 text-popover-foreground shadow-premium ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverContent, PopoverTrigger }
