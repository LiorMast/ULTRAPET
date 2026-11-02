/**
 * CategoryCard.tsx — A minimal card for one product category: a photo covering the whole card (or a quiet
 * icon panel when the category has no photo) with the category name centered over it. The whole card is one
 * link to the category page. Used by the home page Categories carousel; reusable on the all-categories page.
 */
import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import type { Category } from '@/config'
import { useI18n } from '@/i18n'

/**
 * One category card. A real link (crawlable, keyboard-focusable); the card lifts and the photo zooms
 * slightly on hover, and it settles back the instant it is pressed. A dark veil keeps the white name legible
 * on any photo.
 * @param props.category - The category to show (see `Category` in config.ts).
 * @param props.className - Extra classes for the card, e.g. grid or slide placement.
 * @returns The card link element.
 */
export function CategoryCard({ category, className }: { category: Category; className?: string }) {
  const { t } = useI18n()
  const Icon = category.icon
  return (
    <Link
      to="/categories/$slug"
      params={{ slug: category.slug }}
      className={cn(
        'group relative block aspect-[4/3] w-full overflow-hidden bg-brand-charcoal outline-none',
        'transition-[box-shadow,translate,scale] duration-300 hover:-translate-y-1 hover:shadow-premium-sm',
        'active:translate-y-0 active:scale-[0.99] active:shadow-none active:duration-100',
        'focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2',
        className,
      )}
    >
      {category.image ? (
        <img
          src={category.image}
          alt=""
          width={800}
          height={600}
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <Icon aria-hidden="true" className="absolute inset-0 m-auto size-14 text-white/40" strokeWidth={1.25} />
      )}
      <span aria-hidden="true" className="absolute inset-0 bg-black/50 transition-colors duration-300 group-hover:bg-black/60" />
      <h3 className="absolute inset-0 flex items-center justify-center p-6 text-center font-display text-2xl font-bold text-white">
        {category.label(t)}
      </h3>
    </Link>
  )
}
