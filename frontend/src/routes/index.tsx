/**
 * routes/index.tsx — The home page ("/" in Hebrew, "/en" in English).
 *
 * TEMPORARY: until the real sections are built (Hero, Stats, Brands, Categories, Private Label,
 * Business Customers, About, Contact — see the roadmap in CLAUDE.md), this shows a dark hero
 * placeholder and empty sections carrying the anchor ids the navbar links to, so the header's
 * transparent-over-hero behavior and the #section links can be developed and tested.
 */
import { createFileRoute } from '@tanstack/react-router'
import type { Dictionary } from '@/i18n/he'
import { useI18n } from '@/i18n'

export const Route = createFileRoute('/')({
  staticData: { headerOverlay: true },
  component: HomePage,
})

/** The section anchors the navbar and the header button point to, in page order. */
const SECTIONS = [
  { id: 'brands', title: (t: Dictionary) => t.nav.brands },
  { id: 'categories', title: (t: Dictionary) => t.nav.products },
  { id: 'private-label', title: (t: Dictionary) => t.nav.privateLabel },
  { id: 'business', title: (t: Dictionary) => t.nav.businessCta },
  { id: 'about', title: (t: Dictionary) => t.nav.about },
  { id: 'contact', title: (t: Dictionary) => t.nav.contact },
]

/**
 * Placeholder home page: a full-height dark hero followed by one empty section per anchor.
 * @returns The page content.
 */
function HomePage() {
  const { t } = useI18n()
  return (
    <>
      <section
        id="home"
        className="relative flex min-h-svh items-center overflow-hidden bg-linear-to-br from-black via-brand-charcoal to-brand-charcoal-3"
      >
        <div className="absolute inset-y-0 start-0 w-1 bg-brand-red" aria-hidden="true" />
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-10">
          <h1 className="font-display text-6xl font-bold text-white md:text-8xl">UltraPet</h1>
          <p className="mt-6 max-w-xl text-lg text-white/60">{t.page.comingSoon}</p>
        </div>
      </section>
      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="min-h-[70vh] border-b border-neutral-150 px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-heading text-3xl font-bold text-brand-charcoal">{section.title(t)}</h2>
            <p className="mt-4 text-brand-charcoal-muted">{t.page.comingSoon}</p>
          </div>
        </section>
      ))}
    </>
  )
}
