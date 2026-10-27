/**
 * seo.ts — The <head> tags that search engines and link previews read, built per page: <title>, meta
 * description, canonical URL, hreflang alternates for every served language, Open Graph / Twitter tags
 * and schema.org JSON-LD (structured data).
 *
 * Route files call pageHead() from their `head` option; <HeadContent /> in routes/__root.tsx renders
 * the tags, and the deepest route wins for the title and each meta name. The JSON-LD builders here are
 * shared by the article pages. sitemap.xml is written by the plugin in vite.config.ts.
 */
import type { JSX } from 'react'
import { DEFAULT_LOCALE, dictionaryFor, ENABLED_LOCALES, LOCALES, localizePath, type Locale } from '@/i18n'
import logoUrl from '@/assets/logo.svg'

/** Set by vite.config.ts (`define`), which also writes the sitemap with it. */
declare const __SITE_URL__: string

/** The public origin of the site, e.g. "https://www.ultrapet.co.il". */
export const SITE_URL = __SITE_URL__

/**
 * Makes a site path or an asset URL absolute, as canonical links, og:image and JSON-LD require.
 * @param path - E.g. "/en/articles" or "/assets/photo-1280.webp".
 * @returns The absolute URL on SITE_URL.
 */
export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).href
}

/** One JSON-LD object (schema.org). */
type JsonLd = Record<string, unknown>

/** The head tags of a page, in the shape a route's `head` option returns. */
export type PageHead = {
  meta: JSX.IntrinsicElements['meta'][]
  links: JSX.IntrinsicElements['link'][]
  scripts: JSX.IntrinsicElements['script'][]
}

/**
 * Builds the head tags of a page.
 * @param options.locale - The page language.
 * @param options.path - The page's internal (prefix-free) path, e.g. "/articles/living-with-a-cat".
 * @param options.title - The page title, without the site name; omit on the home page.
 * @param options.description - The meta description; defaults to the site description.
 * @param options.image - Path of the preview image (og:image), if the page has one.
 * @param options.type - Open Graph type: "website" (default) or "article".
 * @param options.jsonLd - Structured data objects to embed.
 * @returns `meta`, `links` and `scripts` (the JSON-LD) for a route's `head` option.
 */
export function pageHead({
  locale,
  path,
  title,
  description,
  image,
  type = 'website',
  jsonLd = [],
}: {
  locale: Locale
  path: string
  title?: string
  description?: string
  image?: string
  type?: 'website' | 'article'
  jsonLd?: JsonLd[]
}): PageHead {
  const t = dictionaryFor(locale)
  const fullTitle = title ? `${title} | ${t.seo.siteName}` : t.seo.defaultTitle
  const summary = description ?? t.seo.defaultDescription
  const url = absoluteUrl(localizePath(path, locale))
  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: summary },
      { property: 'og:site_name', content: t.seo.siteName },
      { property: 'og:title', content: title ?? t.seo.defaultTitle },
      { property: 'og:description', content: summary },
      { property: 'og:type', content: type },
      { property: 'og:url', content: url },
      { property: 'og:locale', content: LOCALES[locale].ogLocale },
      ...(image ? [{ property: 'og:image', content: absoluteUrl(image) }] : []),
      { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
    ],
    links: [
      { rel: 'canonical', href: url },
      ...ENABLED_LOCALES.map((l) => ({ rel: 'alternate', hrefLang: l, href: absoluteUrl(localizePath(path, l)) })),
      { rel: 'alternate', hrefLang: 'x-default', href: absoluteUrl(localizePath(path, DEFAULT_LOCALE)) },
    ],
    // "<" is escaped so no text can close the <script> element early.
    scripts: jsonLd.map((data) => ({ type: 'application/ld+json', children: JSON.stringify(data).replaceAll('<', '\\u003c') })),
  }
}

/**
 * The company as a schema.org Organization: the publisher of every article.
 * @param locale - The page language (for the name).
 * @returns The Organization object.
 */
export function organizationJsonLd(locale: Locale): JsonLd {
  return {
    '@type': 'Organization',
    name: dictionaryFor(locale).seo.siteName,
    url: absoluteUrl(localizePath('/', locale)),
    logo: absoluteUrl(logoUrl),
  }
}

/**
 * A schema.org BreadcrumbList, which lets search results show the page's place in the site.
 * @param locale - The page language (links get its prefix).
 * @param items - The trail from the home page to the current page: name and internal path.
 * @returns The BreadcrumbList object.
 */
export function breadcrumbJsonLd(locale: Locale, items: { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(localizePath(item.path, locale)),
    })),
  }
}
