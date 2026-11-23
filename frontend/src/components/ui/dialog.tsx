/**
 * ui/dialog.tsx — A modal dialog (shadcn/ui on Radix Dialog), restyled for the brand.
 *
 * Used by DataTable for its edit form and its delete confirmation. Radix traps keyboard focus inside the
 * dialog, closes it on Escape or a click on the backdrop, stops the page behind it from scrolling, hides the
 * page from screen readers while it is open, and returns focus to the element that opened it. Every dialog
 * needs a DialogTitle (screen readers announce it) and, ideally, a DialogDescription.
 *
 * Look: a white rounded panel (rounded-2xl) with the premium shadow over the same dimmed, blurred backdrop as the
 * mobile drawer (ui/sheet.tsx); a round close button. Motion: fades, rises 8px and zooms in from 95% on the site's
 * spring curve; reduced motion keeps only the fade (global rule in index.css).
 *
 * Mobile-first: on a phone (below sm) the dialog is a bottom sheet, like a phone's own: full width, rounded on top,
 * sliding up from the bottom edge, at most the screen below the header tall, with a grabber bar; dragging the grabber or
 * the header down closes it (useSwipeToClose). Its footer pads for the phone's home bar and puts its buttons side by
 * side at equal widths (the primary one at the inline end), wrapping only when they don't fit. The close button is 44px
 * on touch screens.
 */
import * as React from "react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"
import { useSwipeToClose } from "@/components/ui/sheet"

/** Where a phone's dialog sheet may be dragged down from: its grabber or its header (the body scrolls instead). */
const DIALOG_HANDLE = '[data-slot="dialog-grabber"], [data-slot="dialog-header"]'

/** Whether the window is phone-sized, where the dialog is a bottom sheet (Tailwind's sm breakpoint, 40rem). */
const isPhone = () => window.matchMedia("(width < 40rem)").matches

/**
 * Root of a dialog; holds the open/closed state.
 * @param props - Radix Dialog.Root props (open, onOpenChange, ...).
 * @returns The dialog root.
 */
function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

/**
 * A button that closes the dialog (use `asChild` to style your own button).
 * @param props - Radix Dialog.Close props.
 * @returns The close control.
 */
function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

/**
 * The dialog panel, centred over a dimmed backdrop and rendered in a portal.
 * @param props.className - Extra classes merged over the defaults (e.g. a wider `max-w-*`).
 * @param props.closeLabel - Accessible name of the X button in the corner; omit it to show no X button.
 * @param props.children - The dialog's header, body and footer.
 * @param props - Other Radix Dialog.Content props.
 * @returns The panel with its backdrop.
 */
function DialogContent({
  className,
  closeLabel,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { closeLabel?: string }) {
  const close = React.useRef<HTMLButtonElement>(null)
  // A drag that ends in closing clicks the close button: Radix then closes the dialog through the caller's own
  // onOpenChange, exactly like a tap on the X (or Escape), and gives the focus back.
  const { overlay, handlers } = useSwipeToClose("bottom", () => close.current?.click(), { handle: DIALOG_HANDLE, enabled: isPhone })
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        ref={overlay}
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-black/50 ease-spring supports-backdrop-filter:backdrop-blur-xs reduced-transparency:backdrop-blur-none data-open:animate-in data-open:fade-in-0 data-open:duration-300 data-closed:animate-out data-closed:fade-out-0 data-closed:duration-200"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // Mobile-first: a phone's bottom sheet (see the header), centred on the screen from sm. The width cap is a plain
          // class (max-w-lg), so a caller's own max-w-* replaces it.
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[calc(100dvh-var(--header-h))] w-full max-w-lg flex-col overscroll-contain rounded-t-3xl bg-white text-brand-charcoal shadow-premium outline-none data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom data-open:duration-450 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom data-closed:duration-300 [&_[data-slot=dialog-header]]:touch-none",
          "sm:inset-x-auto sm:start-1/2 sm:top-1/2 sm:bottom-auto sm:mx-0 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:-translate-y-1/2 sm:rounded-2xl sm:ltr:-translate-x-1/2 sm:rtl:translate-x-1/2 sm:data-open:zoom-in-95 sm:data-open:slide-in-from-bottom-2 sm:data-open:duration-300 sm:data-closed:zoom-out-95 sm:data-closed:slide-out-to-bottom-0 sm:data-closed:duration-200 sm:[&_[data-slot=dialog-header]]:touch-auto",
          className
        )}
        {...handlers}
        {...props}
      >
        <div data-slot="dialog-grabber" aria-hidden="true" className="absolute inset-x-0 top-0 flex h-6 touch-none justify-center pt-2 sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-neutral-300 [corner-shape:round]" />
        </div>
        {children}
        {/* Always rendered (hidden when the caller wants no X), so a drag can close the dialog through it. */}
        <DialogPrimitive.Close
          ref={close}
          aria-label={closeLabel}
          hidden={!closeLabel}
          className="absolute end-3 top-3 flex size-9 items-center justify-center rounded-lg text-brand-charcoal-muted transition-[color,background-color,scale] duration-150 hover:bg-neutral-100 hover:text-brand-charcoal focus-visible:outline-2 focus-visible:outline-brand-red active:scale-[0.94] active:duration-100 pointer-coarse:size-11"
        >
          <XIcon className="size-5" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

/**
 * The dialog's heading block (title and description), above the body.
 * @param props.className - Extra classes.
 * @param props - Other <div> attributes.
 * @returns The header.
 */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("space-y-2 border-b border-neutral-150 px-5 pt-6 pb-4 pe-16 sm:px-6 sm:pe-14", className)} {...props} />
}

/**
 * The dialog's action row (e.g. Cancel / Save), below the body: on a phone the buttons share the row at equal widths.
 * @param props.className - Extra classes.
 * @param props - Other <div> attributes.
 * @returns The footer.
 */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-wrap gap-3 border-t border-neutral-150 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:[&>*]:min-w-fit max-sm:[&>*]:flex-1 sm:flex-nowrap sm:justify-end sm:px-6 sm:pb-4",
        className
      )}
      {...props}
    />
  )
}

/**
 * The dialog's title; Radix links it to the panel as its accessible name.
 * @param props.className - Extra classes.
 * @param props - Other Radix Dialog.Title props.
 * @returns The title heading.
 */
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("font-display text-xl font-bold", className)} {...props} />
}

/**
 * The dialog's description; Radix links it to the panel as its accessible description.
 * @param props.className - Extra classes.
 * @param props - Other Radix Dialog.Description props.
 * @returns The description paragraph.
 */
function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-sm text-brand-charcoal-muted", className)} {...props} />
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle }
