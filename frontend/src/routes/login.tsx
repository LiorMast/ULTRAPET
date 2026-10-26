/**
 * routes/login.tsx — Login for registered business customers (the B2B portal: price catalog,
 * personal discounts, orders).
 *
 * Shows the same LoginForm as the header popover; the mobile menu links here. The portal itself is Phase 4
 * (see the roadmap in CLAUDE.md).
 */
import { createFileRoute } from '@tanstack/react-router'
import { LoginForm } from '@/components/LoginForm'
import { useI18n } from '@/i18n'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

/**
 * The login page.
 * @returns The page title and the login form.
 */
function LoginPage() {
  const { t } = useI18n()
  return (
    <section className="mx-auto max-w-md px-6 py-24 lg:px-10">
      <h1 className="font-display text-3xl font-bold text-brand-charcoal">{t.login.title}</h1>
      <p className="mb-8 mt-2 text-sm text-brand-charcoal-muted">{t.login.subtitle}</p>
      <LoginForm />
    </section>
  )
}
