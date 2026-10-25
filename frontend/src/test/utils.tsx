/**
 * test/utils.tsx — Helpers for component tests.
 * renderPage() renders the real app (routes, layout, Navbar) at a URL, the way a browser loads it,
 * so tests exercise the same wiring users get. renderComponent() renders one component on its own
 * (with the router and language providers) so a test can give it custom props.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { applyDocumentLocale, detectLocale, LocaleProvider, type Locale } from '@/i18n'
import { createAppRouter, localeRewrite } from '@/router'

/**
 * Renders the whole app at a URL and waits for the header to appear.
 * @param url - Browser URL, e.g. "/", "/en/where-to-buy" or "/en#brands". Its language prefix picks the
 *   locale, exactly as in main.tsx.
 * @returns The Testing Library render result, the `router` (to inspect the current location) and a
 *   `user` (user-event instance) for clicking and typing.
 */
export async function renderPage(url: string) {
  const locale = detectLocale(new URL(url, 'http://localhost').pathname)
  applyDocumentLocale(locale)
  const router = createAppRouter({ locale, history: createMemoryHistory({ initialEntries: [url] }) })
  const result = render(
    <LocaleProvider locale={locale}>
      <RouterProvider router={router} />
    </LocaleProvider>,
  )
  await screen.findByRole('banner')
  return { ...result, router, user: userEvent.setup() }
}

/**
 * Renders a single component inside a minimal router and the language provider, so links and
 * translations work but the rest of the app (header, other routes) is absent.
 * @param ui - The element to render, e.g. <Hero images={[]} />.
 * @param locale - Language of the page; defaults to Hebrew like the real site.
 * @returns The Testing Library render result and a `user` (user-event instance).
 */
export function renderComponent(ui: ReactNode, locale: Locale = 'he') {
  applyDocumentLocale(locale)
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    rewrite: localeRewrite(locale),
  })
  const result = render(
    <LocaleProvider locale={locale}>
      <RouterProvider router={router} />
    </LocaleProvider>,
  )
  return { ...result, user: userEvent.setup() }
}
