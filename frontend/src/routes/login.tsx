/**
 * routes/login.tsx — Login for registered business customers (the B2B portal: price catalog,
 * personal discounts, orders).
 *
 * PLACEHOLDER until the portal is built (see the roadmap in CLAUDE.md); it exists now so the navbar's
 * login link has a real, type-checked destination.
 */
import { createFileRoute } from '@tanstack/react-router'
import { useI18n } from '@/i18n'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

/**
 * Placeholder login page.
 * @returns The page title and a "coming soon" note.
 */
function LoginPage() {
  const { t } = useI18n()
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
      <h1 className="font-heading text-4xl font-bold text-brand-charcoal">{t.nav.login}</h1>
      <p className="mt-4 text-brand-charcoal-muted">{t.page.comingSoon}</p>
    </section>
  )
}
