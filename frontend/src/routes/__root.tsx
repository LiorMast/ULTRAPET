/**
 * routes/__root.tsx — The layout shared by every page: a "skip to content" link, the Navbar, the
 * current page inside <main>, and the "page not found" screen for unknown URLs.
 */
import { createRootRoute, Link, Outlet, useMatches } from '@tanstack/react-router'
import { Navbar } from '@/components/Navbar'
import { useI18n } from '@/i18n'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

/**
 * Renders the site chrome around the current page. Pages that open with a dark hero declare
 * `staticData: { headerOverlay: true }`: the header starts transparent over them and the page starts
 * at the very top. Every other page gets top padding so the fixed header doesn't cover it.
 * @returns The page layout.
 */
function RootLayout() {
  const { t } = useI18n()
  const overlay = useMatches({ select: (matches) => matches.some((match) => match.staticData.headerOverlay) })

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[60] bg-brand-red px-4 py-3 font-heading text-xs font-semibold text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t.header.skipToContent}
      </a>
      <Navbar overlay={overlay} />
      <main id="main" tabIndex={-1} className={overlay ? 'outline-none' : 'pt-20 outline-none'}>
        <Outlet />
      </main>
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
