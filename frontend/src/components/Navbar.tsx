/**
 * Navbar.tsx — The site header: logo, main menu, language switcher, login link. Rebuilt from
 * legacy/src/components/Header.tsx (same look and behavior, with real links, RTL-correct styling and
 * accessible menus).
 *
 * - Fixed to the top of the window: a white, translucent material (material-bar in index.css; content
 *   scrolling underneath shows through blurred) with a hairline and a soft shadow (both drawn as
 *   box-shadows, so they add no height). It is exactly 88px tall so the logo reads clearly; pages
 *   offset their content by the same amount.
 * - The menu is built by mainNav() in src/config.ts (the Products dropdown lists the categories passed in); an item with `children` opens a dropdown (Products).
 * - From the xl breakpoint the full menu is shown; below it, <MobileMenu> (a drawer) takes over.
 * - On the home page the menu is a scrollspy (useScrollSpy): the URL hash follows the section in view
 *   (history replace, no extra Back entries), so TanStack marks the matching #section link active.
 */
import { Fragment, useEffect } from 'react'
import { Link, useLocation, useRouter } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { LoginPopover } from '@/components/LoginPopover'
import { Logo } from '@/components/Logo'
import { MobileMenu } from '@/components/MobileMenu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { mainNav, type NavItem } from '@/config'
import type { ProductCategory } from '@/api'
import { useI18n } from '@/i18n'

/**
 * Text style of the top-level menu entries (legacy look). Left-to-right (English) labels use 0.1em
 * letter-spacing instead of the 0.25em `tracking-widest`, so the seven entries fit on one line at every
 * desktop width (Hebrew has its own tight tracking).
 */
const NAV_TEXT =
  'group relative whitespace-nowrap font-heading text-xs font-medium uppercase tracking-widest ltr:tracking-[0.1em] 2xl:text-sm min-[1920px]:text-base text-neutral-600 transition-colors duration-200 outline-none hover:text-brand-red focus-visible:text-brand-red data-[status=active]:text-brand-red'

/**
 * The site header.
 * @param props.categories - The catalog categories for the Products dropdown (loaded by the root route).
 * @param props.items - Menu items; defaults to mainNav(categories) from src/config.ts.
 * @returns The fixed <header> element.
 */
export function Navbar({ categories = [], items }: { categories?: ProductCategory[]; items?: NavItem[] }) {
  const { t, locale } = useI18n()
  items ??= mainNav(categories, locale)
  useScrollSpy()

  return (
    <header className="material-bar fixed inset-x-0 top-0 z-50 py-4 shadow-[0_1px_0_var(--color-neutral-150),var(--shadow-premium-sm)]">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-6 px-6 lg:px-10 xl:px-6 2xl:px-10">
        <Link
          to="/"
          aria-label={t.header.home}
          onClick={() => window.scrollTo({ top: 0 })}
          className="shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-4"
        >
          <Logo className="h-14" />
        </Link>

        <nav aria-label={t.header.mainMenu} className="hidden flex-1 items-center justify-center gap-4 xl:flex rtl:gap-7 2xl:gap-7">
          {items.map((item) => (
            <DesktopNavItem key={item.id} item={item} />
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <LanguageSwitcher variant="dropdown" />
          <LoginPopover />
        </div>

        <div className="flex items-center gap-1 xl:hidden">
          <LanguageSwitcher variant="toggle" />
          <MobileMenu items={items} />
        </div>
      </div>
    </header>
  )
}

/** Height of the fixed header in px (py-4 + the 56px logo); a section counts as reached below it. */
const HEADER_HEIGHT = 88

/**
 * Makes the menu a scrollspy on the home page: while the visitor scrolls, the URL hash is replaced with
 * the id of the section being read (the last `<section id>` in <main> whose top has passed the header plus a
 * third of the window; the last one at the very bottom of the page; no hash on the first one, the hero, or above it).
 * The router location stays the single source of truth, so the menu's `includeHash` links light up by
 * themselves. Runs once per animation frame at most, and navigates only when the section changes.
 */
function useScrollSpy() {
  const router = useRouter()
  const pathname = useLocation({ select: (location) => location.pathname })

  useEffect(() => {
    if (pathname !== '/') return
    let frame = 0

    /** Finds the section in view and, when it changed, replaces the URL hash with its id. */
    const update = () => {
      frame = 0
      const line = HEADER_HEIGHT + window.innerHeight / 3
      const atBottom =
        window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      let current = ''
      let currentTop = -Infinity
      document.querySelectorAll<HTMLElement>('#main section[id]').forEach((section, i) => {
        const top = section.getBoundingClientRect().top
        if ((atBottom || top <= line) && top > currentTop) {
          // The first section (the hero) is the top of the page: no hash.
          current = i === 0 ? '' : section.id
          currentTop = top
        }
      })
      if (current === router.state.location.hash) return
      void router.navigate({
        to: '/',
        hash: current || undefined,
        replace: true,
        resetScroll: false,
        hashScrollIntoView: false,
      })
    }

    /** Schedules one update for the next frame (scroll events can fire many times per frame). */
    const onScroll = () => {
      frame ||= requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [pathname, router])
}

/**
 * One top-level menu entry: a link, or — for an item with `children` — a dropdown (Products).
 * @param props.item - The menu item (see mainNav in src/config.ts).
 * @returns The menu link or dropdown.
 */
function DesktopNavItem({ item }: { item: NavItem }) {
  const { t } = useI18n()

  if (!('children' in item)) {
    return (
      <Link {...item.link} activeOptions={{ exact: true, includeHash: true }} className={NAV_TEXT}>
        {item.label(t)}
        <Underline />
      </Link>
    )
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={cn(NAV_TEXT, 'flex items-center gap-1.5')}
      >
        {item.label(t)}
        <ChevronDown size={15} aria-hidden="true" className="transition-transform duration-200 group-data-[state=open]:rotate-180" />
        <Underline />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={14}
        className="w-auto min-w-64 rounded-none border border-neutral-200 p-0 py-2 shadow-premium-sm ring-0"
      >
        {item.children.map((child) => {
          const content = child.label(t)
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
 * The thin red underline of a menu entry: grows from the start side on hover or keyboard focus (a scale,
 * so it animates on the compositor), and
 * stays visible on the active page and while a dropdown is open.
 * @returns A decorative <span>, hidden from screen readers.
 */
function Underline() {
  return (
    <span
      aria-hidden="true"
      className="absolute -bottom-1 start-0 h-px w-full origin-left scale-x-0 bg-brand-red transition-transform duration-300 group-hover:scale-x-100 group-focus-visible:scale-x-100 group-data-[state=open]:scale-x-100 group-data-[status=active]:scale-x-100 rtl:origin-right"
    />
  )
}
