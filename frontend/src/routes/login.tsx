/**
 * routes/login.tsx — The one login page, for registered business customers (the B2B portal: price catalog,
 * personal discounts, orders) and for staff (the admin panel).
 *
 * Shows the same LoginForm as the header popover (the AccountPanel once signed in); the mobile menu links
 * here.
 */
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/auth'
import { AccountPanel } from '@/components/AccountPanel'
import { LoginForm } from '@/components/LoginForm'
import { useI18n } from '@/i18n'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

/**
 * The login page.
 * @returns The page title and the login form, or the account panel when signed in.
 */
function LoginPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  return (
    <section className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:py-24">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-soft sm:p-10">
        <h1 className="font-display text-3xl font-bold text-brand-charcoal">{user ? t.login.account : t.login.title}</h1>
        <p className="mb-8 mt-2 text-sm text-brand-charcoal-muted">{t.login.subtitle}</p>
        {user ? <AccountPanel user={user} /> : <LoginForm />}
      </div>
    </section>
  )
}
