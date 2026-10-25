/**
 * routes/index.tsx — The home page ("/" in Hebrew, "/en" in English).
 *
 * The hero is the real component. The sections below it are TEMPORARY placeholders (Stats, Brands,
 * Categories, Private Label, Business Customers, About, Contact — see the roadmap in CLAUDE.md): each is
 * an empty block carrying the anchor id that the navbar and the hero link to, until the real section
 * replaces it.
 */
import { createFileRoute } from '@tanstack/react-router'
import { Hero } from '@/components/Hero'
import type { Dictionary } from '@/i18n/he'
import { useI18n } from '@/i18n'

export const Route = createFileRoute('/')({
  component: HomePage,
})

/** The section anchors the navbar and the hero link to, in page order (`title` is omitted for Stats). */
const SECTIONS: { id: string; title?: (t: Dictionary) => string }[] = [
  { id: 'stats' },
  { id: 'brands', title: (t) => t.nav.brands },
  { id: 'categories', title: (t) => t.nav.products },
  { id: 'private-label', title: (t) => t.nav.privateLabel },
  { id: 'business', title: (t) => t.nav.businessCta },
  { id: 'about', title: (t) => t.nav.about },
  { id: 'contact', title: (t) => t.nav.contact },
]

/**
 * The home page: the hero followed by one empty placeholder section per anchor.
 * @returns The page content.
 */
function HomePage() {
  const { t } = useI18n()
  return (
    <>
      <Hero />
      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="min-h-[70vh] border-b border-neutral-150 px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            {section.title && <h2 className="font-heading text-3xl font-bold text-brand-charcoal">{section.title(t)}</h2>}
            <p className="mt-4 text-brand-charcoal-muted">{t.page.comingSoon}</p>
          </div>
        </section>
      ))}
    </>
  )
}
