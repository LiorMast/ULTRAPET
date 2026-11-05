/**
 * Categories.tsx — The home page "Products" section (anchor #categories): heading, intro and a paged carousel of
 * category cards (3 per page). Used by routes/index.tsx; the navbar's "Products" link scrolls here.
 */
import { CategoryCard } from '@/components/CategoryCard'
import { Carousel } from '@/components/Carousel'
import { SectionHeading } from '@/components/SectionHeading'
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
        <SectionHeading id="categories-title" eyebrow={t.categories.eyebrow} title={t.categories.title} intro={t.categories.intro} className="max-w-2xl" />
        <Carousel label={t.categories.carouselLabel} pageSize={3} className="mt-14">
          {categories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </Carousel>
      </div>
    </section>
  )
}
