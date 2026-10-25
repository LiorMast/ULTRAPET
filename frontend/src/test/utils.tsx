/**
 * test/utils.tsx — Helpers for component tests.
 * renderPage() renders the real app (routes, layout, Navbar) at a URL, the way a browser loads it,
 * so tests exercise the same wiring users get.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { applyDocumentLocale, detectLocale, LocaleProvider } from '@/i18n'
import { createAppRouter } from '@/router'

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
