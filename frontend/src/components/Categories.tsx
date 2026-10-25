/**
 * Categories.tsx — The home page "Products" section (anchor #categories): heading, intro and a carousel of
 * category cards. Used by routes/index.tsx; the navbar's "Products" link scrolls here.
 */
import { CategoryCard } from '@/components/CategoryCard'
import { Carousel } from '@/components/Carousel'
import { CATEGORIES, type Category } from '@/config'
import { useI18n } from '@/i18n'

/**
 * The categories section.
 * @param props.categories - The categories to show, in order; defaults to CATEGORIES in config.ts.
 * @returns The <section> with the heading and the carousel.
 */
export function Categories({ categories = CATEGORIES }: { categories?: Category[] }) {
  const { t } = useI18n()
  return (
    <section id="categories" aria-labelledby="categories-title" className="bg-neutral-50 px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-red">{t.categories.eyebrow}</p>
          <h2 id="categories-title" className="mt-4 font-display text-4xl font-bold text-brand-charcoal lg:text-5xl">
            {t.categories.title}
          </h2>
          <p className="mt-5 text-lg text-brand-charcoal-muted">{t.categories.intro}</p>
        </div>
        <Carousel label={t.categories.carouselLabel} className="mt-14">
          {categories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </Carousel>
      </div>
    </section>
  )
}
