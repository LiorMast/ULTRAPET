/**
 * DiscountRibbon.tsx — A small ribbon that shows a discount or a sale next to a product card: an optional icon and a
 * short message on a brand color. It is built like the Toast (same color names, same optional lucide icon) but it is
 * static page content, not a notification: no portal, no timer, no live region.
 *
 * Two ready kinds (RIBBON_KINDS): `kind="discount"` (brand red, percent sign) and `kind="sale"` (charcoal, tag); or
 * any icon + color of your own. `placement="corner"` pins the ribbon flush to the top inline-start corner of its
 * nearest positioned parent (give the card `relative`, as CatalogCard has); the default `inline` leaves it in the
 * flow, e.g. beside a price. Logical classes only, so it flips in RTL.
 *
 * Usage:
 *   <DiscountRibbon kind="discount" message="-15%" placement="corner" />
 *   <DiscountRibbon icon={Truck} color="success" message="Free delivery" />
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { Percent, Tag, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'

const ribbonVariants = cva('inline-flex w-fit max-w-full items-center gap-1.5 px-3 py-1.5 text-xs font-semibold leading-none', {
  variants: {
    color: {
      charcoal: 'bg-brand-charcoal text-white',
      red: 'bg-brand-red text-white',
      light: 'border border-neutral-200 bg-white text-brand-charcoal [&_svg]:text-brand-red',
      success: 'bg-success text-white',
      warning: 'bg-warning text-brand-charcoal',
    },
    placement: {
      inline: '',
      corner: 'absolute start-0 top-3 z-10 shadow-premium-sm',
    },
  },
  defaultVariants: { color: 'red', placement: 'inline' },
})

/** The ribbon's colors: the same names as the Toast's (`charcoal`, `red` (default), `light`, `success`, `warning`). */
export type RibbonColor = NonNullable<VariantProps<typeof ribbonVariants>['color']>

/** Where the ribbon sits: `inline` (in the flow, default) or `corner` (top inline-start of the positioned parent). */
export type RibbonPlacement = NonNullable<VariantProps<typeof ribbonVariants>['placement']>

/** The kinds of ribbon: each presets an icon and a color. */
export type RibbonKind = 'discount' | 'sale'

/** The preset of each kind. */
export const RIBBON_KINDS: Record<RibbonKind, { icon: LucideIcon; color: RibbonColor }> = {
  discount: { icon: Percent, color: 'red' },
  sale: { icon: Tag, color: 'charcoal' },
}

/**
 * The discount ribbon.
 * @param props.kind - 'discount' or 'sale': presets the icon and the color (RIBBON_KINDS); an explicit `icon` or
 *   `color` still wins. Without a kind: no icon, red.
 * @param props.icon - A lucide icon shown before the message (decorative), or none.
 * @param props.message - The text of the ribbon (already translated, e.g. "-15%" or "Sale").
 * @param props.color - The background color (RibbonColor; default: the kind's, else 'red').
 * @param props.placement - 'inline' (default) or 'corner' (pinned to the top inline-start corner of the parent).
 * @param props.className - Extra classes on the ribbon.
 * @returns The ribbon element.
 */
export function DiscountRibbon({
  kind,
  icon,
  message,
  color,
  placement,
  className,
}: {
  kind?: RibbonKind
  icon?: LucideIcon
  message: string
  color?: RibbonColor
  placement?: RibbonPlacement
  className?: string
}) {
  const preset = kind ? RIBBON_KINDS[kind] : undefined
  const Icon = icon ?? preset?.icon
  return (
    <span data-slot="discount-ribbon" data-kind={kind} className={cn(ribbonVariants({ color: color ?? preset?.color, placement }), className)}>
      {Icon && <Icon aria-hidden="true" className="size-3.5 shrink-0" />}
      {message}
    </span>
  )
}
