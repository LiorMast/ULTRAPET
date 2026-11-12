/**
 * routes/index.tsx — The home page ("/" in Hebrew, "/en" in English). Its loader fetches the brands, the
 * stats figures, the content staff saved for every editable section (page_sections, one row per section: "hero",
 * "stats", "brands", "categories", "about", "faq", "contact"), the FAQ questions (faq_items) and the contact details
 * from the API (the catalog categories, shown as the Categories cards, and the contact details come with the root
 * route's data). Signed-in staff edit every section in place
 * ("Edit on page", the page's language, one section at a time; EditableSection.tsx), the hero also in the
 * two-language dialog (HeroEditor); saving stores the content through the staff API
 * (saveSection; the stats numbers and contact details go to the settings) and reloads the page data. The head
 * carries the questions the page language shows as schema.org FAQPage data.
 *
 * The hero, Brands, Stats, Categories, About, FAQ and Contact are real components. The other sections are TEMPORARY placeholders
 * (Private Label, Business Customers — see the roadmap in CLAUDE.md): each is
 * an empty block carrying the anchor id that the navbar and the hero link to, until the real section
 * replaces it.
 */
import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { fetchBrands, fetchFaq, fetchSections, fetchStats, replaceStaffRows, saveSection, saveSetting, type FaqItemInput, type HeroContent, type SectionContent } from '@/api'
import { useAuth } from '@/auth'
import { About } from '@/components/About'
import { Brands } from '@/components/Brands'
import { Categories } from '@/components/Categories'
import { Contact } from '@/components/Contact'
import { Faq, shownFaq } from '@/components/Faq'
import { Hero } from '@/components/Hero'
import { HeroEditor } from '@/components/HeroEditor'
import { Stats } from '@/components/Stats'
import type { Dictionary } from '@/i18n/he'
import { useI18n } from '@/i18n'
import { faqJsonLd, pageHead } from '@/seo'

/** The root route, whose loader has the catalog categories and the contact details (shared with the header and the WhatsApp button). */
const rootRoute = getRouteApi('__root__')

export const Route = createFileRoute('/')({
  loader: async ({ abortController }) => {
    const { signal } = abortController
    const [brands, stats, sections, faq] = await Promise.all([fetchBrands(signal), fetchStats(signal), fetchSections(signal), fetchFaq(signal)])
    return { brands, stats, sections, faq }
  },
  head: ({ match, loaderData }) => {
    const { locale } = match.context
    const questions = loaderData ? shownFaq(loaderData.faq, locale) : []
    return pageHead({ locale, path: '/', jsonLd: questions.length ? [faqJsonLd(questions)] : [] })
  },
  component: HomePage,
})

/** The placeholder section anchors the navbar and the hero link to, in page order. */
const SECTIONS: { id: string; title: (t: Dictionary) => string }[] = [
  { id: 'private-label', title: (t) => t.nav.privateLabel },
  { id: 'business', title: (t) => t.nav.businessCta },
]

/**
 * One empty placeholder section.
 * @param section - Its anchor id and title (see SECTIONS).
 * @returns The placeholder <section>.
 */
function Placeholder({ section }: { section: (typeof SECTIONS)[number] }) {
  const { t } = useI18n()
  return (
    <section id={section.id} className="min-h-[70vh] border-b border-neutral-150 px-6 py-24 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-heading text-3xl font-bold text-brand-charcoal">{section.title(t)}</h2>
        <p className="mt-4 text-brand-charcoal-muted">{t.page.comingSoon}</p>
      </div>
    </section>
  )
}

/**
 * The home page: the hero, Stats, Brands, Categories, About, the FAQ and Contact (each editable by staff), and one
 * empty placeholder per remaining anchor.
 * @returns The page content.
 */
function HomePage() {
  const { brands, stats, sections, faq } = Route.useLoaderData()
  const { categories, contact } = rootRoute.useLoaderData()
  const { user } = useAuth()
  const router = useRouter()
  const staff = user?.kind === 'staff'
  const hero = (sections.hero ?? null) as HeroContent | null

  /**
   * The saved content of one section.
   * @param key - The section, e.g. "about".
   * @returns Its content, or null when it was never edited.
   */
  const contentOf = (key: string) => (sections[key] ?? null) as SectionContent | null

  /**
   * The save handler of one section for staff; undefined for everyone else, so the section is not editable. It
   * stores the changed settings first (the stats numbers, the contact details; one request each, so a failed save can
   * simply be sent again), then the section's content (creating its row on the first save), and reloads the page data.
   * @param key - The section, e.g. "about".
   * @returns The handler (content, changed settings by key): resolves when saved and reloaded, rejects with the
   *   server's ApiError.
   */
  const saver = (key: string) =>
    staff
      ? async (content: object, settings: Record<string, unknown> = {}) => {
          for (const [setting, value] of Object.entries(settings)) await saveSetting(setting, value)
          await saveSection(key, content, key in sections)
          await router.invalidate()
        }
      : undefined

  /**
   * Stores the FAQ staff edited: its new list of questions (one request: kept, new and deleted questions and their
   * order), then the section's texts, and reloads the page data.
   * @param items - The questions in display order.
   * @param content - The section's new texts (page_sections "faq").
   * @returns Resolves when saved and reloaded; rejects with the server's ApiError.
   */
  const saveFaq = async (items: FaqItemInput[], content: SectionContent) => {
    await replaceStaffRows('faq-items', items)
    await saveSection('faq', content, 'faq' in sections)
    await router.invalidate()
  }

  const saveHero = saver('hero')
  return (
    <>
      <Hero content={hero} onSave={saveHero} editor={saveHero && <HeroEditor content={hero} onSave={saveHero} />} />
      <Stats stats={stats} content={contentOf('stats')} onSave={saver('stats')} />
      <Brands brands={brands} content={contentOf('brands')} onSave={saver('brands')} />
      <Categories categories={categories} content={contentOf('categories')} onSave={saver('categories')} />
      {SECTIONS.slice(0, 2).map((section) => (
        <Placeholder key={section.id} section={section} />
      ))}
      <About content={contentOf('about')} onSave={saver('about')} />
      <Faq items={faq} content={contentOf('faq')} onSave={staff ? saveFaq : undefined} />
      <Contact details={contact} content={contentOf('contact')} onSave={saver('contact')} />
    </>
  )
}
