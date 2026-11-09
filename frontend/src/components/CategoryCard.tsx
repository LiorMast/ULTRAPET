/**
 * CategoryCard.tsx — A minimal card for one product category: a photo covering the whole card (or a quiet
 * icon panel when the category has no photo) with the category name centered over it. The whole card is one
 * link. Used by the home page Categories carousel (the catalog categories from the database, linking to the catalog
 * filtered by the category) and the article page's related categories; the caller gives the name, photo and link, so
 * any category list can feed it.
 */
import { Link } from '@tanstack/react-router'
import { LayoutGrid, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import type { AppLink } from '@/config'

/**
 * One category card. A real link (crawlable, keyboard-focusable); the card lifts and the photo zooms
 * slightly on hover, and it settles back the instant it is pressed. A dark veil keeps the white name legible
 * on any photo; without a photo, the icon stands above the name.
 * @param props.name - The category's name in the page language (the card's heading and accessible name).
 * @param props.image - The photo's URL; omitted or null = the icon panel.
 * @param props.icon - The icon of the panel shown without a photo; default a neutral grid.
 * @param props.link - Where the card leads (TanStack linkOptions), e.g. the catalog filtered by the category.
 * @param props.className - Extra classes for the card, e.g. grid or slide placement.
 * @returns The card link element.
 */
export function CategoryCard({
  name,
  image,
  icon: Icon = LayoutGrid,
  link,
  className,
}: {
  name: string
  image?: string | null
  icon?: LucideIcon
  link: AppLink
  className?: string
}) {
  return (
    <Link
      {...link}
      className={cn(
        'group relative block aspect-[4/3] w-full overflow-hidden bg-brand-charcoal outline-none',
        'transition-[box-shadow,translate,scale] duration-300 hover:-translate-y-1 hover:shadow-premium-sm',
        'active:translate-y-0 active:scale-[0.99] active:shadow-none active:duration-100',
        'focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2',
        className,
      )}
    >
      {image && (
        <img
          src={image}
          alt=""
          width={800}
          height={600}
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      )}
      <span aria-hidden="true" className="absolute inset-0 bg-black/50 transition-colors duration-300 group-hover:bg-black/60" />
      {/* Without a photo, the icon stands above the name instead of behind it. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        {!image && <Icon aria-hidden="true" className="size-12 text-white/40" strokeWidth={1.25} />}
        <h3 className="font-display text-2xl font-bold text-white">{name}</h3>
      </div>
    </Link>
  )
}
