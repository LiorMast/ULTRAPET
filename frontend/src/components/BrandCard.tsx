/**
 * BrandCard.tsx — A minimalist rounded card for one brand: logo (the brand's logoUrl, else the logo file bundled
 * with the site, else a text wordmark) on a soft panel, name and tagline. The whole card is one link to the brand's
 * page; it brightens on hover (nothing moves), and the logo fades in once loaded.
 * Used by the home page Brands section; reusable on a future all-brands page.
 */
import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import type { Brand } from '@/api'
import { brandLogo, localized } from '@/config'
import { useI18n } from '@/i18n'
import { imgFade } from '@/motion'

/**
 * One brand card. The card is a real link (crawlable, keyboard-focusable); a thin line in the brand's
 * accent color (the site red when it has none) grows along the bottom edge on hover or focus, and the card
 * settles back the instant it is pressed.
 * @param props.brand - The brand to show (see `Brand` in api.ts).
 * @param props.className - Extra classes for the card, e.g. grid placement.
 * @returns The card link element.
 */
export function BrandCard({ brand, className }: { brand: Brand; className?: string }) {
  const { t, locale } = useI18n()
  const logo = brand.logoUrl ?? brandLogo(brand.slug)
  return (
    <Link
      to="/brands/$slug"
      params={{ slug: brand.slug }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-6 outline-none sm:p-7',
        'transition-[background-color,border-color] duration-300 hover:border-white/30 hover:bg-white/10',
        'focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2',
        className,
      )}
    >
      <div className={cn('flex h-36 items-center justify-center rounded-xl', logo && 'bg-white/15')}>
        {logo ? (
          <img
            src={logo}
            alt=""
            width={200}
            height={144}
            loading="lazy"
            {...imgFade}
            className="img-fade max-h-28 w-auto max-w-[75%] object-contain"
          />
        ) : (
          <span aria-hidden="true" className="font-display text-2xl font-bold text-white">
            {brand.name}
          </span>
        )}
      </div>
      <div className="mt-6 min-w-0">
        <h3 className="font-heading text-base font-semibold text-white">{brand.name}</h3>
        {brand.tagline && <p className="mt-1 text-sm text-white/75">{localized(brand.tagline, locale)}</p>}
        <span className="sr-only">{t.brands.explore}</span>
      </div>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100 group-focus-visible:scale-x-100 rtl:origin-right"
        style={{ backgroundColor: brand.accent ?? 'var(--color-brand-red)' }}
      />
    </Link>
  )
}
