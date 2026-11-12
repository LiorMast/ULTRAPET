/**
 * AddToCartButton.tsx — The "Add to cart" button of a product: adds it to the signed-in customer's cart (useCart)
 * and confirms it twice over: the label cross-fades into "✓ Added" for ADDED_MS, then back, and a copy of the
 * product photo flies along an arc into the header's cart icon (flyToCart), whose badge pops as it lands. The photo
 * is the first <img> inside the nearest element marked CART_FLY_SOURCE_ATTR (the catalog card, the product page's
 * gallery and details); without one, with reduced motion, or when the cart icon is not on screen there is no flight
 * and the badge pops at once. Screen readers hear "Added to cart: <name>" from a polite live
 * region, while the button keeps its name. Used by CatalogCard (size `sm`, adds 1) and the product page (size
 * `lg`, with a QuantityStepper). Callers render it only where the customer's price is shown.
 * A product that is out of stock (`available={false}`) shows a disabled "Out of stock" button instead, which adds nothing.
 */
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, PackageX, ShoppingCart } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { CART_TARGET_ATTR, useCart, type CartProduct } from '@/cart'
import { localized } from '@/config'
import { useI18n } from '@/i18n'

/** How long the button shows "Added", in ms. */
export const ADDED_MS = 1600

/** Mark an element with this attribute to make the first photo inside it the one that flies to the cart. */
export const CART_FLY_SOURCE_ATTR = 'data-cart-fly-source'

/** How long the photo flies, in ms. */
export const FLY_MS = 750

/** The largest side of the flying photo at take-off, in px (a big gallery photo leaves from its middle). */
const FLY_MAX_SIZE = 220

/** The side of the copy when it takes off from the button (its photo is out of view), in px. */
const LAUNCH_SIZE = 64

/**
 * Flies a copy of a photo from where it is into the cart icon: across on an ease-out curve while it rises (or
 * falls) on an ease-in one, which together draw an arc, shrinking to the icon's size and fading a little.
 * @param image - The product photo on the page.
 * @param target - The header's cart icon.
 * @param launcher - Where the copy takes off from when the photo is scrolled out of view (the clicked button),
 *   small; without it, a photo out of view doesn't fly.
 * @returns Resolves when the copy has landed (and was removed), or false at once when it cannot fly (no Web
 *   Animations support, reduced motion, or the photo or the icon has no size, e.g. hidden).
 */
export function flyToCart(image: HTMLImageElement, target: Element, launcher?: Element): Promise<boolean> {
  const photo = image.getBoundingClientRect()
  const inView = photo.bottom > 0 && photo.top < window.innerHeight
  const from = inView || !launcher ? photo : launcher.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (
    typeof image.animate !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !from.width ||
    !from.height ||
    (!inView && !launcher) ||
    !to.width
  ) {
    return Promise.resolve(false)
  }
  // From the button, a thumbnail-sized copy (the button is wide but short).
  const size = inView ? Math.min(from.width, from.height, FLY_MAX_SIZE) : LAUNCH_SIZE
  const startX = from.left + from.width / 2 - size / 2
  const startY = from.top + from.height / 2 - size / 2
  const dx = to.left + to.width / 2 - (startX + size / 2)
  const dy = to.top + to.height / 2 - (startY + size / 2)

  // The outer box moves across, the inner one up or down and shrinks: two easings make the arc.
  const across = document.createElement('div')
  across.setAttribute('aria-hidden', 'true')
  across.style.cssText = `position:fixed;left:${startX}px;top:${startY}px;width:${size}px;height:${size}px;z-index:60;pointer-events:none`
  const flyer = document.createElement('img')
  flyer.src = image.currentSrc || image.src
  flyer.alt = ''
  flyer.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#fff;box-shadow:var(--shadow-premium-sm)'
  across.append(flyer)
  document.body.append(across)

  across.animate([{ translate: '0 0' }, { translate: `${dx}px 0` }], { duration: FLY_MS, easing: 'cubic-bezier(0.3, 0.7, 0.5, 1)', fill: 'forwards' })
  const fall = flyer.animate(
    [
      { translate: '0 0', scale: 1, opacity: 1 },
      { translate: `0 ${dy}px`, scale: 24 / size, opacity: 0.7 },
    ],
    { duration: FLY_MS, easing: 'cubic-bezier(0.55, 0, 0.9, 0.6)', fill: 'forwards' },
  )
  return fall.finished.then(
    () => true,
    () => true,
  ).finally(() => across.remove())
}

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
 * @param props.available - false = the product is out of stock: a disabled "Out of stock" button (default true).
 * @param props.className - Extra classes for the button.
 * @returns The button and its visually hidden status line (just the disabled button when unavailable).
 */
export function AddToCartButton({
  product,
  quantity = 1,
  onAdded,
  size,
  available = true,
  className,
}: {
  product: CartProduct
  quantity?: number
  onAdded?: () => void
  available?: boolean
  className?: string
} & VariantProps<typeof addVariants>) {
  const { t, locale } = useI18n()
  const { add, pop } = useCart()
  const [added, setAdded] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  /**
   * Adds the units, flies the product photo to the cart (the badge pops when it lands, or at once without a
   * flight), then shows "Added" for ADDED_MS (a new click restarts the timer).
   * @param event - The click; its button finds the photo to fly.
   */
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const image = event.currentTarget.closest(`[${CART_FLY_SOURCE_ATTR}]`)?.querySelector('img')
    const target = document.querySelector(`[${CART_TARGET_ATTR}]`)
    add(product, quantity, { pop: false })
    if (image && target) void flyToCart(image, target, event.currentTarget).then(() => pop())
    else pop()
    setAdded(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setAdded(false), ADDED_MS)
    onAdded?.()
  }

  if (!available) {
    return (
      <Button type="button" variant="action" disabled className={cn(addVariants({ size }), 'h-auto rounded-none', className)}>
        <PackageX aria-hidden="true" className="size-4" />
        {t.cart.soldOut}
      </Button>
    )
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
