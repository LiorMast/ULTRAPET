/**
 * Offcanvas.tsx — A reusable side panel ("offcanvas") that slides in from the start or end edge of the page:
 * a titled header with a close button, a scrolling body and an optional footer pinned to the bottom.
 * Used by CartDrawer (the business customers' shopping cart); any other side panel (filters, details) should
 * use it too instead of building its own Sheet markup.
 *
 * Built on the shared Sheet primitive (ui/sheet.tsx, a Radix Dialog): it traps the focus, closes on Escape or a
 * click on the backdrop, locks the page's scroll, returns the focus to the trigger, and can be swiped closed
 * towards its edge. The side is logical: `end` is the right edge in English and the left edge in Hebrew.
 */
import { useState, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from 'cn'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useI18n } from '@/i18n'

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
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: 'start' | 'end'
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
 * @param props.open - Controlled open state; omit to let the panel keep its own.
 * @param props.onOpenChange - Called with the new state when the panel opens or closes (including swipes).
 * @param props.side - The logical edge it slides from: 'end' (default; right in English, left in Hebrew) or 'start'.
 * @param props.size - The panel's width from `sm` up: 'sm', 'md' (default) or 'lg'; phones always get the full width.
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
  open: openProp,
  onOpenChange,
  side = 'end',
  size,
  footer,
  closeLabel,
  className,
  children,
}: OffcanvasProps) {
  const { t, isRtl } = useI18n()
  const [ownOpen, setOwnOpen] = useState(false)
  const open = openProp ?? ownOpen
  /**
   * Stores the new state (when uncontrolled) and tells the caller.
   * @param next - true when the panel opens, false when it closes.
   */
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOwnOpen(next)
    onOpenChange?.(next)
  }
  const physicalSide = (side === 'end') !== isRtl ? 'right' : 'left'

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
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

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && <SheetFooter className="mt-0 gap-3 border-t border-neutral-150 px-6 py-5">{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  )
}
