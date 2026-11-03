/**
 * routes/admin.tsx — The staff panel's layout (/admin and every page under it): staff sign-in, the panel's
 * menu and the signed-in staff user with a sign-out button.
 *
 * `beforeLoad` asks the server who is signed in (fetchStaffSession) and passes it to the child routes as
 * `context.staff`, so their loaders fetch data only for signed-in staff. Signed out (or signed in as a
 * business customer), every /admin page shows the staff sign-in form (LoginForm with the staff sign-in);
 * signing in or out reloads the routes. The panel is not for search engines: robots noindex, robots.txt
 * Disallow and no sitemap entry. The data pages (e.g. admin.brands.tsx) show their table in the <Outlet />.
 */
import { createFileRoute, Link, Outlet, useRouter } from '@tanstack/react-router'
import { postStaffSignIn, postStaffSignOut, fetchStaffSession, type StaffUser } from '@/api'
import { LoginForm, type LoginValues } from '@/components/LoginForm'
import { Button } from '@/components/ui/button'
import { dictionaryFor, useI18n } from '@/i18n'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ abortController }) => ({ staff: await fetchStaffSession(abortController.signal) }),
  loader: ({ context }) => context.staff,
  head: ({ match }) => {
    const t = dictionaryFor(match.context.locale)
    return { meta: [{ title: `${t.admin.metaTitle} | ${t.seo.siteName}` }, { name: 'robots', content: 'noindex, nofollow' }] }
  },
  component: AdminLayout,
})

/**
 * The staff panel frame: the sign-in form when signed out, else the menu, the account and the current page.
 * @returns The panel layout.
 */
function AdminLayout() {
  const staff = Route.useLoaderData()
  const { t } = useI18n()
  const router = useRouter()

  /**
   * Signs a staff user in, then reloads the routes so the page shows its data.
   * @param values - The form's email, password and "remember me".
   * @returns Resolves when the page has reloaded; rejects with ApiError 401 for wrong credentials.
   */
  const handleSignIn = async (values: LoginValues) => {
    await postStaffSignIn(values)
    await router.invalidate()
  }

  /** Signs out on the server, then reloads the routes (back to the sign-in form). */
  const handleSignOut = async () => {
    await postStaffSignOut()
    await router.invalidate()
  }

  if (!staff) {
    return (
      <section className="mx-auto max-w-md px-6 py-24 lg:px-10">
        <h1 className="font-display text-3xl font-bold text-brand-charcoal">{t.admin.signInTitle}</h1>
        <p className="mb-8 mt-2 text-sm text-brand-charcoal-muted">{t.admin.signInSubtitle}</p>
        <LoginForm signIn={handleSignIn} idPrefix="staff" />
      </section>
    )
  }
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-10">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-150 pb-4">
        <nav aria-label={t.admin.navLabel}>
          <ul className="flex flex-wrap gap-6">
            <li>
              <Link
                to="/admin/brands"
                className="font-heading text-xs font-semibold uppercase tracking-widest text-brand-charcoal-muted transition-colors hover:text-brand-charcoal aria-[current=page]:text-brand-red"
              >
                {t.admin.navBrands}
              </Link>
            </li>
          </ul>
        </nav>
        <StaffAccount staff={staff} onSignOut={handleSignOut} />
      </div>
      <Outlet />
    </div>
  )
}

/**
 * Who is signed in to the panel, with the sign-out button.
 * @param props.staff - The signed-in staff user.
 * @param props.onSignOut - Signs out.
 * @returns The account line.
 */
function StaffAccount({ staff, onSignOut }: { staff: StaffUser; onSignOut: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-4 text-sm text-brand-charcoal-muted">
      <span>
        {t.admin.signedInAs}
        <span className="font-semibold text-brand-charcoal">{staff.fullName || staff.email}</span>
      </span>
      <Button variant="outline" size="xs" onClick={onSignOut}>
        {t.admin.signOut}
      </Button>
    </div>
  )
}
