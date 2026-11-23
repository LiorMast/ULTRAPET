/**
 * routes/account.tsx — "My account" (/account): a signed-in business customer's own profile (CustomerProfile, view
 * "customer"): their details, purchase history, current and past discounts and last activity, from GET /api/account.
 *
 * `beforeLoad` asks the server who is signed in, and the loader fetches the profile only for a business customer.
 * Signed out, the page shows the site's one sign-in form (LoginForm); staff get a note with a link to the admin panel
 * (their customers' profiles live there). The header's "My account" button links here. When the session changes the
 * route reloads. Private: robots noindex, not in the sitemap.
 */
import { useEffect, useRef } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import { fetchAccount, fetchSession } from '@/api'
import { useAuth } from '@/auth'
import { CustomerProfile } from '@/components/CustomerProfile'
import { LoginCard, LoginForm } from '@/components/LoginForm'
import { SectionHeading } from '@/components/SectionHeading'
import { TextLink } from '@/components/TextLink'
import { dictionaryFor, useI18n } from '@/i18n'

export const Route = createFileRoute('/account')({
  beforeLoad: async ({ abortController }) => ({ session: await fetchSession(abortController.signal) }),
  loader: async ({ context, abortController }) => (context.session?.kind === 'business' ? fetchAccount(abortController.signal) : null),
  head: ({ match }) => {
    const t = dictionaryFor(match.context.locale)
    return { meta: [{ title: `${t.account.metaTitle} | ${t.seo.siteName}` }, { name: 'robots', content: 'noindex, nofollow' }] }
  },
  component: AccountPage,
})

/**
 * The account page: the sign-in form, the staff note, or the customer's profile.
 * @returns The page.
 */
function AccountPage() {
  const profile = Route.useLoaderData()
  const { user } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const sessionKey = user ? `${user.kind}:${user.email}` : ''
  const shownKey = useRef(sessionKey)

  // The header (or the form below) changed the session: load the profile again for the new user.
  useEffect(() => {
    if (shownKey.current === sessionKey) return
    shownKey.current = sessionKey
    void router.invalidate()
  }, [sessionKey, router])

  if (!user) {
    return (
      <LoginCard title={t.login.title} subtitle={t.login.subtitle}>
        <LoginForm idPrefix="account-login" />
      </LoginCard>
    )
  }
  if (user.kind === 'staff') {
    return (
      <LoginCard title={t.account.title} subtitle={t.account.staffNote}>
        <TextLink link={{ to: '/admin' }} icon={ShieldCheck}>
          {t.nav.adminPanel}
        </TextLink>
      </LoginCard>
    )
  }
  if (!profile) return null
  return (
    <div className="page-y px-gutter mx-auto max-w-7xl lg:py-16">
      <SectionHeading id="account-title" as="h1" eyebrow={profile.customer.companyName} title={t.account.title} intro={t.account.subtitle} className="mb-10" />
      <CustomerProfile profile={profile} view="customer" />
    </div>
  )
}
