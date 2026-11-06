/**
 * routes/__root.tsx — The layout shared by every page: the route-managed <head> tags, a "skip to
 * content" link, the Navbar (its Products dropdown lists the categories this route loads), the current page inside <main>, the floating WhatsApp button (not on the staff
 * panel, /admin/...; the contact details this route loads; the home page's Contact section reads them from here too), the "page not found" screen for
 * unknown URLs, and the "could not load" screen (LoadError, the router's default error component) for pages
 * whose API request failed. Its `head` sets the default title and description; pages override them (see seo.ts).
 */
import { createRootRouteWithContext, HeadContent, Link, Outlet, useMatchRoute, useRouter } from '@tanstack/react-router'
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
 * Renders the site chrome around the current page. The fixed 88px header is always white, so every
 * page gets matching top padding and nothing is hidden under it. The WhatsApp button is left out of the staff panel.
 * @returns The page layout.
 */
function RootLayout() {
  const { t } = useI18n()
  const { categories, contact } = Route.useLoaderData()
  const matchRoute = useMatchRoute()
  const isAdmin = Boolean(matchRoute({ to: '/admin', fuzzy: true }))

  return (
    <>
      <HeadContent />
      <a
        href="#main"
        className="sr-only z-[60] bg-brand-red px-4 py-3 font-heading text-xs font-semibold text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t.header.skipToContent}
      </a>
      <Navbar categories={categories} />
      <main id="main" tabIndex={-1} className="pt-22 outline-none">
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
      <h1 className="font-heading text-3xl font-bold text-brand-charcoal">{t.page.notFoundTitle}</h1>
      <p className="mt-4 text-brand-charcoal-muted">{t.page.notFoundBody}</p>
      <Link to="/" className="mt-8 inline-block font-heading text-xs font-semibold uppercase tracking-widest text-brand-red hover:underline">
        {t.page.backHome}
      </Link>
    </section>
  )
}

/**
 * The "could not load" screen, shown inside the layout in place of a page whose data request failed (the API
 * is down or the connection dropped). The router's defaultErrorComponent (router.ts).
 * @returns The message with a button that runs the page's loaders again.
 */
export function LoadError() {
  const { t } = useI18n()
  const router = useRouter()
  return (
    <section className="mx-auto max-w-3xl px-6 py-32 text-center">
      <h1 className="font-heading text-3xl font-bold text-brand-charcoal">{t.page.loadErrorTitle}</h1>
      <p className="mt-4 text-brand-charcoal-muted">{t.page.loadErrorBody}</p>
      <Button className="mt-8" onClick={() => void router.invalidate()}>
        {t.page.retry}
      </Button>
    </section>
  )
}
