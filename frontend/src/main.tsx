/**
 * main.tsx — Browser entry point of the UltraPet site.
 * Reads the page language from the URL (/en/... = English, no prefix = Hebrew), applies it to <html>,
 * removes the static fallback <head> tags of index.html (the routes manage title and meta tags from now
 * on), and renders the router inside the language and session (auth) providers.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { AuthProvider } from '@/auth'
import { applyDocumentLocale, detectLocale, LocaleProvider } from '@/i18n'
import { createAppRouter } from '@/router'
import './index.css'

const locale = detectLocale(window.location.pathname)
applyDocumentLocale(locale)
document.head.querySelectorAll('[data-static-head]').forEach((tag) => tag.remove())
const router = createAppRouter({ locale })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider locale={locale}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </LocaleProvider>
  </StrictMode>,
)
