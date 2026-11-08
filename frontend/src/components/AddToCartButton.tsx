/**
 * AddToCartButton.tsx — The "Add to cart" button of a product: adds it to the signed-in customer's cart (useCart)
 * and confirms with a short morph: the label cross-fades into "✓ Added" for ADDED_MS, then back; the header's
 * cart badge pops at the same time (CartDrawer). Screen readers hear "Added to cart: <name>" from a polite live
 * region, while the button keeps its name. Used by CatalogCard (size `sm`, adds 1) and the product page (size
 * `lg`, with a QuantityStepper). Callers render it only where the customer's price is shown.
 */
import { useEffect, useRef, useState } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, ShoppingCart } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { useCart, type CartProduct } from '@/cart'
import { localized } from '@/config'
import { useI18n } from '@/i18n'

/** How long the button shows "Added", in ms. */
export const ADDED_MS = 1600

const addVariants = cva('relative', {
  variants: {
    size: {
      sm: 'w-full px-3 py-2.5 text-2xs',
      lg: 'px-8 py-4 text-xs',
    },
  },
  defaultVariants: { size: 'sm' },
})

/** One of the two stacked labels: both share one grid cell, so the button keeps the wider one's width. */
const LABEL_CLASS =
  'col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-[opacity,scale] duration-300'

/**
 * The add-to-cart button.
 * @param props.product - The product snapshot the cart keeps (id, slug, name, photo, unit price).
 * @param props.quantity - Units to add per click (default 1).
 * @param props.onAdded - Called after the units were added (e.g. the product page resets its quantity).
 * @param props.size - 'sm' (default: a full-width compact button on a card) or 'lg' (the product page).
 * @param props.className - Extra classes for the button.
 * @returns The button and its visually hidden status line.
 */
export function AddToCartButton({
  product,
  quantity = 1,
  onAdded,
  size,
  className,
}: {
  product: CartProduct
  quantity?: number
  onAdded?: () => void
  className?: string
} & VariantProps<typeof addVariants>) {
  const { t, locale } = useI18n()
  const { add } = useCart()
  const [added, setAdded] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  /** Adds the units, then shows "Added" for ADDED_MS (a new click restarts the timer). */
  const handleClick = () => {
    add(product, quantity)
    setAdded(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setAdded(false), ADDED_MS)
    onAdded?.()
  }

  return (
    <>
      <Button type="button" onClick={handleClick} data-added={added || undefined} className={cn(addVariants({ size }), 'grid', className)}>
        <span className={cn(LABEL_CLASS, added ? 'scale-90 opacity-0' : 'scale-100 opacity-100')}>
          <ShoppingCart aria-hidden="true" className="size-4" />
          {t.cart.add}
        </span>
        <span aria-hidden="true" className={cn(LABEL_CLASS, added ? 'scale-100 opacity-100' : 'scale-90 opacity-0')}>
          <Check aria-hidden="true" className="size-4" />
          {t.cart.added}
        </span>
      </Button>
      <span role="status" className="sr-only">
        {added ? t.cart.addedStatus.replace('{name}', localized(product.name, locale)) : ''}
      </span>
    </>
  )
}
