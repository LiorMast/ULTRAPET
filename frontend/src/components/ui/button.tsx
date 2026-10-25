/**
 * ui/button.tsx — The site's button (shadcn/ui, restyled for UltraPet).
 *
 * The default variant is the legacy `.btn-primary`: brand red, uppercase Montserrat with wide
 * letter-spacing, lifting slightly with a red glow on hover. Sizes: "default" (legacy px-8 py-4) and
 * "sm" (the header's call to action). The "ghostWhite" variant is the white-outline button for dark photo
 * backgrounds (hero), from legacy `.btn-ghost-white`. The other shadcn variants and icon sizes are kept for
 * shadcn components that use them. Use `asChild` to style a <Link> or <a> as a button.
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary font-heading font-semibold uppercase tracking-widest text-primary-foreground duration-300 hover:-translate-y-0.5 hover:bg-brand-red-dark hover:shadow-red active:translate-y-0",
        ghostWhite:
          "border-white/40 font-heading font-semibold uppercase tracking-widest text-white duration-300 hover:-translate-y-0.5 hover:border-white hover:bg-white/10 active:translate-y-0",
        outline:
          "border-border bg-background shadow-xs hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "gap-2 px-8 py-4 text-xs",
        sm: "gap-2 px-6 py-3 text-2xs",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
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
 * @param props.variant - Visual style; "default" is the brand-red primary button, "ghostWhite" a white outline for dark backgrounds.
 * @param props.size - "default", "sm" (header), or one of the shadcn icon/compact sizes.
 * @param props.asChild - Render the child element instead of a <button>, merging the button styles into it.
 * @param props.className - Extra classes, merged over the variant classes.
 * @param props - Any other <button> attributes.
 * @returns The styled button element.
 */
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
