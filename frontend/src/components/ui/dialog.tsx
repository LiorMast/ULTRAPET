/**
 * ui/dialog.tsx — A modal dialog (shadcn/ui on Radix Dialog), restyled for the brand.
 *
 * Used by DataTable for its edit form and its delete confirmation. Radix traps keyboard focus inside the
 * dialog, closes it on Escape or a click on the backdrop, stops the page behind it from scrolling, hides the
 * page from screen readers while it is open, and returns focus to the element that opened it. Every dialog
 * needs a DialogTitle (screen readers announce it) and, ideally, a DialogDescription.
 *
 * Look: white panel with square corners and the premium shadow over the same dimmed, blurred backdrop as the
 * mobile drawer (ui/sheet.tsx). Motion: fades and zooms in from 95% on the site's spring curve; reduced motion
 * keeps only the fade (global rule in index.css).
 */
import * as React from "react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

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
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-black/50 ease-spring supports-backdrop-filter:backdrop-blur-xs reduced-transparency:backdrop-blur-none data-open:animate-in data-open:fade-in-0 data-open:duration-300 data-closed:animate-out data-closed:fade-out-0 data-closed:duration-200"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed start-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-y-1/2 flex-col bg-white text-brand-charcoal shadow-premium outline-none ltr:-translate-x-1/2 rtl:translate-x-1/2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:duration-300 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:duration-200",
          className
        )}
        {...props}
      >
        {children}
        {closeLabel && (
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="absolute end-4 top-4 p-1 text-brand-charcoal-muted transition-colors hover:text-brand-charcoal focus-visible:outline-2 focus-visible:outline-brand-red active:scale-[0.97] active:duration-100"
          >
            <XIcon className="size-5" aria-hidden />
          </DialogPrimitive.Close>
        )}
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
  return <div data-slot="dialog-header" className={cn("space-y-2 border-b border-neutral-150 px-6 pt-6 pb-4 pe-12", className)} {...props} />
}

/**
 * The dialog's action row (e.g. Cancel / Save), below the body.
 * @param props.className - Extra classes.
 * @param props - Other <div> attributes.
 * @returns The footer.
 */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-3 border-t border-neutral-150 px-6 py-4 sm:flex-row sm:justify-end", className)}
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
