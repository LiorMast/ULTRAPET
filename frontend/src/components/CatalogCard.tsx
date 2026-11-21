/**
 * CatalogCard.tsx — One product in a catalog, as a rounded card: the photo in an inset rounded well (it fades in once
 * loaded; on hover the card's border darkens and it gains a soft shadow, nothing moves), category, name, and a price slot. The card knows
 * nothing about who is signed in; the caller decides through props whether the price is shown, still
 * loading, or hidden behind a "log in to see the price" link. Two layouts (`variant`): `grid` (a tile) and
 * `list` (a horizontal row, e.g. for a list view or the B2B order screen).
 * The whole card links to the product's page (/products/$slug); the login link of the price slot and, when the
 * price is shown (a signed-in customer), the "Add to cart" button (AddToCartButton, adds 1) stay clickable above it.
 * With the price, the caller may pass the product's stock status: "low" adds a "Low stock" ribbon under the price,
 * "out" turns the button into a disabled "Out of stock" one (untracked products and "in" show nothing extra).
 * A discounted price (priceFor fills `discount` from /api/prices) shows the list price struck out and the total
 * percentage of all discounts combined ("-28%") beside it, and one ribbon per kind of discount ("Sale", "Your
 * discount", DiscountRibbons) in the colors staff chose, over the photo's corner. A product with bulk prices gets a
 * footnote under the price (BulkNote: the first tier on a card, every tier on the product page).
 * Staff in manage mode (ProductManager.tsx): the caller passes `manage`, the product's staff strip, which takes the
 * price slot's place (rendered in a Suspense, since the strip is loaded lazily), and `inactive` for a product hidden
 * from customers (its photo dims and a "Hidden from customers" ribbon sits in the corner).
 * While its photo downloads, the photo's well shimmers (img-frame). CatalogCardSkeleton is the card's loading
 * placeholder, in the same frame (the pages' first-load skeletons, PageSkeleton.tsx).
 * Used by the Catalog component and the product page's "You may also like" row. Also exports the price and stock
 * helpers the product page and the cart share (priceFor, stockFor, PriceSlot, formatPrice).
 */
import { Suspense, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { AddToCartButton, CART_FLY_SOURCE_ATTR } from '@/components/AddToCartButton'
import { DiscountRibbon, DiscountRibbons } from '@/components/DiscountRibbon'
import { textLinkVariants } from '@/components/TextLink'
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'
import type { BulkTier, PriceDiscount, Product, RibbonColors, StockStatus } from '@/api'
import type { CustomerPrices } from '@/auth'
import { localized } from '@/config'
import { useI18n, type Locale } from '@/i18n'
import { imgFade } from '@/motion'

/** Why a shown price is below the list price: the list price, the kinds of discount and each kind's ribbon color. */
export type ShownDiscount = PriceDiscount & { colors: RibbonColors }

/**
 * The price slot: hidden (signed out), loading, or the price in shekels (with its `discount` when it is below the
 * list price, and its `bulk` tiers when it has some).
 */
export type PriceState = { status: 'hidden' } | { status: 'loading' } | { status: 'shown'; price: number; discount?: ShownDiscount; bulk?: BulkTier[] }

/**
 * The price slot of one product.
 * @param prices - The signed-in customer's prices (undefined = signed out).
 * @param id - The product id.
 * @returns The PriceState for its card; a product without a price stays hidden.
 */
export function priceFor(prices: CustomerPrices | undefined, id: string): PriceState {
  if (!prices) return { status: 'hidden' }
  if (prices.status === 'loading') return { status: 'loading' }
  const price = prices.prices[id]
  if (price === undefined) return { status: 'hidden' }
  const discount = prices.discounts[id]
  const bulk = prices.bulk[id]
  return {
    status: 'shown',
    price,
    ...(discount && price < discount.listPrice && { discount: { ...discount, colors: prices.ribbonColors } }),
    ...(bulk && bulk.length > 0 && { bulk }),
  }
}

/**
 * The total discount of a price, all discounts combined, as a whole percentage of the list price.
 * @param listPrice - The list price in shekels.
 * @param price - The customer's price in shekels (below the list price).
 * @returns E.g. 28 for ₪72 instead of ₪100; at least 1, so a small discount never reads "-0%".
 */
export function discountPercent(listPrice: number, price: number): number {
  return Math.max(1, Math.round((1 - price / listPrice) * 100))
}

/**
 * The stock status of one product, for the signed-in customer.
 * @param prices - The signed-in customer's prices and stock statuses (undefined = signed out).
 * @param id - The product id.
 * @returns "in", "low" or "out"; undefined when signed out, still loading, or the product's stock is not tracked.
 */
export function stockFor(prices: CustomerPrices | undefined, id: string): StockStatus | undefined {
  return prices?.status === 'loaded' ? prices.stock[id] : undefined
}

/**
 * Formats an amount of shekels the way the site shows prices (e.g. "₪1,234.50", "‏1,234.50 ₪").
 * @param locale - The page language.
 * @param amount - Shekels.
 * @param options.whole - true = no agorot (e.g. the ₪2,000 minimum order).
 * @returns The formatted amount.
 */
export function formatPrice(locale: Locale, amount: number, { whole = false }: { whole?: boolean } = {}): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS', ...(whole && { maximumFractionDigits: 0 }) }).format(amount)
}

