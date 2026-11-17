/**
 * MobileMenu.tsx — The hamburger button and slide-in drawer that replace the desktop menu below the
 * xl breakpoint. Rebuilt from the mobile drawer in legacy/src/components/Header.tsx.
 *
 * Built on the shadcn Sheet (a Radix Dialog): it traps keyboard focus inside the drawer, closes on Esc
 * or a click on the backdrop, and stops the page behind it from scrolling. The drawer slides in from
 * the end side — right in English, left in Hebrew — next to the hamburger button in both cases — and can
 * be swiped back towards that edge to close it. Like the desktop menu, the current page or home-page section
 * (kept in the URL hash by the navbar's scrollspy) is shown in red. The Login entry becomes Log out when
 * signed in, and staff also get an Admin panel entry.
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, LogOut, Menu, ShieldCheck, UserRound, X } from 'lucide-react'
import { cn } from 'cn'
import { useAuth, useSignOut } from '@/auth'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { HEADER_ACCOUNT, HEADER_CTA, HEADER_LOGIN, type NavItem } from '@/config'
import { useI18n } from '@/i18n'

/** Style of the drawer's top-level entries: sentence-case rows whose grey background fades in on hover; the active page is light brand red. */
const ENTRY_CLASS =
  'block w-full rounded-lg px-3 py-3 text-start font-heading text-base font-medium text-neutral-800 transition-[color,background-color] duration-300 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-brand-red data-[status=active]:bg-brand-red-muted data-[status=active]:text-brand-red-dark'

/** Style of the entries inside the Products group. */
const SUB_ENTRY_CLASS =
  'flex items-center gap-3 rounded-lg px-3 py-2.5 font-heading text-sm text-neutral-600 transition-[color,background-color] duration-300 outline-none hover:bg-neutral-100 hover:text-brand-charcoal focus-visible:ring-2 focus-visible:ring-brand-red'

/**
 * The mobile menu: a hamburger button that opens the navigation drawer.
 * @param props.items - Menu items (the same list the desktop menu shows).
 * @returns The hamburger button together with its drawer.
 */
export function MobileMenu({ items }: { items: NavItem[] }) {
  const { t, isRtl } = useI18n()
  const { user } = useAuth()
  const handleSignOut = useSignOut()
  const [open, setOpen] = useState(false)
  /** Closes the drawer; every link calls it, so choosing a destination also closes the menu. */
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={t.header.openMenu}
        className={cn(
          'rounded-lg p-3 transition-colors outline-none hover:text-brand-red focus-visible:ring-2 focus-visible:ring-brand-red',
          'text-brand-charcoal',
        )}
      >
        <Menu size={32} aria-hidden="true" />
      </SheetTrigger>

      <SheetContent
        side={isRtl ? 'left' : 'right'}
        showCloseButton={false}
        onSwipeClose={close}
        aria-describedby={undefined}
        className="w-72 gap-0 border-0 bg-white p-0 sm:max-w-72"
      >
        <SheetHeader className="flex-row items-center justify-between border-b border-neutral-150 px-6 py-5">
          <SheetTitle className="sr-only">{t.header.mainMenu}</SheetTitle>
          <Link to="/" onClick={close} aria-label={t.header.home}>
            <Logo className="h-9" />
          </Link>
          <SheetClose
            aria-label={t.header.closeMenu}
            className="-me-2 flex size-9 items-center justify-center rounded-lg text-neutral-500 transition-[color,background-color,scale] duration-150 outline-none hover:bg-neutral-100 hover:text-brand-charcoal focus-visible:ring-2 focus-visible:ring-brand-red active:scale-[0.94] active:duration-100"
          >
            <X size={20} aria-hidden="true" />
          </SheetClose>
        </SheetHeader>

        <nav aria-label={t.header.mainMenu} className="flex-1 overflow-y-auto px-6 py-4">
          <ul className="-mx-3 space-y-0.5">
            {items.map((item) => (
              <li key={item.id}>
                {'children' in item ? (
                  <details className="group">
                    <summary className={cn(ENTRY_CLASS, 'flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden')}>
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
                  <Link {...item.link} activeOptions={{ exact: true, includeHash: true }} onClick={close} className={ENTRY_CLASS}>
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

        <div className="border-t border-neutral-100 px-6 py-4">
          <LanguageSwitcher variant="buttons" />
        </div>
        <div className="px-6 pb-8">
          <Button asChild className="w-full">
            <Link {...HEADER_CTA.link} onClick={close}>
              {HEADER_CTA.label(t)}
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
