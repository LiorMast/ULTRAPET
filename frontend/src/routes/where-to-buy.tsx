/**
 * routes/where-to-buy.tsx — "Where to Buy" (משווקים): the directory of pet shops that sell UltraPet
 * products, with a map of branches.
 *
 * PLACEHOLDER until the page is built (see the roadmap in CLAUDE.md); it exists now so the navbar
 * link has a real, type-checked destination.
 */
import { createFileRoute } from '@tanstack/react-router'
import { useI18n } from '@/i18n'

export const Route = createFileRoute('/where-to-buy')({
  component: WhereToBuyPage,
})

/**
 * Placeholder "Where to Buy" page.
 * @returns The page title and a "coming soon" note.
 */
function WhereToBuyPage() {
  const { t } = useI18n()
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
      <h1 className="font-heading text-4xl font-bold text-brand-charcoal">{t.nav.whereToBuy}</h1>
      <p className="mt-4 text-brand-charcoal-muted">{t.page.comingSoon}</p>
    </section>
  )
}