const cardVariants = cva('group relative flex rounded-2xl border border-neutral-200 bg-white p-2 transition-[box-shadow,border-color] duration-300 hover:border-neutral-300 hover:shadow-soft', {
  variants: {
    variant: {
      grid: 'flex-col',
      list: 'flex-row items-stretch',
    },
  },
  defaultVariants: { variant: 'grid' },
})

const photoVariants = cva('img-frame relative shrink-0 overflow-hidden rounded-xl bg-neutral-100', {
  variants: {
    variant: {
      grid: 'aspect-square w-full',
      list: 'aspect-square w-28 sm:w-36',
    },
  },
  defaultVariants: { variant: 'grid' },
})

/**
 * The price slot of a product (a card, the product page).
 * @param props.state - What to show (see PriceState).
 * @param props.size - `sm` on a card (default), `lg` on the product page.
 * @returns The price, a loading line, or the login link (above a card's stretched link, so it stays clickable).
 */
export function PriceSlot({ state, size = 'sm' }: { state: PriceState; size?: 'sm' | 'lg' }) {
  const { t, locale } = useI18n()
  if (state.status === 'hidden') {
    return (
      <Link
        to="/login"
        className={cn(textLinkVariants(), 'relative z-10', size === 'lg' ? 'text-base' : 'text-xs')}
      >
        {t.catalog.loginToSee}
      </Link>
    )
  }
  if (state.status === 'loading') {
    return (
      <span className="block">
        <Skeleton className={size === 'lg' ? 'h-9 w-40' : 'h-6 w-24'} />
        <span className="sr-only">{t.catalog.loadingPrice}</span>
      </span>
    )
  }
  const price = formatPrice(locale, state.price)
  const { discount } = state
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="sr-only">{t.catalog.priceLabel}: </span>
      <span className={cn('font-display font-bold text-brand-charcoal', size === 'lg' ? 'text-3xl' : 'text-xl')}>{price}</span>
      {discount && (
        <>
          <span className="sr-only">{t.catalog.listPrice}: </span>
          <s className={cn('text-brand-charcoal-muted', size === 'lg' ? 'text-base' : 'text-xs')}>{formatPrice(locale, discount.listPrice)}</s>
          <span className={cn('font-semibold text-brand-red-dark', size === 'lg' ? 'text-base' : 'text-xs')}>
            <span className="sr-only">{t.catalog.totalDiscount}: </span>
            <span dir="ltr">-{discountPercent(discount.listPrice, state.price).toLocaleString(locale)}%</span>
          </span>
        </>
      )}
      <span className="text-2xs text-brand-charcoal-muted">{t.catalog.exVat}</span>
    </p>
  )
}

/**
 * The bulk prices footnote under a price: on a card (`size="sm"`) the first tier, and a pointer to the product page
 * when there are more; on the product page (`lg`) every tier with its saving off the list price. The cart
 * prices a line at the bulk price its quantity reaches, which the note says.
 * @param props.tiers - The product's bulk tiers, lowest threshold first.
 * @param props.listPrice - The list price the savings are taken from (the discount's, else the one-unit price).
 * @param props.size - `sm` on a card (default), `lg` on the product page.
 * @param props.className - Extra classes.
 * @returns The footnote, or nothing without tiers.
 */
