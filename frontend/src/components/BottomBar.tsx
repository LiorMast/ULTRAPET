/**
 * BottomBar.tsx — A page's own action bar, fixed just above the tab bar on phones and tablets (below xl), like an
 * app's "Add to cart" bar: its main action stays within the thumb's reach while the page scrolls. From xl it is an
 * ordinary block where the page writes it (the classes the caller gives for xl apply there).
 *
 * Below xl it is 72px tall, on the header's translucent material with a hairline above, padded for the phone's side
 * safe areas. It carries data-bottom-bar: while it is on the page, index.css adds its height to --bottom-bar-h, so the
 * page keeps that much room at its end and the WhatsApp button floats above it. Used by the product page (the
 * quantity stepper and Add to cart, for signed-in customers).
 */
import type { ReactNode } from 'react'
import { cn } from 'cn'

/**
 * The bar.
 * @param props.children - Its content (e.g. a stepper and a button; give the button `flex-1` to fill the row).
 * @param props.className - Extra classes: the xl look of the block (e.g. "xl:mt-6 xl:flex xl:gap-3").
 * @returns The bar.
 */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-bottom-bar=""
      className={cn(
        'max-xl:material-bar max-xl:safe-x max-xl:fixed max-xl:inset-x-0 max-xl:bottom-(--tabbar-h) max-xl:z-40 max-xl:flex max-xl:h-18 max-xl:items-center max-xl:gap-3 max-xl:px-gutter max-xl:shadow-[0_-1px_0_var(--color-neutral-200)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
