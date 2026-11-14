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
 *  - "dropdown": globe button + menu, for the desktop header (a pill whose grey background fades in on hover).
 *  - "buttons":  a row of pill language buttons, for the mobile drawer.
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
 * @returns The switcher for the chosen variant.
 */
export function LanguageSwitcher({ variant }: { variant: 'dropdown' | 'buttons' | 'toggle' }) {
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
        className="flex items-center gap-1.5 rounded-full p-3 font-heading text-nav-button font-semibold text-neutral-700 transition-[color,background-color] duration-300 outline-none hover:bg-neutral-100 hover:text-brand-charcoal focus-visible:ring-2 focus-visible:ring-brand-red"
      >
        <Globe size={22} aria-hidden="true" />
        {LOCALES[other].shortName}
      </a>
    )
  }

  if (variant === 'buttons') {
    return (
      <div role="group" aria-labelledby={labelId}>
        <div
          id={labelId}
          className="mb-3 font-heading text-sm font-semibold text-brand-charcoal"
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
                'flex-1 rounded-full border py-2.5 text-center font-heading text-sm font-semibold transition-[color,background-color,border-color] duration-300',
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
        className="group flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 font-heading text-nav-button font-medium text-neutral-700 transition-[color,background-color] duration-300 outline-none hover:bg-neutral-100 hover:text-brand-charcoal focus-visible:ring-2 focus-visible:ring-brand-red data-[state=open]:bg-neutral-100 data-[state=open]:text-brand-charcoal"
      >
        <Globe size={18} aria-hidden="true" />
        {/* Accessible name = "Language: " + whichever label is visible (short below 2xl, full above),
            so it always contains the visible text (WCAG 2.5.3). */}
        <span className="sr-only">{`${t.lang.switchLabel}: `}</span>
        <span className="2xl:hidden">{LOCALES[locale].shortName}</span>
        <span className="hidden 2xl:inline">{LOCALES[locale].nativeName}</span>
        <ChevronDown size={15} aria-hidden="true" className="transition-transform duration-300 group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-auto min-w-44"
      >
        {ENABLED_LOCALES.map((l) => (
          <DropdownMenuItem key={l} asChild className="gap-3 px-3.5 py-2.5 font-heading font-medium text-neutral-700">
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
          <DropdownMenuItem key={l} disabled className="justify-between gap-6 px-3.5 py-2.5 font-heading">
            <span lang={l} dir={LOCALES[l].dir}>
              {LOCALES[l].nativeName}
            </span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-2xs font-semibold">{t.lang.comingSoon}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
