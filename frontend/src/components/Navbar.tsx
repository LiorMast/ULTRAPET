/**
 * Navbar.tsx — The site header: logo, main menu, language switcher, login link and the
 * "Business Account" button. Rebuilt from legacy/src/components/Header.tsx (same look and behavior,
 * with real links, RTL-correct styling and accessible menus).
 *
 * - Fixed to the top of the window. On pages that open with a dark hero (`overlay`) it starts
 *   transparent with white text and turns solid white once the page scrolls 80px; on other pages it
 *   is solid from the start. It also gets slightly slimmer after scrolling.
 * - The menu comes from MAIN_NAV in src/config.ts; an item with `children` opens a dropdown (Products).
 * - From the xl breakpoint the full menu is shown; below it, <MobileMenu> (a drawer) takes over.
 */
import { Fragment, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, UserRound } from 'lucide-react'
import { cn } from 'cn'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Logo } from '@/components/Logo'
import { MobileMenu } from '@/components/MobileMenu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HEADER_CTA, HEADER_LOGIN, MAIN_NAV, type NavItem } from '@/config'
import { useI18n } from '@/i18n'

/** How far (px) the page must scroll before the header turns solid and slimmer (legacy value). */
const SCROLL_THRESHOLD = 80

/** Text style of the top-level menu entries (legacy look), plus their color for each header tone. */
const NAV_TEXT =
  'group relative whitespace-nowrap font-heading text-xs font-medium uppercase tracking-widest transition-colors duration-200 outline-none'
const NAV_TONE = {
  light: 'text-white/80 hover:text-white focus-visible:text-white data-[status=active]:text-white',
  dark: 'text-neutral-600 hover:text-brand-red focus-visible:text-brand-red data-[status=active]:text-brand-red',
}

/**
 * Tracks whether the page is scrolled past a threshold. It also checks once on mount, so a page that
 * is reloaded halfway down starts in the scrolled state (the legacy header missed this).
 * @param threshold - Scroll distance in pixels.
 * @returns true while window.scrollY is greater than the threshold.
 */
function useScrolled(threshold: number) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    /** Re-reads the scroll position. */
    const update = () => setScrolled(window.scrollY > threshold)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [threshold])
  return scrolled
}

/**
 * The site header.
 * @param props.items - Menu items; defaults to MAIN_NAV from src/config.ts.
 * @param props.overlay - true on pages that open with a dark full-bleed hero: the header starts
 *   transparent (white text) and turns solid after scrolling. false (default) = always solid.
 * @returns The fixed <header> element.
 */
export function Navbar({ items = MAIN_NAV, overlay = false }: { items?: NavItem[]; overlay?: boolean }) {
  const { t } = useI18n()
  const scrolled = useScrolled(SCROLL_THRESHOLD)
  const transparent = overlay && !scrolled
  const tone = transparent ? 'light' : 'dark'

  return (
    <header
      data-scrolled={scrolled}
      data-transparent={transparent}
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500',
        scrolled ? 'py-3' : 'py-5',
        transparent ? 'bg-transparent' : 'border-b border-neutral-150 bg-white/95 backdrop-blur-sm',
        scrolled && 'shadow-premium-sm',
      )}
    >
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-6 px-6 lg:px-10 xl:px-6 2xl:px-10">
        <Link
          to="/"
          aria-label={t.header.home}
          onClick={() => window.scrollTo({ top: 0 })}
          className="shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-4"
        >
          <Logo tone={tone} className={cn('transition-all duration-300', scrolled ? 'h-10' : 'h-9')} />
        </Link>

        <nav aria-label={t.header.mainMenu} className="hidden flex-1 items-center justify-center gap-4 xl:flex rtl:gap-7 2xl:gap-7">
          {items.map((item) => (
            <DesktopNavItem key={item.id} item={item} tone={tone} />
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <LanguageSwitcher variant="dropdown" tone={tone} />
          <Link
            {...HEADER_LOGIN.link}
            aria-label={HEADER_LOGIN.label(t)}
            title={HEADER_LOGIN.label(t)}
            className={cn(
              'p-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-red',
              tone === 'light' ? 'text-white/80 hover:text-white' : 'text-neutral-600 hover:text-brand-red',
            )}
          >
            <UserRound size={18} aria-hidden="true" />
          </Link>
          <Button asChild size="sm" className="ms-1">
            <Link {...HEADER_CTA.link}>{HEADER_CTA.label(t)}</Link>
          </Button>
        </div>

        <div className="flex items-center gap-1 xl:hidden">
          <LanguageSwitcher variant="toggle" tone={tone} />
          <MobileMenu items={items} tone={tone} />
        </div>
      </div>
    </header>
  )
}

/**
 * One top-level menu entry: a link, or — for an item with `children` — a dropdown (Products).
 * @param props.item - The menu item (see MAIN_NAV in src/config.ts).
 * @param props.tone - "light" while the header is transparent over the hero (white text), else "dark".
 * @returns The menu link or dropdown.
 */
function DesktopNavItem({ item, tone }: { item: NavItem; tone: 'dark' | 'light' }) {
  const { t } = useI18n()
  const textClass = cn(NAV_TEXT, NAV_TONE[tone])

  if (!('children' in item)) {
    return (
      <Link {...item.link} activeOptions={{ exact: true, includeHash: true }} className={textClass}>
        {item.label(t)}
        <Underline />
      </Link>
    )
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={cn(textClass, 'flex items-center gap-1.5')}>
        {item.label(t)}
        <ChevronDown size={11} aria-hidden="true" className="transition-transform duration-200 group-data-[state=open]:rotate-180" />
        <Underline />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={14}
        className="w-auto min-w-64 rounded-none border border-neutral-200 p-0 py-2 shadow-premium-sm ring-0"
      >
        {item.children.map((child) => {
          const Icon = child.icon
          const content = (
            <>
              {Icon && <Icon size={16} aria-hidden="true" className="text-brand-red" />}
              {child.label(t)}
            </>
          )
          return (
            <Fragment key={child.id}>
              {child.divider && <DropdownMenuSeparator className="mx-0 my-2" />}
              <DropdownMenuItem asChild className="gap-3 rounded-none px-5 py-2.5 font-heading text-sm font-medium text-neutral-700">
                {'href' in child ? (
                  <a href={child.href} target="_blank" rel="noopener noreferrer">
                    {content}
                  </a>
                ) : (
                  <Link {...child.link}>{content}</Link>
                )}
              </DropdownMenuItem>
            </Fragment>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The thin red underline of a menu entry: grows from the start side on hover or keyboard focus, and
 * stays visible on the active page and while a dropdown is open.
 * @returns A decorative <span>, hidden from screen readers.
 */
function Underline() {
  return (
    <span
      aria-hidden="true"
      className="absolute -bottom-1 start-0 h-px w-0 bg-brand-red transition-all duration-300 group-hover:w-full group-focus-visible:w-full group-data-[state=open]:w-full group-data-[status=active]:w-full"
    />
  )
}
