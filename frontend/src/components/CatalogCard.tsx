/**
 * CatalogCard.tsx — One product in a catalog: photo, category, name, and a price slot. The card knows
 * nothing about who is signed in; the caller decides through props whether the price is shown, still
 * loading, or hidden behind a "log in to see the price" link. Two layouts (`variant`): `grid` (a tile) and
 * `list` (a horizontal row, e.g. for a list view or the B2B order screen).
 * Used by the Catalog component.
 */
import { Link } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { localized, type Product } from '@/config'
import { useI18n } from '@/i18n'

/** The price slot: hidden (signed out), loading, or the price in shekels. */
export type PriceState = { status: 'hidden' } | { status: 'loading' } | { status: 'shown'; price: number }

const cardVariants = cva('group relative flex border border-neutral-200 bg-white transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-premium-sm', {
  variants: {
    variant: {
      grid: 'flex-col',
      list: 'flex-row items-stretch',
    },
  },
  defaultVariants: { variant: 'grid' },
})

const photoVariants = cva('relative shrink-0 overflow-hidden bg-neutral-50', {
  variants: {
    variant: {
      grid: 'aspect-square w-full border-b border-neutral-150',
      list: 'aspect-square w-28 border-e border-neutral-150 sm:w-36',
    },
  },
  defaultVariants: { variant: 'grid' },
})

/**
 * The price slot of a card.
 * @param props.state - What to show (see PriceState).
 * @returns The price, a loading line, or the login link.
 */
function PriceSlot({ state }: { state: PriceState }) {
  const { t, locale } = useI18n()
  if (state.status === 'hidden') {
    return (
      <Link
        to="/login"
        className="inline-flex items-center gap-2 text-xs font-semibold text-brand-red-dark hover:underline focus-visible:ring-2 focus-visible:ring-brand-red/60"
      >
        <Lock aria-hidden="true" className="size-3.5" />
        {t.catalog.loginToSee}
      </Link>
    )
  }
  if (state.status === 'loading') {
    return (
      <span className="block h-6 w-24 animate-pulse bg-neutral-150">
        <span className="sr-only">{t.catalog.loadingPrice}</span>
      </span>
    )
  }
  const price = new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS' }).format(state.price)
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="sr-only">{t.catalog.priceLabel}: </span>
      <span className="font-display text-xl font-bold text-brand-charcoal">{price}</span>
      <span className="text-2xs text-brand-charcoal-muted">{t.catalog.exVat}</span>
    </p>
  )
}

/**
 * One product card.
 * @param props.product - The product to show.
 * @param props.categoryName - The product's category, already translated (shown above the name).
 * @param props.price - The price slot (see PriceState); hidden by default.
 * @param props.variant - `grid` (tile, default) or `list` (row).
 * @param props.headingLevel - The name's heading tag, so the card fits the page outline; default "h3".
 * @param props.className - Extra classes for the card.
 * @returns The card element (an <article>).
 */
export function CatalogCard({
  product,
  categoryName,
  price = { status: 'hidden' },
  variant,
  headingLevel: Heading = 'h3',
  className,
}: {
  product: Product
  categoryName?: string
  price?: PriceState
  headingLevel?: 'h2' | 'h3'
  className?: string
} & VariantProps<typeof cardVariants>) {
  const { locale } = useI18n()
  return (
    <article className={cn(cardVariants({ variant }), className)}>
      <div className={photoVariants({ variant })}>
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
            className="size-full object-contain p-3 mix-blend-multiply sm:p-4 transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-5">
        {categoryName && <p className="font-heading text-2xs font-bold uppercase tracking-widest text-brand-red-dark">{categoryName}</p>}
        <Heading className="line-clamp-3 flex-1 text-sm font-semibold leading-snug text-brand-charcoal">
          {localized(product.name, locale)}
        </Heading>
        <div className="border-t border-neutral-150 pt-3">
          <PriceSlot state={price} />
        </div>
      </div>
    </article>
  )
}
