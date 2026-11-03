/**
 * Brands.tsx — The home page "Brands" section (anchor #brands): heading, intro and a paged carousel of brand cards (3 per page).
 * Used by routes/index.tsx, which loads the brands from the API (fetchBrands); the navbar's "Brands" link and
 * the hero's "Our Brands" button scroll here.
 */
import { BrandCard } from '@/components/BrandCard'
import { Carousel } from '@/components/Carousel'
import type { Brand } from '@/api'
import { useI18n } from '@/i18n'

/** How many brand cards one carousel page holds on a wide screen. */
const BRANDS_PER_PAGE = 3

/**
 * The brands section.
 * @param props.brands - The brands to show, in order.
 * @returns The <section> with the heading and the carousel.
 */
export function Brands({ brands }: { brands: Brand[] }) {
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
        <Carousel label={t.brands.carouselLabel} pageSize={BRANDS_PER_PAGE} tone="dark" className="mt-14">
          {brands.map((brand) => (
            <BrandCard key={brand.slug} brand={brand} className="w-full" />
          ))}
        </Carousel>
      </div>
    </section>
  )
}
