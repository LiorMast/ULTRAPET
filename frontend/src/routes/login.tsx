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
import { LoginCard, LoginForm } from '@/components/LoginForm'
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
    <LoginCard title={user ? t.login.account : t.login.title} subtitle={t.login.subtitle}>
      {user ? <AccountPanel user={user} /> : <LoginForm />}
    </LoginCard>
  )
}
