/**
 * routes/private-label.tsx — The Private Label page (תווית פרטית, /private-label): Ultra Pet developing and making pet
 * products under a customer's own brand. Sections: the page heading with its calls to action, the approach beside the
 * manufacturing capabilities, the process (the home page's Private Label section: the same saved steps, so an edit on
 * either page changes both), what we manufacture (four product categories), why Ultra Pet, a private label FAQ and a
 * closing call to action (components/PrivateLabelPage.tsx, PrivateLabel, Faq).
 *
 * Signed-in staff edit every section in place, like the home page ("Edit on page", the page's language, one section
 * at a time; useSectionSaver): each section's texts are a page_sections row (PAGE_SECTION_KEYS), the FAQ's questions
 * the row "private_label_page_faq_items" ({ items }: built-in questions from the dictionaries until the first save).
 * The loader reads every saved section.
 *
 * SEO: `head` sets the title, description, canonical and hreflang links, plus BreadcrumbList and FAQPage JSON-LD (the
 * questions the page language shows; the closed answers are not in the DOM).
 */
import { createFileRoute } from '@tanstack/react-router'
import { fetchSections, type FaqItem, type FaqItemInput, type FaqItemsContent, type FlowStepsContent, type SectionContent } from '@/api'
import { useSectionSaver } from '@/components/EditableSection'
import { Faq, shownFaq } from '@/components/Faq'
import { PrivateLabel, privateLabelSaver } from '@/components/PrivateLabel'
import {
  defaultPageFaq,
  PAGE_SECTION_KEYS,
  PrivateLabelApproach,
  PrivateLabelCategories,
  PrivateLabelCta,
  PrivateLabelIntro,
  PrivateLabelWhy,
} from '@/components/PrivateLabelPage'
import { dictionaryFor, useI18n } from '@/i18n'
import { breadcrumbJsonLd, faqJsonLd, pageHead } from '@/seo'

/**
 * The page FAQ's questions: the saved list, else the built-in one.
 * @param sections - Every saved section.
 * @returns The questions, in order.
 */
const pageFaq = (sections: Partial<Record<string, unknown>>): FaqItem[] =>
  (sections[PAGE_SECTION_KEYS.faqItems] as FaqItemsContent | undefined)?.items ?? defaultPageFaq()

export const Route = createFileRoute('/private-label')({
  loader: async ({ abortController }) => {
    const sections = await fetchSections(abortController.signal)
    return { sections, faq: pageFaq(sections) }
  },
  head: ({ match, loaderData }) => {
    const { locale } = match.context
    const t = dictionaryFor(locale)
    const questions = loaderData ? shownFaq(loaderData.faq, locale) : []
    return pageHead({
      locale,
      path: '/private-label',
      title: t.privateLabelPage.metaTitle,
      description: t.privateLabelPage.description,
      jsonLd: [
        breadcrumbJsonLd(locale, [
          { name: t.articles.home, path: '/' },
          { name: t.nav.privateLabel, path: '/private-label' },
        ]),
        ...(questions.length ? [faqJsonLd(questions)] : []),
      ],
    })
  },
  component: PrivateLabelPage,
})

/**
 * The Private Label page (see the file header).
 * @returns The page's sections.
 */
function PrivateLabelPage() {
  const { t } = useI18n()
  const p = t.privateLabelPage
  const { sections, faq } = Route.useLoaderData()
  const { saver, saveAll } = useSectionSaver(sections)

  /**
   * The saved content of one section.
   * @param key - Its page_sections row.
   * @returns Its content, or null when it was never edited.
   */
  const contentOf = (key: string) => (sections[key] ?? null) as SectionContent | null

  /**
   * Stores the FAQ staff edited: its questions (one row; a new question gets an id), then its heading's texts.
   * Undefined for everyone else.
   * @param items - The questions in display order.
   * @param content - The heading's new texts.
   * @returns Resolves when saved and reloaded; rejects with the server's ApiError.
   */
  const saveFaq =
    saveAll &&
    ((items: FaqItemInput[], content: SectionContent) =>
      saveAll({
        [PAGE_SECTION_KEYS.faqItems]: { items: items.map((item) => ({ ...item, id: item.id ?? crypto.randomUUID() })) } satisfies FaqItemsContent,
        [PAGE_SECTION_KEYS.faq]: content,
      }))

  return (
    <>
      <PrivateLabelIntro content={contentOf(PAGE_SECTION_KEYS.intro)} onSave={saver(PAGE_SECTION_KEYS.intro)} />
      <PrivateLabelApproach content={contentOf(PAGE_SECTION_KEYS.approach)} onSave={saver(PAGE_SECTION_KEYS.approach)} />
      <PrivateLabel
        steps={(sections.private_label_steps as FlowStepsContent | undefined)?.steps ?? null}
        content={contentOf('private_label')}
        onSave={privateLabelSaver(saveAll)}
        variant="page"
      />
      <PrivateLabelCategories content={contentOf(PAGE_SECTION_KEYS.categories)} onSave={saver(PAGE_SECTION_KEYS.categories)} />
      <PrivateLabelWhy content={contentOf(PAGE_SECTION_KEYS.why)} onSave={saver(PAGE_SECTION_KEYS.why)} />
      <Faq
        id="private-label-faq"
        items={faq}
        content={contentOf(PAGE_SECTION_KEYS.faq)}
        onSave={saveFaq}
        heading={{ eyebrow: p.faqEyebrow, title: p.faqTitle, intro: '' }}
        contactBox={false}
        variant="card"
        defaultOpen={null}
      />
      <PrivateLabelCta content={contentOf(PAGE_SECTION_KEYS.cta)} onSave={saver(PAGE_SECTION_KEYS.cta)} />
    </>
  )
}
