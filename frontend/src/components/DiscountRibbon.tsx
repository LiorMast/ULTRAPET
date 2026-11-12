/**
 * DiscountRibbon.tsx — A small ribbon that shows a discount, a sale or the stock status next to a product: an optional
 * icon and a short message on a brand color. It is built like the Toast (same color names, same optional lucide icon) but it is
 * static page content, not a notification: no portal, no timer, no live region.
 *
 * Ready kinds (RIBBON_KINDS): `kind="discount"` (brand red, percent sign), `kind="sale"` (charcoal, tag), and the stock
 * statuses `inStock` (green, package check), `lowStock` (amber, warning triangle) and `outOfStock` (charcoal, package
 * cross), which the catalog, the product page and the staff products table share (STOCK_RIBBONS); or any icon + color
 * of your own. `placement="corner"` pins the ribbon flush to the top inline-start corner of its
 * nearest positioned parent (give the card `relative`, as CatalogCard has); the default `inline` leaves it in the
 * flow, e.g. beside a price. Logical classes only, so it flips in RTL.
 *
 * Usage:
 *   <DiscountRibbon kind="discount" message="-15%" placement="corner" />
 *   <DiscountRibbon icon={Truck} color="success" message="Free delivery" />
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { PackageCheck, PackageX, Percent, Tag, TriangleAlert, type LucideIcon } from 'lucide-react'
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
export type RibbonKind = 'discount' | 'sale' | 'inStock' | 'lowStock' | 'outOfStock'

/** The preset of each kind. */
export const RIBBON_KINDS: Record<RibbonKind, { icon: LucideIcon; color: RibbonColor }> = {
  discount: { icon: Percent, color: 'red' },
  sale: { icon: Tag, color: 'charcoal' },
  inStock: { icon: PackageCheck, color: 'success' },
  lowStock: { icon: TriangleAlert, color: 'warning' },
  outOfStock: { icon: PackageX, color: 'charcoal' },
}

/** The ribbon kind of each stock status (StockStatus in api.ts: "in", "low", "out"). */
export const STOCK_RIBBONS = { in: 'inStock', low: 'lowStock', out: 'outOfStock' } as const satisfies Record<string, RibbonKind>

/**
 * The discount ribbon.
 * @param props.kind - A RibbonKind ('discount', 'sale', 'inStock', 'lowStock', 'outOfStock'): presets the icon and the
 *   color (RIBBON_KINDS); an explicit `icon` or `color` still wins. Without a kind: no icon, red.
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
