/**
 * MobileMenu.tsx — The slide-in menu drawer that replaces the desktop menu below the xl breakpoint, opened by the
 * bottom tab bar's Menu tab (TabBar.tsx passes it as `trigger`). Rebuilt from the mobile drawer in
 * legacy/src/components/Header.tsx. Every row is at least 44px tall (top-level entries 48px).
 *
 * Built on the shadcn Sheet (a Radix Dialog): it traps keyboard focus inside the drawer, closes on Esc
 * or a click on the backdrop, and stops the page behind it from scrolling. The drawer slides in from
 * the end side — right in English, left in Hebrew — on the Menu tab's side in both cases — and can
 * be swiped back towards that edge to close it. Like the desktop menu, the current page or home-page section
 * (kept in the URL hash by the navbar's scrollspy) is shown in red, and so is an entry that stands for the
 * section being read (NavItem `sections`, data-in-view). The Login entry becomes Log out when
 * signed in, and staff also get an Admin panel entry.
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { ChevronDown, LogOut, ShieldCheck, UserRound, X } from 'lucide-react'
import { cn } from 'cn'
import { useAuth, useSignOut } from '@/auth'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Logo } from '@/components/Logo'
import { inViewProps, useInViewSection } from '@/components/NavText'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { HEADER_ACCOUNT, HEADER_CTA, HEADER_LOGIN, type NavItem } from '@/config'
import { useI18n } from '@/i18n'

/** Style of the drawer's top-level entries: sentence-case rows whose grey background fades in on hover; the active page (and the entry of the home section being read) is light brand red. */
const ENTRY_CLASS =
  'block w-full rounded-lg px-3 py-3 text-start font-heading text-base font-medium text-neutral-800 transition-[color,background-color] duration-300 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-brand-red data-[status=active]:bg-brand-red-muted data-[status=active]:text-brand-red-dark data-[in-view]:bg-brand-red-muted data-[in-view]:text-brand-red-dark'

/** Style of the entries inside the Products group. */
const SUB_ENTRY_CLASS =
  'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 font-heading text-sm text-neutral-600 transition-[color,background-color] duration-300 outline-none hover:bg-neutral-100 hover:text-brand-charcoal focus-visible:ring-2 focus-visible:ring-brand-red'

/**
 * The mobile menu: the navigation drawer and the trigger that opens it.
 * @param props.items - Menu items (the same list the desktop menu shows).
 * @param props.trigger - The <button> that opens it (the tab bar's Menu tab); it must spread the props it is given.
 * @returns The trigger together with its drawer.
 */
export function MobileMenu({ items, trigger }: { items: NavItem[]; trigger: ReactElement }) {
  const { t, isRtl } = useI18n()
  const { user } = useAuth()
  const handleSignOut = useSignOut()
  const [open, setOpen] = useState(false)
  const section = useInViewSection()
  /** Closes the drawer; every link calls it, so choosing a destination also closes the menu. */
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>

      <SheetContent
        side={isRtl ? 'left' : 'right'}
        showCloseButton={false}
        onSwipeClose={close}
        aria-describedby={undefined}
        className="w-[min(20rem,85vw)] gap-0 border-0 bg-white p-0 sm:max-w-80"
      >
        <SheetHeader className="flex-row items-center justify-between border-b border-neutral-150 px-6 py-4">
          <SheetTitle className="sr-only">{t.header.mainMenu}</SheetTitle>
          <Link to="/" onClick={close} aria-label={t.header.home} className="relative touch-target">
            <Logo className="h-9" />
          </Link>
          <SheetClose
            aria-label={t.header.closeMenu}
            className="-me-3 flex size-11 items-center justify-center rounded-lg text-neutral-500 transition-[color,background-color,scale] duration-150 outline-none hover:bg-neutral-100 hover:text-brand-charcoal focus-visible:ring-2 focus-visible:ring-brand-red active:scale-[0.94] active:duration-100"
          >
            <X size={20} aria-hidden="true" />
          </SheetClose>
        </SheetHeader>

        {/* One scrolling body (the menu, the languages, the business button): a short window (a phone in landscape)
            scrolls it all, a tall one keeps the languages and the button at the bottom. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <nav aria-label={t.header.mainMenu} className="px-6 py-4">
            <ul className="-mx-3 space-y-0.5">
              {items.map((item) => (
                <li key={item.id}>
                  {'children' in item ? (
                    <details className="group">
                      <summary {...inViewProps(item, section)} className={cn(ENTRY_CLASS, 'flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden')}>
                        {item.label(t)}
                        <ChevronDown size={16} aria-hidden="true" className="transition-transform duration-300 group-open:rotate-180" />
                      </summary>
                      <ul className="ps-3 pb-2">
                        {item.children.map((child) => {
                          const content = child.label(t)
                          return (
                            <li key={child.id}>
                              {'href' in child ? (
                                <a href={child.href} target="_blank" rel="noopener noreferrer" onClick={close} className={SUB_ENTRY_CLASS}>
                                  {content}
                                </a>
                              ) : (
                                <Link {...child.link} onClick={close} className={SUB_ENTRY_CLASS}>
                                  {content}
                                </Link>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </details>
                  ) : (
                    <Link {...item.link} {...inViewProps(item, section)} activeOptions={{ exact: true, includeHash: true }} onClick={close} className={ENTRY_CLASS}>
                      {item.label(t)}
                    </Link>
                  )}
                </li>
              ))}
              {user?.kind === 'business' && (
                <li>
                  <Link {...HEADER_ACCOUNT.link} onClick={close} className={cn(ENTRY_CLASS, 'flex items-center gap-2.5')}>
                    <UserRound size={18} aria-hidden="true" />
                    {HEADER_ACCOUNT.label(t)}
                  </Link>
                </li>
              )}
              {user?.kind === 'staff' && (
                <li>
                  <Link to="/admin" onClick={close} className={cn(ENTRY_CLASS, 'flex items-center gap-2.5')}>
                    <ShieldCheck size={18} aria-hidden="true" />
                    {t.nav.adminPanel}
                  </Link>
                </li>
              )}
              <li>
                {user ? (
                  <button
                    type="button"
                    onClick={() => {
                      close()
                      handleSignOut()
                    }}
                    className={cn(ENTRY_CLASS, 'flex items-center gap-2.5')}
                  >
                    <LogOut size={18} aria-hidden="true" />
                    {t.login.signOut}
                  </button>
                ) : (
                  <Link {...HEADER_LOGIN.link} onClick={close} className={cn(ENTRY_CLASS, 'flex items-center gap-2.5')}>
                    <UserRound size={18} aria-hidden="true" />
                    {HEADER_LOGIN.label(t)}
                  </Link>
                )}
              </li>
            </ul>
          </nav>

          <div className="mt-auto border-t border-neutral-100 px-6 py-4">
            <LanguageSwitcher variant="buttons" />
          </div>
          <div className="px-6 pb-6">
            <Button asChild className="w-full">
              <Link {...HEADER_CTA.link} onClick={close}>
                {HEADER_CTA.label(t)}
              </Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
