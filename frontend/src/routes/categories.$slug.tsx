/**
 * routes/categories.$slug.tsx — A product category page, e.g. /categories/dog-food.
 *
 * PLACEHOLDER until category pages are built (see the roadmap in CLAUDE.md); it exists now so the
 * navbar's Products menu links have real, type-checked destinations. Unknown slugs show "not found".
 */
import { createFileRoute, notFound } from '@tanstack/react-router'
import { CATEGORIES } from '@/config'
import { useI18n } from '@/i18n'

export const Route = createFileRoute('/categories/$slug')({
  loader: ({ params }) => {
    const category = CATEGORIES.find((c) => c.slug === params.slug)
    if (!category) throw notFound()
    return category
  },
  component: CategoryPage,
})

/**
 * Placeholder category page.
 * @returns The category name and a "coming soon" note.
 */
function CategoryPage() {
  const { t } = useI18n()
  const category = Route.useLoaderData()
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
      <h1 className="font-heading text-4xl font-bold text-brand-charcoal">{category.label(t)}</h1>
      <p className="mt-4 text-brand-charcoal-muted">{t.page.comingSoon}</p>
    </section>
  )
}
