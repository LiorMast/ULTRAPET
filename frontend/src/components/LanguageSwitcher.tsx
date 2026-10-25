/**
 * LanguageSwitcher.tsx — Lets visitors switch the site language. Rebuilt from the language menu in
 * legacy/src/components/Header.tsx.
 *
 * Every option is a plain link to the current page in the other language (/where-to-buy ↔
 * /en/where-to-buy, keeping the #hash), so switching is an ordinary page load and search engines can
 * follow the links. Languages that are registered but not enabled yet (Russian, Arabic) are shown as
 * "coming soon".
 *
 * Variants:
 *  - "dropdown": globe button + menu, for the desktop header (legacy look).
 *  - "buttons":  a row of language buttons, for the mobile drawer.
 *  - "toggle":   one compact link to the other language, for the mobile header bar.
 */
import { useId } from 'react'
import { useLocation } from '@tanstack/react-router'
import { ChevronDown, Globe } from 'lucide-react'
import { cn } from 'cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ALL_LOCALES, ENABLED_LOCALES, LOCALES, localizePath, useI18n, type Locale } from '@/i18n'

/** Languages listed as "coming soon" (registered in LOCALES but not enabled). */
const COMING_SOON_LOCALES = ALL_LOCALES.filter((locale) => !LOCALES[locale].enabled)

/**
 * Returns a function that builds the URL of the current page in another language.
 * @returns (locale) => browser URL, e.g. "/en/where-to-buy#map" or "/where-to-buy#map".
 */
function useLocaleHref() {
  const { pathname, searchStr, hash } = useLocation()
  return (locale: Locale) => localizePath(`${pathname}${searchStr}${hash ? `#${hash}` : ''}`, locale)
}

/**
 * The language switcher.
 * @param props.variant - "dropdown" (desktop header), "buttons" (mobile drawer) or "toggle" (mobile bar).
 * @param props.tone - "light" = white text for the transparent header over the dark hero; "dark" otherwise.
 *   Ignored by "buttons".
 * @returns The switcher for the chosen variant.
 */
export function LanguageSwitcher({
  variant,
  tone = 'dark',
}: {
  variant: 'dropdown' | 'buttons' | 'toggle'
  tone?: 'dark' | 'light'
}) {
  const { t, locale } = useI18n()
  const hrefFor = useLocaleHref()
  const labelId = useId()

  if (variant === 'toggle') {
    const other = ENABLED_LOCALES.find((l) => l !== locale) ?? locale
    return (
      <a
        href={hrefFor(other)}
        hrefLang={other}
        lang={other}
        aria-label={`${LOCALES[other].shortName} – ${LOCALES[other].nativeName}`}
        className={cn(
          'flex items-center gap-1.5 p-2 font-heading text-xs font-semibold transition-colors',
          tone === 'light' ? 'rounded-sm bg-white/10 text-white/80 hover:text-white' : 'text-neutral-600 hover:text-brand-red',
        )}
      >
        <Globe size={14} aria-hidden="true" />
        {LOCALES[other].shortName}
      </a>
    )
  }

  if (variant === 'buttons') {
    return (
      <div role="group" aria-labelledby={labelId}>
        <div
          id={labelId}
          className="mb-3 font-heading text-2xs font-bold uppercase tracking-widest text-brand-charcoal-muted"
        >
          {t.lang.switchLabel}
        </div>
        <div className="flex gap-2">
          {ENABLED_LOCALES.map((l) => (
            <a
              key={l}
              href={hrefFor(l)}
              hrefLang={l}
              lang={l}
              dir={LOCALES[l].dir}
              aria-current={l === locale ? 'true' : undefined}
              className={cn(
                'flex-1 border py-2.5 text-center font-heading text-xs font-semibold transition-all duration-200',
                l === locale
                  ? 'border-brand-red bg-brand-red text-white'
                  : 'border-neutral-200 text-neutral-600 hover:border-brand-red hover:text-brand-red',
              )}
            >
              {LOCALES[l].nativeName}
            </a>
          ))}
        </div>
      </div>
    )
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={cn(
          'group flex items-center gap-1.5 whitespace-nowrap px-3 py-2 font-heading text-xs font-semibold uppercase tracking-widest transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-red',
          tone === 'light' ? 'text-white/80 hover:text-white' : 'text-neutral-600 hover:text-brand-red',
        )}
      >
        <Globe size={13} aria-hidden="true" />
        {/* Accessible name = "Language: " + whichever label is visible (short below 2xl, full above),
            so it always contains the visible text (WCAG 2.5.3). */}
        <span className="sr-only">{`${t.lang.switchLabel}: `}</span>
        <span className="2xl:hidden">{LOCALES[locale].shortName}</span>
        <span className="hidden 2xl:inline">{LOCALES[locale].nativeName}</span>
        <ChevronDown size={10} aria-hidden="true" className="transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-auto min-w-44 rounded-none border border-neutral-200 p-0 py-1 shadow-premium-sm ring-0"
      >
        {ENABLED_LOCALES.map((l) => (
          <DropdownMenuItem key={l} asChild className="gap-3 rounded-none px-4 py-2.5 font-heading font-medium text-neutral-700">
            <a href={hrefFor(l)} hrefLang={l} lang={l} dir={LOCALES[l].dir} aria-current={l === locale ? 'true' : undefined}>
              <span
                aria-hidden="true"
                className={cn('size-1.5 shrink-0 rounded-full', l === locale ? 'bg-brand-red' : 'bg-neutral-300')}
              />
              <span className={cn(l === locale && 'text-brand-red')}>{LOCALES[l].nativeName}</span>
            </a>
          </DropdownMenuItem>
        ))}
        {COMING_SOON_LOCALES.length > 0 && <DropdownMenuSeparator className="mx-0" />}
        {COMING_SOON_LOCALES.map((l) => (
          <DropdownMenuItem key={l} disabled className="justify-between gap-6 rounded-none px-4 py-2.5 font-heading">
            <span lang={l} dir={LOCALES[l].dir}>
              {LOCALES[l].nativeName}
            </span>
            <span className="text-2xs font-bold uppercase tracking-wider">{t.lang.comingSoon}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
