/**
 * routes/index.tsx — The home page ("/" in Hebrew, "/en" in English).
 *
 * The hero, Brands and Stats are real components. The other sections are TEMPORARY placeholders
 * (Categories, Private Label, Business Customers, About, Contact — see the roadmap in CLAUDE.md): each is
 * an empty block carrying the anchor id that the navbar and the hero link to, until the real section
 * replaces it.
 */
import { createFileRoute } from '@tanstack/react-router'
import { Brands } from '@/components/Brands'
import { Hero } from '@/components/Hero'
import { Stats } from '@/components/Stats'
import type { Dictionary } from '@/i18n/he'
import { useI18n } from '@/i18n'

export const Route = createFileRoute('/')({
  component: HomePage,
})

/** The placeholder section anchors the navbar and the hero link to, in page order. */
const SECTIONS: { id: string; title: (t: Dictionary) => string }[] = [
  { id: 'categories', title: (t) => t.nav.products },
  { id: 'private-label', title: (t) => t.nav.privateLabel },
  { id: 'business', title: (t) => t.nav.businessCta },
  { id: 'about', title: (t) => t.nav.about },
  { id: 'contact', title: (t) => t.nav.contact },
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
 * The home page: the hero, the Brands and Stats sections, then one empty placeholder per remaining anchor.
 * @returns The page content.
 */
function HomePage() {
  return (
    <>
      <Hero />
      <Brands />
      <Stats />
      {SECTIONS.map((section) => (
        <Placeholder key={section.id} section={section} />
      ))}
    </>
  )
}
