/**
 * routes/index.tsx — The home page ("/" in Hebrew, "/en" in English). Its loader fetches the brands, the
 * stats figures and the hero content staff saved (page_sections "hero") from the API. Signed-in staff get the
 * hero's Edit button (HeroEditor); saving stores the content through the staff API and reloads the page data.
 *
 * The hero, Brands, Stats, Categories, About and Contact are real components. The other sections are TEMPORARY placeholders
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
import { Hero } from '@/components/Hero'
import { HeroEditor } from '@/components/HeroEditor'
import { Stats } from '@/components/Stats'
import type { Dictionary } from '@/i18n/he'
import { useI18n } from '@/i18n'
import { pageHead } from '@/seo'

export const Route = createFileRoute('/')({
  loader: async ({ abortController }) => {
    const { signal } = abortController
    const [brands, stats, hero] = await Promise.all([fetchBrands(signal), fetchStats(signal), fetchSection<HeroContent>('hero', signal)])
    return { brands, stats, hero }
  },
  head: ({ match }) => pageHead({ locale: match.context.locale, path: '/' }),
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
 * The home page: the hero (with its Edit button for staff), the Brands, Stats and Categories sections, About,
 * Contact, and one empty placeholder per remaining anchor.
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
      <Hero content={hero} editor={user?.kind === 'staff' && <HeroEditor content={hero} onSave={saveHero} />} />
      <Stats stats={stats} />
      <Brands brands={brands} />
      <Categories />
      {SECTIONS.slice(0, 2).map((section) => (
        <Placeholder key={section.id} section={section} />
      ))}
      <About />
      <Contact />
    </>
  )
}
