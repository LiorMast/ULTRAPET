/**
 * routes/index.tsx — The home page ("/" in Hebrew, "/en" in English). Its loader fetches the brands, the
 * stats figures and the hero content staff saved (page_sections "hero") from the API. Signed-in staff can edit the
 * hero in place ("Edit on page", the page's language) or in the two-language dialog (HeroEditor); saving stores the
 * content through the staff API and reloads the page data. The head carries the FAQ section's questions as
 * schema.org FAQPage data.
 *
 * The hero, Brands, Stats, Categories, About, FAQ and Contact are real components. The other sections are TEMPORARY placeholders
 * (Private Label, Business Customers — see the roadmap in CLAUDE.md): each is
 * an empty block carrying the anchor id that the navbar and the hero link to, until the real section
 * replaces it.
 */
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createStaffRow, fetchBrands, fetchSection, fetchStats, updateStaffRow, type HeroContent } from '@/api'
import { useAuth } from '@/auth'
import { About } from '@/components/About'
import { Brands } from '@/components/Brands'
import { Categories } from '@/components/Categories'
import { Contact } from '@/components/Contact'
import { Faq } from '@/components/Faq'
import { Hero } from '@/components/Hero'
import { HeroEditor } from '@/components/HeroEditor'
import { Stats } from '@/components/Stats'
import { FAQ_ITEMS } from '@/config'
import type { Dictionary } from '@/i18n/he'
import { dictionaryFor, useI18n } from '@/i18n'
import { faqJsonLd, pageHead } from '@/seo'

export const Route = createFileRoute('/')({
  loader: async ({ abortController }) => {
    const { signal } = abortController
    const [brands, stats, hero] = await Promise.all([fetchBrands(signal), fetchStats(signal), fetchSection<HeroContent>('hero', signal)])
    return { brands, stats, hero }
  },
  head: ({ match }) => {
    const { locale } = match.context
    const t = dictionaryFor(locale)
    return pageHead({ locale, path: '/', jsonLd: [faqJsonLd(FAQ_ITEMS.map((item) => ({ question: item.question(t), answer: item.answer(t) })))] })
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
 * The home page: the hero (editable by staff), the Brands, Stats and Categories sections, About,
 * the FAQ, Contact, and one empty placeholder per remaining anchor.
 * @returns The page content.
 */
function HomePage() {
  const { brands, stats, hero } = Route.useLoaderData()
  const { user } = useAuth()
  const router = useRouter()

  /**
   * Stores the hero content staff edited (the row is created on the first save) and reloads the page data.
   * @param content - The new hero content.
   * @returns Resolves when saved and reloaded; rejects with the server's ApiError.
   */
  const saveHero = async (content: HeroContent) => {
    if (hero) await updateStaffRow('page-sections', 'hero', { content })
    else await createStaffRow('page-sections', { key: 'hero', content })
    await router.invalidate()
  }

  return (
    <>
      {user?.kind === 'staff' ? <Hero content={hero} onSave={saveHero} editor={<HeroEditor content={hero} onSave={saveHero} />} /> : <Hero content={hero} />}
      <Stats stats={stats} />
      <Brands brands={brands} />
      <Categories />
      {SECTIONS.slice(0, 2).map((section) => (
        <Placeholder key={section.id} section={section} />
      ))}
      <About />
      <Faq />
      <Contact />
    </>
  )
}
