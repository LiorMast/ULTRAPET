/**
 * Offcanvas.tsx — A reusable side panel ("offcanvas") that slides in from the start or end edge of the page:
 * a titled header with a close button, an optional notice strip under it (it stays put while the body scrolls),
 * a scrolling body and an optional footer pinned to the bottom.
 * Used by CartDrawer (the business customers' shopping cart); any other side panel (filters, details) should
 * use it too instead of building its own Sheet markup.
 *
 * Built on the shared Sheet primitive (ui/sheet.tsx, a Radix Dialog): it traps the focus, closes on Escape or a
 * click on the backdrop, locks the page's scroll, returns the focus to the trigger, and can be swiped closed
 * towards its edge. The side is logical: `end` is the right edge in English and the left edge in Hebrew.
 *
 * An optional `tooltip` labels the trigger on hover and keyboard focus (ui/tooltip). It never shows while the panel
 * is open, nor when the focus comes back to the trigger as the panel closes.
 */
import { useRef, useState, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from 'cn'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'

/** After the panel closes, a tooltip that asks to show this soon (the focus returning to the trigger) is ignored (ms). */
const TOOLTIP_QUIET_MS = 500

/** The panel's widths: always the full screen on phones, capped from the `sm` breakpoint. */
const panelVariants = cva(
  'gap-0 border-0 bg-white p-0 shadow-2xl data-[side=left]:w-full data-[side=right]:w-full',
  {
    variants: {
      size: {
        sm: 'data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm',
        md: 'data-[side=left]:sm:max-w-md data-[side=right]:sm:max-w-md',
        lg: 'data-[side=left]:sm:max-w-lg data-[side=right]:sm:max-w-lg',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/** The props of <Offcanvas>. */
export type OffcanvasProps = VariantProps<typeof panelVariants> & {
  title: ReactNode
  description?: ReactNode
  trigger?: ReactNode
  tooltip?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: 'start' | 'end'
  notice?: ReactNode
  footer?: ReactNode
  closeLabel?: string
  className?: string
  children: ReactNode
}

/**
 * A side panel with a header (title, optional description, close button), a scrolling body and a footer.
 * Works controlled (`open` + `onOpenChange`) or on its own state (then it opens from `trigger`).
 * @param props.title - The panel's visible heading; also its accessible name.
 * @param props.description - Optional line under the title, announced after it.
 * @param props.trigger - The element that opens the panel (a <button>; rendered as the Radix trigger with
 *   asChild, so it gets aria-expanded and the focus comes back to it on close). Omit it when opening from elsewhere.
 * @param props.tooltip - Optional tooltip content for the trigger (shown below it on hover or keyboard focus).
 * @param props.open - Controlled open state; omit to let the panel keep its own.
 * @param props.onOpenChange - Called with the new state when the panel opens or closes (including swipes).
 * @param props.side - The logical edge it slides from: 'end' (default; right in English, left in Hebrew) or 'start'.
 * @param props.size - The panel's width from `sm` up: 'sm', 'md' (default) or 'lg'; phones always get the full width.
 * @param props.notice - Content of a strip between the header and the body that does not scroll (a status or
 *   a warning the reader must not miss); omitted = none.
 * @param props.footer - Content pinned under the body (totals, actions); omitted = no footer.
 * @param props.closeLabel - Accessible name of the close button; defaults to the dictionary's "Close".
 * @param props.className - Extra classes for the panel.
 * @param props.children - The body; it scrolls when taller than the screen.
 * @returns The trigger (if any) and the panel, portalled to <body> while open.
 */
export function Offcanvas({
  title,
  description,
  trigger,
  tooltip,
  open: openProp,
  onOpenChange,
  side = 'end',
  size,
  notice,
  footer,
  closeLabel,
  className,
  children,
}: OffcanvasProps) {
  const { t, isRtl } = useI18n()
  const [ownOpen, setOwnOpen] = useState(false)
  const open = openProp ?? ownOpen
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const closedAt = useRef(0)
  /**
   * Stores the new state (when uncontrolled) and tells the caller; closing notes the time for the tooltip.
   * @param next - true when the panel opens, false when it closes.
   */
  const setOpen = (next: boolean) => {
    if (!next) closedAt.current = Date.now()
    if (openProp === undefined) setOwnOpen(next)
    onOpenChange?.(next)
  }
  /**
   * Shows or hides the trigger's tooltip: never while the panel is open or just after it closed.
   * @param next - true when Radix wants to show it (hover or focus).
   */
  const handleTooltip = (next: boolean) => setTooltipOpen(next && !open && Date.now() - closedAt.current > TOOLTIP_QUIET_MS)
  const physicalSide = (side === 'end') !== isRtl ? 'right' : 'left'
  // The tooltip's trigger wraps the sheet's (both pass their props down to the caller's button).
  const sheetTrigger = trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {sheetTrigger && tooltip ? (
        <Tooltip open={tooltipOpen} onOpenChange={handleTooltip}>
          <TooltipTrigger asChild>{sheetTrigger}</TooltipTrigger>
          <TooltipContent side="bottom">{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        sheetTrigger
      )}
      <SheetContent
        side={physicalSide}
        showCloseButton={false}
        onSwipeClose={() => setOpen(false)}
        // Without a description, an explicit undefined tells Radix there is none (no console warning).
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn(panelVariants({ size }), className)}
      >
        <SheetHeader className="flex-row items-start justify-between gap-4 border-b border-neutral-150 px-6 py-5">
          <div className="flex min-w-0 flex-col gap-1">
            <SheetTitle className="font-display text-xl font-bold text-brand-charcoal">{title}</SheetTitle>
            {description && <SheetDescription className="text-xs text-brand-charcoal-muted">{description}</SheetDescription>}
          </div>
          <SheetClose
            aria-label={closeLabel ?? t.offcanvas.close}
            className="-me-1 shrink-0 p-1 text-neutral-500 transition-[color,scale] outline-none hover:text-brand-charcoal focus-visible:ring-2 focus-visible:ring-brand-red active:scale-[0.97] active:duration-100"
          >
            <X size={20} aria-hidden="true" />
          </SheetClose>
        </SheetHeader>

        {notice && (
          <div data-slot="offcanvas-notice" className="border-b border-neutral-150 px-6 py-4">
            {notice}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && <SheetFooter className="mt-0 gap-3 border-t border-neutral-150 px-6 py-5">{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  )
}
