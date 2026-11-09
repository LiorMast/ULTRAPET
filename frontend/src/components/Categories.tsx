/**
 * Categories.tsx — The home page "Products" section (anchor #categories): heading, intro and a paged carousel of
 * category cards (3 per page). Used by routes/index.tsx, which passes the catalog categories from the database (the
 * active ones in their order, loaded by the root route with fetchCategories) and the section's saved texts
 * (page_sections "categories"); the navbar's "Products" link scrolls here. Each card shows the category as the
 * database has it: its name in the page language and its photo (imageUrl, else a photo bundled under its slug in
 * src/assets/categories/, else an icon panel), and links to the catalog filtered by it, like the Products menu.
 * With `onSave`, staff edit the heading's texts in place (EditableSection: words, font and size, the page's
 * language). The cards are not edited here: they change with the categories (/admin/categories).
 */
import { linkOptions } from '@tanstack/react-router'
import type { ProductCategory, SectionContent } from '@/api'
import { CategoryCard } from '@/components/CategoryCard'
import { Carousel } from '@/components/Carousel'
import { SectionEditBar, useEditableSection } from '@/components/EditableSection'
import { HEADING_KEYS, headingLabels, SectionHeading } from '@/components/SectionHeading'
import { categoryPhoto, localized } from '@/config'
import { useI18n } from '@/i18n'

/**
 * The categories section.
 * @param props.categories - The catalog categories to show, in order (from the API).
 * @param props.content - The heading texts staff saved (keys "eyebrow", "title", "intro"); null or omitted = the
 *   dictionary's.
 * @param props.onSave - Stores new content (rejects with an ApiError on refusal); given = staff can edit in place.
 * @returns The <section> with the heading and the carousel.
 */
export function Categories({
  categories,
  content,
  onSave,
}: {
  categories: ProductCategory[]
  content?: SectionContent | null
  onSave?: (content: SectionContent) => Promise<unknown>
}) {
  const { t, locale } = useI18n()
  const section = useEditableSection({
    content,
    defaults: { eyebrow: t.categories.eyebrow, title: t.categories.title, intro: t.categories.intro },
    labels: headingLabels(t),
    styled: HEADING_KEYS,
    onSave: onSave && ((next) => onSave(next)),
  })
  return (
    <section id="categories" aria-labelledby="categories-title" className="bg-neutral-50 px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        {section.edit && <SectionEditBar edit={section.edit} label={t.categories.eyebrow} className="bg-neutral-50" />}
        <form {...section.formProps}>
          <SectionHeading id="categories-title" edit={section.field} className="max-w-2xl" />
        </form>
        <Carousel label={t.categories.carouselLabel} pageSize={3} className="mt-14">
          {categories.map((category) => (
            <CategoryCard
              key={category.slug}
              name={localized(category.name, locale)}
              image={category.imageUrl ?? categoryPhoto(category.slug)}
              link={linkOptions({ to: '/catalog', search: { category: category.slug } })}
            />
          ))}
        </Carousel>
      </div>
    </section>
  )
}
