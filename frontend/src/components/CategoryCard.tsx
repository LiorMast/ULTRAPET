/**
 * CategoryCard.tsx — A minimalist card for one product category: photo (or a quiet icon panel when the
 * category has no photo file yet), product count, name, short description and an "explore" arrow. The whole
 * card is one link to the category page. Used by the home page Categories carousel; reusable on the
 * all-categories page.
 */
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { cn } from 'cn'
import type { Category } from '@/config'
import { useI18n } from '@/i18n'

/**
 * One category card. A real link (crawlable, keyboard-focusable); the photo zooms slightly on hover.
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
        'group flex w-full flex-col overflow-hidden border border-neutral-200 bg-white outline-none',
        'transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-premium-sm',
        'focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2',
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-charcoal">
        {category.image ? (
          <img
            src={category.image}
            alt=""
            width={800}
            height={600}
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Icon aria-hidden="true" className="size-14 text-white/40" strokeWidth={1.25} />
          </div>
        )}
        <span className="absolute end-0 top-4 bg-brand-red px-4 py-1.5 font-heading text-2xs font-bold uppercase tracking-widest text-white">
          {t.categories.products.replace('{n}', category.skuCount)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-7">
        <h3 className="font-display text-xl font-bold text-brand-charcoal">{category.label(t)}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-brand-charcoal-muted">{category.description(t)}</p>
        <span className="mt-6 flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-widest text-brand-red">
          {t.categories.explore}
          <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
        </span>
      </div>
    </Link>
  )
}
