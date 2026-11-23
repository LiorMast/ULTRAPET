/**
 * Navbar.tsx — The site header: logo, main menu, language switcher, login link. Rebuilt from
 * legacy/src/components/Header.tsx (same look and behavior, with real links, RTL-correct styling and
 * accessible menus).
 *
 * - Fixed to the top of the window: a white, translucent material (material-bar in index.css; content
 *   scrolling underneath shows through blurred) with a hairline and a soft shadow (both drawn as
 *   box-shadows, so they add no height). Mobile-first: below xl it is a slim 56px app bar (the logo and the
 *   language toggle; the bottom tab bar, TabBar.tsx, navigates); from xl it is 88px with the full menu, so the logo
 *   reads clearly. Pages offset their content by --header-h (index.css), which holds the same heights.
 * - The menu is built by mainNav() in src/config.ts (the Products dropdown lists the categories passed in); an item with `children` opens a dropdown (Products), on hover on desktop, and its label links to the full catalog.
 * - From the xl breakpoint the full menu is shown; below it, the tab bar's Menu tab opens <MobileMenu> (a drawer).
 * - Staff get an Admin panel button (in LoginPopover) that slides the admin drawer (<SubNavDrawer>, the
 *   pages of ADMIN_NAV) down out of the header and back up; the header grows with it, over the page.
 * - The header spans the full window: the logo sits at the start edge, the language switcher and login/logout
 *   at the end edge, and the menu in the middle.
 * - Signed-in business customers get a cart icon (<CartDrawer>) at the end edge, beside the language button (from
 *   xl; below it the cart is a tab of the tab bar).
 * - On the home page the menu is a scrollspy (useScrollSpy): the URL hash follows the section in view
 *   (history replace, no extra Back entries), so TanStack marks the matching #section link active, and an entry
 *   that stands for the section but links elsewhere (NavItem `sections`: Products ← #categories, Private Label ←
 *   #private-label, About ← #faq) gets data-in-view (inViewProps).
 */
import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link, useLocation, useRouter } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { CartDrawer } from '@/components/CartDrawer'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { LoginPopover } from '@/components/LoginPopover'
import { Logo } from '@/components/Logo'
import { inViewProps, NAV_TEXT, Underline, useInViewSection } from '@/components/NavText'
import { SubNavDrawer, useSubNavDrawer } from '@/components/SubNavDrawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ADMIN_NAV, mainNav, type NavItem } from '@/config'
import type { ProductCategory } from '@/api'
import { useAuth } from '@/auth'
import { useI18n } from '@/i18n'

/**
 * The fixed header bar: the translucent white material, 56px tall below xl (the 44px row + py-1.5) and 88px from xl
 * (py-4 + the 56px logo), plus the phone's top safe area; shared with HeaderSkeleton. --header-h holds these heights.
 */
export const HEADER_BAR_CLASS =
  'material-bar safe-x fixed inset-x-0 top-0 z-50 pt-[calc(0.375rem+env(safe-area-inset-top))] pb-1.5 shadow-[0_1px_0_var(--color-neutral-150),var(--shadow-premium-sm)] xl:pt-[calc(1rem+env(safe-area-inset-top))] xl:pb-4'

/** The header's row: logo at the start edge, the menu centered, the buttons at the end edge; shared with HeaderSkeleton. */
export const HEADER_ROW_CLASS = 'flex min-h-11 w-full items-center justify-between gap-1 px-gutter xl:gap-6 xl:px-6 2xl:px-10'

/** The header's logo: 32px tall in the slim bar (36px from sm), 56px from xl; shared with HeaderSkeleton. */
export const HEADER_LOGO_CLASS = 'h-8 sm:h-9 xl:h-14'

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
  const section = useInViewSection()
  const { user } = useAuth()
  const staff = user?.kind === 'staff' ? user : null
  const adminDrawer = useSubNavDrawer(staff ? staff.email : null)
  const mainNavRef = useRef<HTMLElement>(null)

  return (
    <header className={HEADER_BAR_CLASS}>
      <div className={HEADER_ROW_CLASS}>
        <Link
          to="/"
          aria-label={t.header.home}
          onClick={() => window.scrollTo({ top: 0 })}
          className="relative shrink-0 outline-none touch-target focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-4"
        >
          <Logo className={HEADER_LOGO_CLASS} />
        </Link>

        <nav ref={mainNavRef} aria-label={t.header.mainMenu} className="hidden flex-1 items-center justify-center gap-4 xl:flex rtl:gap-7 2xl:gap-7">
          {items.map((item) => (
            <DesktopNavItem key={item.id} item={item} section={section} />
          ))}
        </nav>

        {/* The end edge: from xl the cart icon, the language menu and login/logout; below xl the language toggle (the
            tab bar has the cart, the account and the menu). */}
        <div className="flex shrink-0 items-center gap-1 xl:gap-2">
          {user?.kind === 'business' && <CartDrawer className="hidden xl:block" />}

          <div className="hidden items-center gap-2 xl:flex">
            <LanguageSwitcher variant="dropdown" />
            <LoginPopover adminToggle={adminDrawer.trigger} />
          </div>

          <div className="xl:hidden">
            <LanguageSwitcher variant="toggle" />
          </div>
        </div>
      </div>

      {staff && <SubNavDrawer {...adminDrawer.drawer} items={ADMIN_NAV} label={t.nav.adminPanel} alignWith={mainNavRef} className="hidden xl:grid" />}
    </header>
  )
}

