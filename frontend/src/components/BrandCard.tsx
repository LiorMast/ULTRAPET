/**
 * BrandCard.tsx — A minimalist card for one brand: logo (or a text wordmark when the brand has no logo
 * file), name, tagline and an "explore" arrow. The whole card is one link to the brand's page.
 * Used by the home page Brands section; reusable on a future all-brands page.
 */
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { cn } from 'cn'
import type { Brand } from '@/config'
import { useI18n } from '@/i18n'

/**
 * One brand card. The card is a real link (crawlable, keyboard-focusable); a thin line in the brand's
 * accent color grows along the bottom edge on hover or focus.
 * @param props.brand - The brand to show (see `Brand` in config.ts).
 * @param props.className - Extra classes for the card, e.g. grid placement.
 * @returns The card link element.
 */
export function BrandCard({ brand, className }: { brand: Brand; className?: string }) {
  const { t } = useI18n()
  return (
    <Link
      to="/brands/$slug"
      params={{ slug: brand.slug }}
      className={cn(
        'group relative flex flex-col overflow-hidden border border-white/20 bg-transparent p-8 outline-none',
        'transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-premium-sm',
        'focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2',
        className,
      )}
    >
      <div className={cn('flex h-36 items-center justify-center', brand.logo && 'bg-white/15')}>
        {brand.logo ? (
          <img src={brand.logo} alt="" width={200} height={144} loading="lazy" className="max-h-28 w-auto max-w-[75%] object-contain" />
        ) : (
          <span aria-hidden="true" className="font-heading text-2xl font-bold uppercase tracking-widest text-white">
            {brand.name}
          </span>
        )}
      </div>
      <div className="mt-8 flex items-end justify-between gap-4 border-t border-white/20 pt-5">
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-bold uppercase tracking-widest text-white">{brand.name}</h3>
          <p className="mt-1 text-sm text-white/75">{brand.tagline(t)}</p>
        </div>
        <span className="sr-only">{t.brands.explore}</span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-white transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
      </div>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100 group-focus-visible:scale-x-100 rtl:origin-right"
        style={{ backgroundColor: brand.accent }}
      />
    </Link>
  )
}
