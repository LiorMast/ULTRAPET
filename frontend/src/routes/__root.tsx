/**
 * routes/__root.tsx — The layout shared by every page: the route-managed <head> tags, a "skip to
 * content" link, the Navbar (its Products dropdown lists the categories this route loads), the current page inside <main>, the floating WhatsApp button (not on the staff
 * panel, /admin/...; the contact details this route loads; the home page's Contact section reads them from here too), the "page not found" screen for
 * unknown URLs, and the "could not load" screen (LoadError, the router's default error component) for pages
 * whose API request failed. Its `head` sets the default title and description; pages override them (see seo.ts).
 * Loading feedback: while a navigation waits for its data, the current page stays (so a field being typed in keeps
 * its focus) and a slim red bar runs along the top of the window (RouteProgress; <main> is aria-busy); the very first
 * load, before there is any page to keep, shows a skeleton of the page being opened (PageSkeleton, the router's
 * default pending component, see router.ts): inside this layout once its own data is in, else with the header's
 * skeleton too.
 */
import { useState } from 'react'
import { createRootRouteWithContext, HeadContent, Link, Outlet, useMatchRoute, useRouter, useRouterState } from '@tanstack/react-router'
import { fetchCategories, fetchContact, type ContactDetails, type ProductCategory } from '@/api'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import { dictionaryFor, useI18n, type Locale } from '@/i18n'

/** What every route receives from the router (see createAppRouter): the language of this page load. */
export type RouterContext = { locale: Locale }

export const Route = createRootRouteWithContext<RouterContext>()({
  loader: async ({ abortController }): Promise<{ categories: ProductCategory[]; contact: ContactDetails }> => {
    const { signal } = abortController
    const [categories, contact] = await Promise.all([fetchCategories(signal), fetchContact(signal)])
    return { categories, contact }
  },
  head: ({ match }) => {
    const { seo } = dictionaryFor(match.context.locale)
    return { meta: [{ title: seo.defaultTitle }, { name: 'description', content: seo.defaultDescription }] }
  },
  component: RootLayout,
  notFoundComponent: NotFound,
})

/**
 * The navigation progress bar: a slim red bar sliding along the top edge while the next page's data loads. It
 * appears only after 200ms (a quick navigation shows nothing) and fades out when the page arrives. Decorative: the
 * busy state is announced through <main aria-busy>.
 * @param props.active - True while the router waits for a page's data.
 * @returns The bar.
 */
function RouteProgress({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-active={active || undefined}
      className="group pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden opacity-0 transition-opacity duration-300 data-active:opacity-100 data-active:delay-200"
    >
      <span className="block h-full w-1/3 rounded-full bg-brand-red group-data-active:animate-route-progress" />
    </div>
  )
}

/**
 * Renders the site chrome around the current page. The fixed 88px header is always white, so every
 * page gets matching top padding and nothing is hidden under it. The WhatsApp button is left out of the staff panel.
 * @returns The page layout.
 */
function RootLayout() {
  const { t } = useI18n()
  const { categories, contact } = Route.useLoaderData()
  const matchRoute = useMatchRoute()
  const isAdmin = Boolean(matchRoute({ to: '/admin', fuzzy: true }))
  const loading = useRouterState({ select: (state) => state.status === 'pending' })

  return (
    <>
      <HeadContent />
      <a
        href="#main"
        className="sr-only z-[60] bg-brand-red px-4 py-3 font-heading text-xs font-semibold text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t.header.skipToContent}
      </a>
      <RouteProgress active={loading} />
      <Navbar categories={categories} />
      <main id="main" tabIndex={-1} aria-busy={loading || undefined} className="pt-22 outline-none">
        <Outlet />
      </main>
      {!isAdmin && <WhatsAppButton phone={contact.whatsapp} />}
    </>
  )
}

/**
 * The "page not found" screen: unknown URLs, unknown category slugs and disabled language prefixes
 * such as /ru/... all end up here.
 * @returns The not-found message with a link to the home page.
 */
function NotFound() {
  const { t } = useI18n()
  return (
    <section className="mx-auto max-w-3xl px-6 py-32 text-center">
      <h1 className="font-display text-3xl font-bold text-brand-charcoal">{t.page.notFoundTitle}</h1>
      <p className="mt-4 text-brand-charcoal-muted">{t.page.notFoundBody}</p>
      <Button asChild className="mt-8">
        <Link to="/">{t.page.backHome}</Link>
      </Button>
    </section>
  )
}

/**
 * The "could not load" screen, shown inside the layout in place of a page whose data request failed (the API
 * is down or the connection dropped). The router's defaultErrorComponent (router.ts).
 * @returns The message with a button that runs the page's loaders again (spinning while they run).
 */
export function LoadError() {
  const { t } = useI18n()
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)

  /** "Try again": runs the page's loaders again, the button spinning until they answer. */
  const handleRetry = async () => {
    setRetrying(true)
    try {
      await router.invalidate()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-32 text-center">
      <h1 className="font-display text-3xl font-bold text-brand-charcoal">{t.page.loadErrorTitle}</h1>
      <p className="mt-4 text-brand-charcoal-muted">{t.page.loadErrorBody}</p>
      <Button className="mt-8" loading={retrying} onClick={() => void handleRetry()}>
        {t.page.retry}
      </Button>
    </section>
  )
}
