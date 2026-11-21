/**
 * CategoryCard.tsx — A minimal rounded card for one product category: a photo covering the whole card under a dark
 * veil with the white category name centered over it, or (no photo) a white card with the name in charcoal. The whole card is one
 * link. Used by the home page Categories carousel (the catalog categories from the database, linking to the catalog
 * filtered by the category) and the article page's related categories; the caller gives the name, photo and link, so
 * any category list can feed it. While the photo downloads, the card shimmers (img-frame).
 */
import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import type { AppLink } from '@/config'
import { imgFade } from '@/motion'

/**
 * One category card. A real link (crawlable, keyboard-focusable); on hover its shadow deepens and the photo's veil
 * darkens (nothing moves). A dark veil keeps the white name legible
 * on any photo, which fades in once loaded; without a photo the name turns brand red on hover.
 * @param props.name - The category's name in the page language (the card's heading and accessible name).
 * @param props.image - The photo's URL; omitted or null = the plain white card.
 * @param props.link - Where the card leads (TanStack linkOptions), e.g. the catalog filtered by the category.
 * @param props.className - Extra classes for the card, e.g. grid or slide placement.
 * @returns The card link element.
 */
export function CategoryCard({
  name,
  image,
  link,
  className,
}: {
  name: string
  image?: string | null
  link: AppLink
  className?: string
}) {
  return (
    <Link
      {...link}
      className={cn(
        'group relative block aspect-[4/3] w-full overflow-hidden rounded-2xl outline-none',
        image ? 'img-frame bg-brand-charcoal [--skeleton-shine:rgb(255_255_255/0.08)]' : 'bg-white shadow-soft',
        'transition-[box-shadow] duration-300 hover:shadow-premium-sm',
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
          {...imgFade}
          className="img-fade absolute inset-0 size-full object-cover"
        />
      )}
      {image && <span aria-hidden="true" className="absolute inset-0 bg-black/50 transition-colors duration-300 group-hover:bg-black/60" />}
      <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
        <h3 className={cn('font-display text-2xl font-bold transition-colors duration-300', image ? 'text-white' : 'text-brand-charcoal group-hover:text-brand-red-dark')}>
          {name}
        </h3>
      </div>
    </Link>
  )
}
