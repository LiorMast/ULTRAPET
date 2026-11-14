/**
 * ui/button.tsx — The site's button (shadcn/ui, restyled for UltraPet).
 *
 * Every button is a pill (rounded-full) with a sentence-case semibold label. The default variant is the brand-red
 * primary action, lifting slightly with a red glow on hover. Every variant reacts the instant it is pressed (scales to
 * 97% in 100ms) and springs back on release, so a press never feels dead. Sizes: "default" (48px tall) and "sm" (40px,
 * dialogs and the header). The "ghostWhite" variant is the white-outline button for dark photo backgrounds (hero). The
 * "action" variant with size "action" is a record's action (the admin tables' Edit / Discounts / Delete): outlined,
 * filled charcoal on hover; "actionDanger" is the same for a destructive one (red outline and fill). The other shadcn
 * variants and icon sizes are kept for shadcn components that use them. Use `asChild` to style a <Link> or <a> as a
 * button.
 *
 * `loading` is the waiting state of an action that calls the server (Save, Sign in, Delete ...): the label fades out
 * and a Spinner fades in, in the same grid cell, so the button keeps its exact size; both fades wait 150ms, so a quick
 * answer shows no flicker. While loading the button is aria-busy and aria-disabled (not `disabled`, so the keyboard
 * focus stays on it), and it swallows clicks: a second click, or Enter in the form (implicit submission clicks the
 * submit button), sends nothing. Its accessible name stays the visible label. Pass `loading` (true or false) to every
 * button that waits on the server; leave it out elsewhere (the children then render as they are).
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"
import { SpinnerRing } from "@/components/ui/spinner"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:not-data-loading:scale-[0.97] active:not-aria-[haspopup]:duration-100 disabled:pointer-events-none disabled:opacity-50 data-loading:cursor-progress aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary font-heading font-semibold text-primary-foreground duration-300 hover:not-data-loading:-translate-y-0.5 hover:bg-brand-red-dark hover:shadow-red active:translate-y-0",
        ghostWhite:
          "border-white/50 font-heading font-semibold text-white duration-300 hover:-translate-y-0.5 hover:border-white hover:bg-white/10 active:translate-y-0",
        outline:
          "border-neutral-300 bg-background font-semibold duration-300 hover:border-brand-charcoal hover:bg-neutral-50 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
        action:
          "border-neutral-300 bg-white font-heading font-semibold text-brand-charcoal duration-200 hover:border-brand-charcoal hover:bg-brand-charcoal hover:text-white focus-visible:border-brand-red focus-visible:ring-brand-red/40",
        actionDanger:
          "border-brand-red/40 bg-white font-heading font-semibold text-brand-red-dark duration-200 hover:border-brand-red hover:bg-brand-red hover:text-white focus-visible:border-brand-red focus-visible:ring-brand-red/40",
      },
      size: {
        default: "gap-2 px-7 py-3.5 text-sm",
        sm: "gap-2 px-5 py-2.5 text-sm",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        action: "h-9 gap-1.5 px-4 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-2.5",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * A button, or — with `asChild` — any single child element (such as a router <Link>) styled as one.
 * @param props.variant - Visual style; "default" is the brand-red primary button, "ghostWhite" a white outline for dark
 *   backgrounds, "action" / "actionDanger" a record's action in a table row.
 * @param props.size - "default", "sm" (header), "action" (with the action variants), or one of the shadcn icon/compact sizes.
 * @param props.asChild - Render the child element instead of a <button>, merging the button styles into it.
 * @param props.loading - The server is working on this button's action: shows the spinner and ignores clicks (see the
 *   header). Undefined = a button that never waits (its children render unwrapped). Ignored with `asChild`.
 * @param props.children - The label (text and optional icon).
 * @param props.onClick - Click handler; not called while loading.
 * @param props.className - Extra classes, merged over the variant classes.
 * @param props - Any other <button> attributes.
 * @returns The styled button element.
 */
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const waits = loading !== undefined && !asChild
  const busy = waits && loading

  /**
   * Runs the button's click handler, or swallows the click while loading (also stopping a submit button's form).
   * @param event - The click.
   */
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (busy) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={busy || undefined}
      aria-busy={busy || undefined}
      className={cn(buttonVariants({ variant, size, className }), waits && "grid")}
      onClick={handleClick}
      {...props}
      aria-disabled={busy || props["aria-disabled"]}
    >
      {waits ? (
        <>
          <span className="col-start-1 row-start-1 inline-flex items-center justify-center gap-[inherit] transition-opacity duration-200 group-data-loading/button:opacity-0 group-data-loading/button:delay-150">
            {children}
          </span>
          {/* The ring exists only while loading: an idle button runs no endless animation (tests wait for animations to end). */}
          <span aria-hidden="true" className="col-start-1 row-start-1 flex items-center justify-center opacity-0 transition-opacity duration-200 group-data-loading/button:opacity-100 group-data-loading/button:delay-150">
            {busy && <SpinnerRing />}
          </span>
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
