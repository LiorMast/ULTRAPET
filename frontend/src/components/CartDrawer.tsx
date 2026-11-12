/**
 * CartDrawer.tsx — The business customer's shopping cart: the header's cart icon button (with a count badge) and
 * the Offcanvas panel it opens. Rendered by the Navbar for signed-in business customers only (the public site and
 * staff have no cart). The lines come from useCart() (src/cart.tsx); AddToCartButton fills them.
 *
 * Hovering or focusing the icon shows the Offcanvas tooltip with the cart's summary: units and subtotal, or "empty".
 * The icon carries CART_TARGET_ATTR: AddToCartButton's flying product photo lands on it.
 *
 * Under the panel's header, a banner (the Offcanvas notice, it doesn't scroll) shows how far the cart is from the
 * minimum order (MIN_ORDER_AMOUNT), with a progress bar, until it is reached. A line's stepper goes down to 0, which
 * removes the product, like its trash button; the focus then moves to the next line (or the empty state's link).
 *
 * Every add replays a short pop of the badge and a nudge of the icon (`animate-cart-pop` / `animate-cart-nudge`
 * in index.css; a fade with reduced motion). The panel lists the lines (photo, name linking to the product, unit
 * price, a QuantityStepper, remove, line total), or an empty state with a link to the catalog; its footer shows
 * the subtotal before VAT and Checkout, which stays disabled until checkout exists (Phase 4).
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CircleAlert, CircleCheck, ShoppingCart, Trash2 } from 'lucide-react'
import { cn } from 'cn'
import { CART_TARGET_ATTR, useCart, type CartLine } from '@/cart'
import { formatPrice } from '@/components/CatalogCard'
import { Offcanvas } from '@/components/Offcanvas'
import { QuantityStepper } from '@/components/QuantityStepper'
import { Button } from '@/components/ui/button'
import { localized, MIN_ORDER_AMOUNT } from '@/config'
import { useI18n } from '@/i18n'

/** The largest number the badge spells out; more shows as "99+". */
const BADGE_MAX = 99

/**
 * The cart icon button and the cart panel it opens.
 * @param props.className - Extra classes for the icon button (e.g. responsive visibility).
 * @returns The button together with its panel.
 */
