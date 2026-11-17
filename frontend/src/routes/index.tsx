/**
 * routes/index.tsx — The home page ("/" in Hebrew, "/en" in English). Its loader fetches the brands, the
 * stats figures, the content staff saved for every editable section (page_sections, one row per section: "hero",
 * "stats", "brands", "categories", "private_label" + "private_label_steps", "business", "about", "faq", "contact"), the FAQ questions (faq_items) and the contact details
 * from the API (the catalog categories, shown as the Categories cards, and the contact details come with the root
 * route's data). Signed-in staff edit every section in place
 * ("Edit on page", the page's language, one section at a time; EditableSection.tsx), the hero also in the
 * two-language dialog (HeroEditor); saving stores the content through the staff API
 * (saveSection; the stats numbers and contact details go to the settings) and reloads the page data. The head
 * carries the questions the page language shows as schema.org FAQPage data.
 *
 * Sections in order: the hero, Stats, Brands, Categories, Private Label, Business Customers (#business: the request
 * for a business account, the header's and the hero's "Become a business customer" target), About, FAQ and Contact.
 */
import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { fetchBrands, fetchFaq, fetchSections, fetchStats, replaceStaffRows, saveSection, saveSetting, type FaqItemInput, type FlowStep, type FlowStepsContent, type HeroContent, type SectionContent } from '@/api'
import { useAuth } from '@/auth'
import { About } from '@/components/About'
import { Brands } from '@/components/Brands'
import { BusinessCustomers } from '@/components/BusinessCustomers'
import { Categories } from '@/components/Categories'
import { Contact } from '@/components/Contact'
import { Faq, shownFaq } from '@/components/Faq'
import { Hero } from '@/components/Hero'
import { HeroEditor } from '@/components/HeroEditor'
import { PrivateLabel } from '@/components/PrivateLabel'
import { Stats } from '@/components/Stats'
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

/**
 * The home page: the hero, Stats, Brands, Categories, Private Label, Business Customers, About, the FAQ and Contact
 * (each editable by staff).
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

  /**
   * Stores the Private Label section staff edited: its steps (one row, in order), then its heading's texts, and reloads
   * the page data.
   * @param steps - The steps in flow order.
   * @param content - The heading's new texts (page_sections "private_label").
   * @returns Resolves when saved and reloaded; rejects with the server's ApiError.
   */
  const savePrivateLabel = async (steps: FlowStep[], content: SectionContent) => {
    await saveSection('private_label_steps', { steps } satisfies FlowStepsContent, 'private_label_steps' in sections)
    await saveSection('private_label', content, 'private_label' in sections)
    await router.invalidate()
  }

  const saveHero = saver('hero')
  const privateLabelSteps = (sections.private_label_steps as FlowStepsContent | undefined)?.steps ?? null
  return (
    <>
      <Hero content={hero} onSave={saveHero} editor={saveHero && <HeroEditor content={hero} onSave={saveHero} />} />
      <Stats stats={stats} content={contentOf('stats')} onSave={saver('stats')} />
      <Brands brands={brands} content={contentOf('brands')} onSave={saver('brands')} />
      <Categories categories={categories} content={contentOf('categories')} onSave={saver('categories')} />
      <PrivateLabel steps={privateLabelSteps} content={contentOf('private_label')} onSave={staff ? savePrivateLabel : undefined} />
      <BusinessCustomers content={contentOf('business')} onSave={saver('business')} />
      <About content={contentOf('about')} onSave={saver('about')} />
      <Faq items={faq} content={contentOf('faq')} onSave={staff ? saveFaq : undefined} />
      <Contact details={contact} content={contentOf('contact')} onSave={saver('contact')} />
    </>
  )
}
