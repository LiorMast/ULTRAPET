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
 * Staff-chosen colors: `customColor` ("#rrggbb") paints the ribbon in any color, with white or charcoal text,
 * whichever contrasts more (black on the few mid-tones where neither reaches 4.5:1: readableTextColor). DiscountRibbons renders the discount ribbons of one
 * product (one per kind of discount, DiscountType, in the colors staff set in /admin/discounts): over a catalog card's
 * photo (`placement="corner"`, CatalogCard) or above the product page's price.
 *
 * Usage:
 *   <DiscountRibbon kind="discount" message="-15%" placement="corner" />
 *   <DiscountRibbon icon={Truck} color="success" message="Free delivery" />
 *   <DiscountRibbon customColor="#0055AA" message="Sale" />
 *   <DiscountRibbons types={['general', 'customer']} colors={ribbonColors} placement="corner" />
 */
import { cva, type VariantProps } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import type { DiscountType, RibbonColors } from '@/api'
import { useI18n } from '@/i18n'

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

/** The text colors a custom-colored ribbon can take: white, the brand charcoal, and black for mid-tones. */
const WHITE = '#FFFFFF'
const CHARCOAL = '#1A1A1A'
const BLACK = '#000000'

/**
 * The relative luminance of a color (WCAG 2.1).
 * @param hex - "#rrggbb".
 * @returns 0 (black) to 1 (white).
 */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * The contrast ratio of two colors (WCAG 2.1).
 * @param a - "#rrggbb".
 * @param b - "#rrggbb".
 * @returns 1 (none) to 21 (black on white).
 */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/**
 * The text color that reads best on a background: white or the brand charcoal, whichever contrasts more; on a mid-tone
 * where neither reaches 4.5:1, black (white or black always does).
 * @param background - "#rrggbb".
 * @returns "#FFFFFF", "#1A1A1A" or "#000000".
 */
export function readableTextColor(background: string): string {
  const onWhite = contrastRatio(background, WHITE)
  const onCharcoal = contrastRatio(background, CHARCOAL)
  if (Math.max(onWhite, onCharcoal) >= 4.5) return onWhite >= onCharcoal ? WHITE : CHARCOAL
  return onWhite >= contrastRatio(background, BLACK) ? WHITE : BLACK
}

/**
 * The discount ribbon.
 * @param props.kind - A RibbonKind ('discount', 'sale', 'inStock', 'lowStock', 'outOfStock', 'hidden'): presets the color
 *   (RIBBON_KINDS); an explicit `color` still wins. Without a kind: red.
 * @param props.icon - A lucide icon shown before the message (decorative), or none.
 * @param props.message - The text of the ribbon (already translated, e.g. "-15%" or "Sale").
 * @param props.color - The background color (RibbonColor; default: the kind's, else 'red').
 * @param props.customColor - A background color of staff's own ("#rrggbb"), with readableTextColor text; wins over
 *   `color` and the kind.
 * @param props.placement - 'inline' (default) or 'corner' (pinned to the top inline-start corner of the parent).
 * @param props.className - Extra classes on the ribbon.
 * @returns The ribbon element.
 */
export function DiscountRibbon({
  kind,
  icon,
  message,
  color,
  customColor,
  placement,
  className,
}: {
  kind?: RibbonKind
  icon?: LucideIcon
  message: string
  color?: RibbonColor
  customColor?: string
  placement?: RibbonPlacement
  className?: string
}) {
  const preset = kind ? RIBBON_KINDS[kind] : undefined
  const Icon = icon
  return (
    <span
      data-slot="discount-ribbon"
      data-kind={kind}
      className={cn(ribbonVariants({ color: color ?? preset?.color, placement }), className)}
      style={customColor ? { backgroundColor: customColor, color: readableTextColor(customColor) } : undefined}
    >
      {Icon && <Icon aria-hidden="true" className="size-3.5 shrink-0" />}
      {message}
    </span>
  )
}

/**
 * The discount ribbons of one product: one per kind of discount that lowered its price, each in its staff-chosen color
 * and named by the kind ("Sale", "Your discount"); the total percentage is the price slot's (PriceSlot).
 * @param props.types - The kinds of discount, in display order (from /api/prices `discounts`).
 * @param props.colors - Each kind's ribbon color (from /api/prices `ribbonColors`).
 * @param props.placement - `corner` (stacked over the top inline-start corner of the positioned parent, e.g. a catalog
 *   card's photo; clicks pass through to the card) or `inline` (a wrapping row in the flow, default).
 * @param props.className - Extra classes on the group.
 * @returns The ribbons, or nothing when there are no types.
 */
export function DiscountRibbons({
  types,
  colors,
  placement = 'inline',
  className,
}: {
  types: DiscountType[]
  colors: RibbonColors
  placement?: RibbonPlacement
  className?: string
}) {
  const { t } = useI18n()
  if (types.length === 0) return null
  return (
    <div
      data-slot="discount-ribbons"
      className={cn(
        placement === 'corner' ? 'pointer-events-none absolute start-3 top-3 z-10 flex flex-col items-start gap-1.5' : 'flex flex-wrap gap-2',
        className,
      )}
    >
      {types.map((type) => (
        <DiscountRibbon
          key={type}
          kind="discount"
          customColor={colors[type]}
          message={t.catalog.discountTypes[type]}
          className={placement === 'corner' ? 'shadow-premium-sm' : undefined}
        />
      ))}
    </div>
  )
}