/**
 * The fixed header's current height in px (56 below xl, 88 from xl); a section counts as reached below it.
 * @returns The height of the page's <header>, or 88 before it renders.
 */
const headerHeight = () => document.querySelector('header')?.getBoundingClientRect().height ?? 88

/**
 * Makes the menu a scrollspy on the home page: while the visitor scrolls, the URL hash is replaced with
 * the id of the section being read (the last `<section id>` in <main> whose top has passed the header plus a
 * third of the window; the last one at the very bottom of the page; no hash on the first one, the hero, or above it).
 * The router location stays the single source of truth, so the menu's `includeHash` links light up by
 * themselves (and the entries with `sections`, through inViewProps). Runs once per animation frame at most, and navigates only when the section changes.
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
      const line = headerHeight() + window.innerHeight / 3
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

/** How long a dropdown stays open after the pointer leaves it, so the pointer can cross the gap (ms). */
const HOVER_CLOSE_MS = 150

/**
 * One top-level menu entry: a link, or — for an item with `children` — a dropdown (Products). On desktop the
 * dropdown opens on a mouse hover (touch and keyboard open it with a tap or ArrowDown), and activating its label
 * (click or Enter) goes to the dropdown's own link (the full catalog) and closes the menu.
 * @param props.item - The menu item (see mainNav in src/config.ts).
 * @param props.section - The home section being read (useInViewSection): lights the entry up when it is one of its `sections`.
 * @returns The menu link or dropdown.
 */
function DesktopNavItem({ item, section }: { item: NavItem; section: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  if (!('children' in item)) {
    return (
      <Link {...item.link} {...inViewProps(item, section)} activeOptions={{ exact: true, includeHash: true }} className={NAV_TEXT}>
        {item.label(t)}
        <Underline />
      </Link>
    )
  }

  /** Opens the dropdown now, cancelling a pending close. */
  const openMenu = () => {
    window.clearTimeout(closeTimer.current)
    setOpen(true)
  }

  /**
   * Closes the dropdown shortly, so the pointer can move from the label into the panel.
   * @returns Nothing.
   */
  const closeSoon = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_MS)
  }

  /**
   * Opens the dropdown on a mouse hover; touch and pen do not hover, so they only tap the link.
   * @param event - The pointer event on the label.
   * @returns Nothing.
   */
  const handleLabelEnter = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') openMenu()
  }

  /**
   * Closes the dropdown when the mouse leaves the label (the panel keeps it open while the pointer is in it).
   * @param event - The pointer event on the label.
   * @returns Nothing.
   */
  const handleLabelLeave = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') closeSoon()
  }

  /**
   * A click on the label goes to the full catalog (the link); the menu closes with it.
   * @returns Nothing.
   */
  const handleLabelClick = () => setOpen(false)

  /**
   * Enter follows the link, as a click does (Radix would otherwise use Enter to open the menu). ArrowDown and
   * Space keep opening the menu.
   * @param event - The key event on the label.
   * @returns Nothing.
   */
  const handleLabelKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.click()
    }
  }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Link
          {...item.link}
          {...inViewProps(item, section)}
          className={`${NAV_TEXT} flex items-center gap-1.5`}
          onPointerEnter={handleLabelEnter}
          onPointerLeave={handleLabelLeave}
          onClick={handleLabelClick}
          onKeyDown={handleLabelKey}
        >
          {item.label(t)}
          <ChevronDown size={15} aria-hidden="true" className={cn('transition-transform duration-200', open && 'rotate-180')} />
          <Underline />
        </Link>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={14}
        className="w-auto min-w-64"
        onPointerEnter={openMenu}
        onPointerLeave={handleLabelLeave}
      >
        {item.children.map((child) => {
          const content = child.label(t)
          return (
            <Fragment key={child.id}>
              {child.divider && <DropdownMenuSeparator className="mx-0 my-2" />}
              <DropdownMenuItem asChild className="gap-3 px-4 py-2.5 font-heading text-sm font-medium text-neutral-700">
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
