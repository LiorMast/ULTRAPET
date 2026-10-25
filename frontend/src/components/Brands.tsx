/**
 * Brands.tsx — The home page "Brands" section (anchor #brands): heading, intro and a grid of brand cards.
 * Used by routes/index.tsx; the navbar's "Brands" link and the hero's "Our Brands" button scroll here.
 */
import { BrandCard } from '@/components/BrandCard'
import { BRANDS, type Brand } from '@/config'
import { useI18n } from '@/i18n'

/**
 * The brands section.
 * @param props.brands - The brands to show, in order; defaults to the brands in config.ts.
 * @returns The <section> with the heading and the card grid.
 */
export function Brands({ brands = BRANDS }: { brands?: Brand[] }) {
  const { t } = useI18n()
  return (
    <section id="brands" aria-labelledby="brands-title" className="bg-black px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="font-heading text-xs font-bold uppercase tracking-widest text-white/80">{t.brands.eyebrow}</p>
          <h2 id="brands-title" className="mt-4 font-display text-4xl font-bold text-white lg:text-5xl">
            {t.brands.title}
          </h2>
          <p className="mt-5 text-lg text-white/75">{t.brands.intro}</p>
        </div>
        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <li key={brand.slug} className="flex">
              <BrandCard brand={brand} className="w-full" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
