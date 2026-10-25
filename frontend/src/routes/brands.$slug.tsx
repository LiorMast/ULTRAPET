/**
 * routes/brands.$slug.tsx — A brand page, e.g. /brands/ultra-pet.
 *
 * PLACEHOLDER until brand pages are built (see the roadmap in CLAUDE.md); it exists now so the brand
 * cards on the home page have real, type-checked destinations. Unknown slugs show "not found".
 */
import { createFileRoute, notFound } from '@tanstack/react-router'
import { BRANDS } from '@/config'
import { useI18n } from '@/i18n'

export const Route = createFileRoute('/brands/$slug')({
  loader: ({ params }) => {
    const brand = BRANDS.find((b) => b.slug === params.slug)
    if (!brand) throw notFound()
    return brand
  },
  component: BrandPage,
})

/**
 * Placeholder brand page.
 * @returns The brand name, its tagline and a "coming soon" note.
 */
function BrandPage() {
  const { t } = useI18n()
  const brand = Route.useLoaderData()
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
      <h1 className="font-heading text-4xl font-bold text-brand-charcoal">{brand.name}</h1>
      <p className="mt-2 text-brand-charcoal-muted">{brand.tagline(t)}</p>
      <p className="mt-4 text-brand-charcoal-muted">{t.page.comingSoon}</p>
    </section>
  )
}
