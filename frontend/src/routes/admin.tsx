/**
 * routes/admin.tsx — The staff panel's layout (/admin and every page under it): the sign-in form, the panel's
 * menu and who is signed in.
 *
 * `beforeLoad` asks the server who is signed in (fetchSession) and passes the user to the child routes as
 * `context.staff` (null unless a staff member), so their loaders fetch data only for staff. Signed out (or signed
 * in as a business customer), every /admin page shows the site's one sign-in form (LoginForm); the header's
 * login and log out buttons work here too. Whenever the session changes (here or in the header) the routes
 * reload. Signing out is the header's Log out button. The panel is not for search engines: robots noindex, robots.txt
 * Disallow and no sitemap entry. The data pages (e.g. admin.brands.tsx) show their table in the <Outlet />.
 */
import { useEffect, useRef } from 'react'
import { createFileRoute, Link, Outlet, useRouter } from '@tanstack/react-router'
import { fetchSession, type User } from '@/api'
import { useAuth } from '@/auth'
import { LoginCard, LoginForm } from '@/components/LoginForm'
import { ADMIN_NAV } from '@/config'
import { dictionaryFor, useI18n } from '@/i18n'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ abortController }) => {
    const user = await fetchSession(abortController.signal)
    return { staff: user?.kind === 'staff' ? user : null }
  },
  loader: ({ context }) => context.staff,
  head: ({ match }) => {
    const t = dictionaryFor(match.context.locale)
    return { meta: [{ title: `${t.admin.metaTitle} | ${t.seo.siteName}` }, { name: 'robots', content: 'noindex, nofollow' }] }
  },
  component: AdminLayout,
})

/**
 * The staff panel frame: the sign-in form when not signed in as staff, else the menu, the account and the
 * current page.
 * @returns The panel layout.
 */
function AdminLayout() {
  const loaded = Route.useLoaderData()
  const { user } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const staff = user?.kind === 'staff' ? user : null
  const sessionKey = user ? `${user.kind}:${user.email}` : ''
  const shownKey = useRef(sessionKey)

  // The header (or the form below) changed the session: load the pages again for the new user.
  useEffect(() => {
    if (shownKey.current === sessionKey) return
    shownKey.current = sessionKey
    void router.invalidate()
  }, [sessionKey, router])

  if (!staff) {
    return (
      <LoginCard title={t.admin.signInTitle} subtitle={t.admin.signInSubtitle}>
        <LoginForm idPrefix="staff" />
      </LoginCard>
    )
  }
  if (!loaded) return null
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-10">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-150 pb-4">
        <nav aria-label={t.admin.navLabel}>
          <ul className="flex flex-wrap gap-1">
            {ADMIN_NAV.map(({ id, link, label }) => (
              <li key={id}>
                <Link
                  {...link}
                  className="block rounded-full px-3.5 py-2 font-heading text-sm font-medium text-neutral-700 outline-none transition-[color,background-color] duration-300 hover:bg-neutral-100 hover:text-brand-charcoal focus-visible:ring-2 focus-visible:ring-brand-red aria-[current=page]:bg-brand-red-muted aria-[current=page]:text-brand-red-dark"
                >
                  {label(t)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <StaffAccount staff={staff} />
      </div>
      <Outlet />
    </div>
  )
}

/**
 * Who is signed in to the panel.
 * @param props.staff - The signed-in staff user.
 * @returns The account line.
 */
function StaffAccount({ staff }: { staff: User }) {
  const { t } = useI18n()
  return (
    <p className="text-sm text-brand-charcoal-muted">
      {t.admin.signedInAs}
      <span className="font-semibold text-brand-charcoal">{staff.fullName || staff.email}</span>
    </p>
  )
}