export function CartDrawer({ className }: { className?: string }) {
  const { t, locale } = useI18n()
  const { lines, count, subtotal, addedTick, remove } = useCart()
  const [open, setOpen] = useState(false)
  const minimum = formatPrice(locale, MIN_ORDER_AMOUNT, { whole: true })
  const items = count === 1 ? t.cart.itemOne : t.cart.itemMany.replace('{n}', String(count))
  const label = count > 0 ? t.cart.openWithCount.replace('{items}', items) : t.cart.open
  // Each add gets new keys (distinct for the icon and the badge: they are siblings), so the animations replay;
  // nothing animates before the first add.
  const popKey = addedTick > 0 ? addedTick : undefined

  /**
   * Removes a line and moves the focus to the next line's name (else the previous one's, else the empty state's
   * catalog link), so the focus is never lost inside the panel.
   * @param id - The product id of the line.
   */
  const removeLine = (id: string) => {
    const index = lines.findIndex((line) => line.id === id)
    const next = lines[index + 1] ?? lines[index - 1]
    remove(id)
    requestAnimationFrame(() => {
      const selector = next ? `[data-cart-line="${CSS.escape(next.id)}"] a` : '[data-cart-empty-action]'
      document.querySelector<HTMLElement>(selector)?.focus()
    })
  }

  return (
    <Offcanvas
      open={open}
      onOpenChange={setOpen}
      title={t.cart.title}
      tooltip={
        <>
          <span className="block font-semibold">{t.cart.title}</span>
          <span className="block text-white/80">
            {count > 0 ? t.cart.tooltipSummary.replace('{items}', items).replace('{amount}', formatPrice(locale, subtotal)) : t.cart.empty}
          </span>
        </>
      }
      description={t.cart.minimumOrder.replace('{amount}', minimum)}
      notice={lines.length > 0 && <MinimumOrderBanner subtotal={subtotal} />}
      trigger={
        <button
          type="button"
          {...{ [CART_TARGET_ATTR]: '' }}
          aria-label={label}
          className={cn(
            'relative p-2 text-brand-charcoal sm:p-3 transition-[color,scale] outline-none hover:text-brand-red focus-visible:ring-2 focus-visible:ring-brand-red active:scale-[0.97] active:duration-100',
            className,
          )}
        >
          <ShoppingCart key={`icon-${popKey}`} size={24} aria-hidden="true" className={cn('block', popKey && 'animate-cart-nudge')} />
          {count > 0 && (
            <span
              key={`badge-${popKey}`}
              aria-hidden="true"
              data-testid="cart-badge"
              className={cn(
                'absolute end-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-2xs font-semibold leading-5 text-white sm:end-1 sm:top-1',
                popKey && 'animate-cart-pop',
              )}
            >
              {count > BADGE_MAX ? `${BADGE_MAX}+` : count}
            </span>
          )}
        </button>
      }
      footer={
        <>
          {lines.length > 0 && (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-heading text-xs font-semibold uppercase tracking-widest text-brand-charcoal">{t.cart.subtotal}</span>
                <span className="text-end">
                  <span className="block font-display text-2xl font-bold text-brand-charcoal">{formatPrice(locale, subtotal)}</span>
                  <span className="text-2xs text-brand-charcoal-muted">{t.cart.exVat}</span>
                </span>
              </div>
            </>
          )}
          <Button disabled className="w-full">
            {t.cart.checkout}
          </Button>
        </>
      }
    >
      {lines.length > 0 ? (
        <ul className="divide-y divide-neutral-150">
          {lines.map((line) => (
            <CartLineItem key={line.id} line={line} onNavigate={() => setOpen(false)} onRemove={() => removeLine(line.id)} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <ShoppingCart size={40} aria-hidden="true" className="text-neutral-300" />
          <p className="font-heading text-sm font-semibold text-brand-charcoal">{t.cart.empty}</p>
          <p className="max-w-xs text-xs text-brand-charcoal-muted">{t.cart.emptyHint}</p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/catalog" data-cart-empty-action onClick={() => setOpen(false)}>
              {t.cart.browse}
            </Link>
          </Button>
        </div>
      )}
    </Offcanvas>
  )
}

/**
 * The banner at the top of the cart: how much is missing to reach the minimum order, with a progress bar, or
 * (once reached) a confirmation.
 * @param props.subtotal - The cart's subtotal before VAT, in shekels.
 * @returns The banner.
 */
function MinimumOrderBanner({ subtotal }: { subtotal: number }) {
  const { t, locale } = useI18n()
  const minimum = formatPrice(locale, MIN_ORDER_AMOUNT, { whole: true })
  const remaining = MIN_ORDER_AMOUNT - subtotal
  const reached = remaining <= 0
  const message = reached
    ? t.cart.minimumReached
    : t.cart.minimumRemaining.replace('{amount}', formatPrice(locale, remaining)).replace('{minimum}', minimum)
  const Icon = reached ? CircleCheck : CircleAlert

  return (
    <div className={cn('flex gap-3 p-4', reached ? 'bg-neutral-50 text-brand-charcoal' : 'bg-brand-red-muted text-brand-red-dark')}>
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <p className="text-sm font-semibold leading-snug">{message}</p>
        {!reached && (
          <div
            role="progressbar"
            aria-label={t.cart.minimumProgress}
            aria-valuemin={0}
            aria-valuemax={MIN_ORDER_AMOUNT}
            aria-valuenow={Math.round(subtotal)}
            aria-valuetext={`${formatPrice(locale, subtotal)} / ${minimum}`}
            className="h-1.5 overflow-hidden bg-white"
          >
            <div className="h-full bg-brand-red transition-[width] duration-500" style={{ width: `${(subtotal / MIN_ORDER_AMOUNT) * 100}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * One line of the cart panel: photo, name (a link to the product), unit price, quantity (down to 0 = remove),
 * remove, line total.
 * @param props.line - The cart line.
 * @param props.onNavigate - Called when the name link is followed (the panel closes).
 * @param props.onRemove - Removes the line (its trash button, or the stepper reaching 0).
 * @returns The <li>.
 */
function CartLineItem({ line, onNavigate, onRemove }: { line: CartLine; onNavigate: () => void; onRemove: () => void }) {
  const { t, locale } = useI18n()
  const { setQuantity } = useCart()
  const name = localized(line.name, locale)

  return (
    <li data-cart-line={line.id} className="flex gap-4 py-4 first:pt-0">
      <div className="size-20 shrink-0 border border-neutral-150 bg-neutral-50">
        {line.image && <img src={line.image} alt="" width={80} height={80} loading="lazy" className="size-full object-contain p-1.5 mix-blend-multiply" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            to="/products/$slug"
            params={{ slug: line.slug }}
            onClick={onNavigate}
            className="line-clamp-2 text-sm font-semibold leading-snug text-brand-charcoal hover:text-brand-red-dark focus-visible:ring-2 focus-visible:ring-brand-red/60"
          >
            {name}
          </Link>
          <button
            type="button"
            aria-label={t.cart.remove.replace('{name}', name)}
            onClick={onRemove}
            className="-me-1 shrink-0 p-1 text-neutral-500 transition-[color,scale] outline-none hover:text-brand-red focus-visible:ring-2 focus-visible:ring-brand-red active:scale-[0.97] active:duration-100"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
        <p className="text-xs text-brand-charcoal-muted">{t.cart.unitPrice.replace('{price}', formatPrice(locale, line.unitPrice))}</p>
        <div className="flex items-center justify-between gap-2">
          <QuantityStepper
            size="sm"
            min={0}
            value={line.quantity}
            onChange={(quantity) => (quantity === 0 ? onRemove() : setQuantity(line.id, quantity))}
            label={t.quantity.labelFor.replace('{name}', name)}
            removeLabel={t.quantity.decreaseToRemove}
          />
          <span className="font-semibold tabular-nums text-brand-charcoal">{formatPrice(locale, line.unitPrice * line.quantity)}</span>
        </div>
      </div>
    </li>
  )
}
