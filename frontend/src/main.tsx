/**
 * main.tsx — Browser entry point of the UltraPet site.
 * Reads the page language from the URL (/en/... = English, no prefix = Hebrew), applies it to <html>,
 * and renders the router inside the language provider.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { applyDocumentLocale, detectLocale, LocaleProvider } from '@/i18n'
import { createAppRouter } from '@/router'
import './index.css'

const locale = detectLocale(window.location.pathname)
applyDocumentLocale(locale)
const router = createAppRouter({ locale })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider locale={locale}>
      <RouterProvider router={router} />
    </LocaleProvider>
  </StrictMode>,
)