export function BulkNote({ tiers, listPrice, size = 'sm', className }: { tiers: BulkTier[]; listPrice: number; size?: 'sm' | 'lg'; className?: string }) {
  const { t, locale } = useI18n()
  if (tiers.length === 0) return null
  /**
   * One tier's words.
   * @param tier - The tier.
   * @returns E.g. "From 12 units: ₪85.50 per unit".
   */
  const line = (tier: BulkTier) =>
    t.catalog.bulkFrom.replace('{quantity}', tier.minQuantity.toLocaleString(locale)).replace('{price}', formatPrice(locale, tier.price))
  if (size === 'sm') {
    return (
      <p data-slot="bulk-note" className={cn('text-xs leading-snug text-brand-charcoal-muted', className)}>
        <span aria-hidden="true">* </span>
        {line(tiers[0])}
        {tiers.length > 1 && ` · ${t.catalog.bulkMore}`}
      </p>
    )
  }
  return (
    <div data-slot="bulk-note" className={cn('text-sm text-brand-charcoal-muted', className)}>
      <p className="font-semibold text-brand-charcoal">
        <span aria-hidden="true">* </span>
        {t.catalog.bulkTitle}
      </p>
      <ul className="mt-1.5 space-y-1">
        {tiers.map((tier) => (
          <li key={tier.minQuantity}>
            {line(tier)}{' '}
            <span className="font-semibold text-brand-red-dark">
              (<span dir="ltr">-{discountPercent(listPrice, tier.price).toLocaleString(locale)}%</span>)
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs">{t.catalog.bulkCheckout}</p>
    </div>
  )
}

/**
 * One product card.
 * @param props.product - The product to show.
 * @param props.categoryName - The product's category, already translated (shown above the name).
 * @param props.price - The price slot (see PriceState); hidden by default. When shown, the card also gets an
 *   "Add to cart" button, and with a `discount` its ribbons over the photo.
 * @param props.stock - The product's stock status (stockFor), used only with a shown price: "low" adds a ribbon,
 *   "out" disables the button; undefined = not tracked.
 * @param props.manage - The staff's management strip (manage mode), shown instead of the price slot; omit for the
 *   customer view.
 * @param props.inactive - The product is hidden from customers (manage mode shows it anyway): dims the photo and adds
 *   the "Hidden from customers" ribbon.
 * @param props.variant - `grid` (tile, default) or `list` (row).
 * @param props.headingLevel - The name's heading tag, so the card fits the page outline; default "h3".
 * @param props.className - Extra classes for the card.
 * @returns The card element (an <article>) whose name links to the product's page.
 */
export function CatalogCard({
  product,
  categoryName,
  price = { status: 'hidden' },
  stock,
  manage,
  inactive = false,
  variant,
  headingLevel: Heading = 'h3',
  className,
}: {
  product: Product
  categoryName?: string
  price?: PriceState
  stock?: StockStatus
  manage?: ReactNode
  inactive?: boolean
  headingLevel?: 'h2' | 'h3'
  className?: string
} & VariantProps<typeof cardVariants>) {
  const { t, locale } = useI18n()
  return (
    <article {...{ [CART_FLY_SOURCE_ATTR]: '' }} className={cn(cardVariants({ variant }), className)}>
      {inactive && <DiscountRibbon kind="hidden" message={t.manage.hidden} placement="corner" />}
      {!manage && price.status === 'shown' && price.discount && (
        <DiscountRibbons types={price.discount.types} colors={price.discount.colors} placement="corner" />
      )}
      <div className={cn(photoVariants({ variant }), inactive && 'opacity-50')}>
        {product.image && (
          <img
            src={product.image.thumbnail}
            srcSet={`${product.image.thumbnail} 300w, ${product.image.srcSet}`}
            sizes={variant === 'list' ? '144px' : '(min-width: 1280px) 20vw, (min-width: 1024px) 28vw, 45vw'}
            alt=""
            width={300}
            height={300}
            loading="lazy"
            decoding="async"
            {...imgFade}
            className="img-fade size-full object-contain p-3 mix-blend-multiply sm:p-4"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-2 pt-3 sm:p-3 sm:pt-4">
        {categoryName && <p className="font-heading text-xs font-semibold text-brand-red-dark">{categoryName}</p>}
        {/* Exactly three lines tall (the clamp; the height also cuts a line a mixed-direction name lets through), so the divider and the price row line up across a row of cards. */}
        <Heading className="line-clamp-3 h-[3lh] text-sm font-semibold leading-snug text-brand-charcoal">
          {/* The stretched link: its ::after covers the card, so the whole card opens the product. */}
          <Link
            to="/products/$slug"
            params={{ slug: product.slug }}
            className="transition-colors duration-300 after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-red/60 group-hover:text-brand-red-dark"
          >
            {localized(product.name, locale)}
          </Link>
        </Heading>
        {/* Takes the spare height of the row, so the Add to cart buttons sit on one line at the bottom. */}
        <div className="flex flex-1 flex-col border-t border-neutral-150 pt-3">
          {manage ? (
            <Suspense fallback={null}>{manage}</Suspense>
          ) : (
            <>
              <PriceSlot state={price} />
              {price.status === 'shown' && price.bulk && (
                <BulkNote tiers={price.bulk} listPrice={price.discount?.listPrice ?? price.price} className="mt-1.5" />
              )}
              {price.status === 'shown' && stock === 'low' && <DiscountRibbon kind="lowStock" message={t.stock.low} className="mt-2" />}
              {price.status === 'shown' && (
                <div className="mt-auto pt-3">
                  <AddToCartButton
                    product={{ id: product.id, slug: product.slug, name: product.name, image: product.image?.thumbnail ?? null, unitPrice: price.price, bulk: price.bulk }}
                    available={stock !== 'out'}
                    className="z-10"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  )
}

/**
 * The loading placeholder of a product card: the same frame, photo well and text rows, as skeletons.
 * @param props.variant - `grid` (tile, default) or `list` (row), as the card it stands for.
 * @param props.className - Extra classes for the card.
 * @returns The decorative placeholder card (put it inside a SkeletonGroup).
 */
export function CatalogCardSkeleton({ variant, className }: { className?: string } & VariantProps<typeof cardVariants>) {
  return (
    <div aria-hidden="true" className={cn(cardVariants({ variant }), 'pointer-events-none', className)}>
      <div className={photoVariants({ variant })}>
        <Skeleton className="size-full rounded-none" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-2 pt-3 sm:p-3 sm:pt-4">
        <SkeletonText className="text-xs" width="w-1/3" />
        <SkeletonText lines={2} className="h-[3lh] text-sm leading-snug" />
        <div className="flex flex-1 flex-col border-t border-neutral-150 pt-3">
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
    </div>
  )
}
