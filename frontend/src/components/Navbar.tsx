/**
 * Navbar.tsx — The site header: logo, main menu, language switcher, login link. Rebuilt from
 * legacy/src/components/Header.tsx (same look and behavior, with real links, RTL-correct styling and
 * accessible menus).
 *
 * - Fixed to the top of the window, always white with a hairline and a soft shadow (both drawn as
 *   box-shadows, so they add no height). It is exactly 88px tall so the logo reads clearly; pages
 *   offset their content by the same amount.
 * - The menu comes from MAIN_NAV in src/config.ts; an item with `children` opens a dropdown (Products).
 * - From the xl breakpoint the full menu is shown; below it, <MobileMenu> (a drawer) takes over.
 */
import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
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
import { MAIN_NAV, type NavItem } from '@/config'
import { useI18n } from '@/i18n'

/** Text style of the top-level menu entries (legacy look). */
const NAV_TEXT =
  'group relative whitespace-nowrap font-heading text-xs font-medium uppercase tracking-widest 2xl:text-sm min-[1920px]:text-base text-neutral-600 transition-colors duration-200 outline-none hover:text-brand-red focus-visible:text-brand-red data-[status=active]:text-brand-red'

/**
 * The site header.
 * @param props.items - Menu items; defaults to MAIN_NAV from src/config.ts.
 * @returns The fixed <header> element.
 */
export function Navbar({ items = MAIN_NAV }: { items?: NavItem[] }) {
  const { t } = useI18n()

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-white py-4 shadow-[0_1px_0_var(--color-neutral-150),var(--shadow-premium-sm)]">
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

/**
 * One top-level menu entry: a link, or — for an item with `children` — a dropdown (Products).
 * @param props.item - The menu item (see MAIN_NAV in src/config.ts).
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
      <DropdownMenuTrigger className={cn(NAV_TEXT, 'flex items-center gap-1.5')}>
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
