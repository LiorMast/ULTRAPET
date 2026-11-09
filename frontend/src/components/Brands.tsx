/**
 * Brands.tsx — The home page "Brands" section (anchor #brands): heading, intro and a paged carousel of brand cards (3 per page).
 * Used by routes/index.tsx, which loads the brands from the API (fetchBrands) and the section's saved texts
 * (page_sections "brands"); the navbar's "Brands" link and the hero's "Our Brands" button scroll here.
 * With `onSave`, staff edit the heading's texts in place (EditableSection: words, font and size, the page's language);
 * the brand cards themselves are edited in the staff panel (/admin/brands).
 */
import { BrandCard } from '@/components/BrandCard'
import { Carousel } from '@/components/Carousel'
import { SectionEditBar, useEditableSection } from '@/components/EditableSection'
import { HEADING_KEYS, headingLabels, SectionHeading } from '@/components/SectionHeading'
import type { Brand, SectionContent } from '@/api'
import { useI18n } from '@/i18n'

/** How many brand cards one carousel page holds on a wide screen. */
const BRANDS_PER_PAGE = 3

/**
 * The brands section.
 * @param props.brands - The brands to show, in order.
 * @param props.content - The heading texts staff saved; null or omitted = the dictionary's.
 * @param props.onSave - Stores new content (rejects with an ApiError on refusal); given = staff can edit in place.
 * @returns The <section> with the heading and the carousel.
 */
export function Brands({ brands, content, onSave }: { brands: Brand[]; content?: SectionContent | null; onSave?: (content: SectionContent) => Promise<unknown> }) {
  const { t } = useI18n()
  const section = useEditableSection({
    content,
    defaults: { eyebrow: t.brands.eyebrow, title: t.brands.title, intro: t.brands.intro },
    labels: headingLabels(t),
    styled: HEADING_KEYS,
    onSave: onSave && ((next) => onSave(next)),
  })
  return (
    <section id="brands" aria-labelledby="brands-title" className="bg-black px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        {section.edit && <SectionEditBar edit={section.edit} label={t.brands.eyebrow} tone="dark" className="bg-black" />}
        <form {...section.formProps}>
          <SectionHeading id="brands-title" tone="dark" edit={section.field} className="max-w-2xl" />
        </form>
        <Carousel label={t.brands.carouselLabel} pageSize={BRANDS_PER_PAGE} tone="dark" className="mt-14">
          {brands.map((brand) => (
            <BrandCard key={brand.slug} brand={brand} className="w-full" />
          ))}
        </Carousel>
      </div>
    </section>
  )
}
