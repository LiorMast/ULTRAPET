/**
 * DiscountRibbon.tsx — A small squircle badge that shows a discount, a sale or the stock status next to a product: a short
 * message on a brand color (the words say it, so the ready kinds carry no icon; an `icon` can still be given for a
 * message that needs one). It shares the Toast's color names but it is static page content, not a notification: no
 * portal, no timer, no live region.
 *
 * Ready kinds (RIBBON_KINDS): `kind="discount"` (brand red), `kind="sale"` (charcoal), and the stock statuses
 * `inStock` (green), `lowStock` (amber) and `outOfStock` (charcoal), which the catalog, the product page and the staff
 * products table share (STOCK_RIBBONS), and `hidden` (outlined: a product hidden from customers, on the staff's manage
 * mode cards); or any color of your own. `placement="corner"` floats the badge 12px inside
 * the top inline-start corner of its nearest positioned parent (give the card `relative`, as CatalogCard has); the
 * default `inline` leaves it in the flow, e.g. beside a price. Logical classes only, so it flips in RTL.
 *
 * Usage:
 *   <DiscountRibbon kind="discount" message="-15%" placement="corner" />
 *   <DiscountRibbon icon={Truck} color="success" message="Free delivery" />
 */
import { cva, type VariantProps } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react'
import { cn } from 'cn'

const ribbonVariants = cva('inline-flex w-fit max-w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold leading-none', {
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
      corner: 'absolute start-3 top-3 z-10 shadow-premium-sm',
    },
  },
  defaultVariants: { color: 'red', placement: 'inline' },
})

/** The ribbon's colors: the same names as the Toast's (`charcoal`, `red` (default), `light`, `success`, `warning`). */
export type RibbonColor = NonNullable<VariantProps<typeof ribbonVariants>['color']>

/** Where the ribbon sits: `inline` (in the flow, default) or `corner` (top inline-start of the positioned parent). */
export type RibbonPlacement = NonNullable<VariantProps<typeof ribbonVariants>['placement']>

/** The kinds of ribbon: each presets a color. */
export type RibbonKind = 'discount' | 'sale' | 'inStock' | 'lowStock' | 'outOfStock' | 'hidden'

/** The preset of each kind. */
export const RIBBON_KINDS: Record<RibbonKind, { color: RibbonColor }> = {
  discount: { color: 'red' },
  sale: { color: 'charcoal' },
  inStock: { color: 'success' },
  lowStock: { color: 'warning' },
  outOfStock: { color: 'charcoal' },
  hidden: { color: 'light' },
}

/** The ribbon kind of each stock status (StockStatus in api.ts: "in", "low", "out"). */
export const STOCK_RIBBONS = { in: 'inStock', low: 'lowStock', out: 'outOfStock' } as const satisfies Record<string, RibbonKind>

/**
 * The discount ribbon.
 * @param props.kind - A RibbonKind ('discount', 'sale', 'inStock', 'lowStock', 'outOfStock', 'hidden'): presets the color
 *   (RIBBON_KINDS); an explicit `color` still wins. Without a kind: red.
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
  const Icon = icon
  return (
    <span data-slot="discount-ribbon" data-kind={kind} className={cn(ribbonVariants({ color: color ?? preset?.color, placement }), className)}>
      {Icon && <Icon aria-hidden="true" className="size-3.5 shrink-0" />}
      {message}
    </span>
  )
}
