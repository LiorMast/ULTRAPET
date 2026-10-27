/**
 * i18n/index.tsx — Languages, language-aware URLs and translated strings for the whole site.
 *
 * - LOCALES lists every language the site knows. Hebrew is the default (right-to-left), English is
 *   left-to-right. Russian and Arabic are registered but disabled ("coming soon") until their
 *   dictionaries exist — enabling one means adding its dictionary and flipping `enabled`.
 * - URLs: Hebrew pages have no prefix (/where-to-buy), other languages do (/en/where-to-buy).
 *   src/router.ts calls localizePath / delocalizePath so the route files themselves stay prefix-free.
 * - A page load has one fixed language (switching language is a normal link to the other URL), so
 *   LocaleProvider simply hands that language to every component through useI18n().
 */
import { createContext, useContext, type ReactNode } from 'react'
import { Direction } from 'radix-ui'
import { en } from './en'
import { he, type Dictionary } from './he'

export type Locale = 'he' | 'en' | 'ru' | 'ar'

interface LocaleInfo {
  /** The language's own name, shown in the language switcher. */
  nativeName: string
  /** Short label for the compact mobile switcher. */
  shortName: string
  dir: 'rtl' | 'ltr'
  /** Open Graph locale (language_TERRITORY) for link previews, e.g. "he_IL". */
  ogLocale: string
  /** false = shown as "coming soon" in the switcher and its URLs are not served. */
  enabled: boolean
}

export const LOCALES: Record<Locale, LocaleInfo> = {
  he: { nativeName: 'עברית', shortName: 'עב', dir: 'rtl', ogLocale: 'he_IL', enabled: true },
  en: { nativeName: 'English', shortName: 'EN', dir: 'ltr', ogLocale: 'en_US', enabled: true },
  ru: { nativeName: 'Русский', shortName: 'RU', dir: 'ltr', ogLocale: 'ru_RU', enabled: false },
  ar: { nativeName: 'العربية', shortName: 'ع', dir: 'rtl', ogLocale: 'ar_AR', enabled: false },
}

export const DEFAULT_LOCALE: Locale = 'he'

/** Every registered locale, in display order. */
export const ALL_LOCALES = Object.keys(LOCALES) as Locale[]

/** The locales whose pages are served. */
export const ENABLED_LOCALES = ALL_LOCALES.filter((locale) => LOCALES[locale].enabled)

const DICTIONARIES: Partial<Record<Locale, Dictionary>> = { he, en }

/**
 * The translated strings of a language, for code outside components (e.g. a route's `head` option),
 * where the useI18n hook is not available.
 * @param locale - The language.
 * @returns Its dictionary, or the Hebrew one while the language has none yet.
 */
export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? he
}

/**
 * Tells whether a URL path segment is a language prefix that the site serves.
 * @param segment - The first segment of a path, e.g. "en" for "/en/about".
 * @returns true for enabled locales other than the default (the default locale has no prefix).
 */
function isPrefixLocale(segment: string | undefined): segment is Locale {
  return segment !== DEFAULT_LOCALE && ENABLED_LOCALES.includes(segment as Locale)
}

/**
 * Finds the language of a browser URL path.
 * @param pathname - The browser path, e.g. "/en/where-to-buy" or "/where-to-buy".
 * @returns The locale named by the path prefix, or DEFAULT_LOCALE when the path has no prefix.
 */
export function detectLocale(pathname: string): Locale {
  const first = pathname.split('/')[1]
  return isPrefixLocale(first) ? first : DEFAULT_LOCALE
}

/**
 * Adds the language prefix to an internal (prefix-free) path.
 * @param path - Internal path, optionally with ?search and #hash, e.g. "/where-to-buy" or "/#brands".
 * @param locale - The language the link should open in.
 * @returns The browser path: "/en/where-to-buy" or "/en#brands" for English; unchanged for Hebrew.
 */
export function localizePath(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return path
  const isHome = path === '/' || path.startsWith('/#') || path.startsWith('/?')
  return isHome ? `/${locale}${path.slice(1)}` : `/${locale}${path}`
}

/**
 * Removes the language prefix from a browser path — the inverse of localizePath.
 * Only served locales are stripped, so "/ru/..." (disabled) or "/xx/..." stay as they are and 404.
 * @param pathname - The browser path without search or hash, e.g. "/en/where-to-buy".
 * @returns The internal path the routes are defined with, e.g. "/where-to-buy".
 */
export function delocalizePath(pathname: string): string {
  const first = pathname.split('/')[1]
  if (!isPrefixLocale(first)) return pathname
  return pathname.slice(first.length + 1) || '/'
}

/**
 * Sets <html lang> and <html dir> for the page's language. That drives text direction, the
 * Hebrew font rules in index.css (html:lang(he)) and screen-reader pronunciation.
 * @param locale - The language of this page load.
 */
export function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = locale
  document.documentElement.dir = LOCALES[locale].dir
}

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

/**
 * Makes the page's language available to every component, and tells Radix UI (dropdowns, the
 * mobile drawer) which text direction to use for keyboard navigation and positioning.
 * @param props.locale - The language of this page load (see detectLocale).
 * @param props.children - The app.
 * @returns The provider wrapping the children.
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <LocaleContext.Provider value={locale}>
      <Direction.Provider dir={LOCALES[locale].dir}>{children}</Direction.Provider>
    </LocaleContext.Provider>
  )
}

/**
 * Gives a component the current language and its translated strings.
 * @returns `locale`, its text direction `dir` ('rtl' | 'ltr'), `isRtl`, and `t` — the dictionary.
 */
export function useI18n() {
  const locale = useContext(LocaleContext)
  const { dir } = LOCALES[locale]
  return { locale, dir, isRtl: dir === 'rtl', t: dictionaryFor(locale) }
}
