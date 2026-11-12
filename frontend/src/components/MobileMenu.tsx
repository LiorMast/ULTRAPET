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
import { HEADER_CTA, HEADER_LOGIN, type NavItem } from '@/config'
import { useI18n } from '@/i18n'

/** Style of the drawer's top-level entries (legacy look). */
const ENTRY_CLASS =
  'block w-full py-3.5 text-start font-heading text-xs font-semibold uppercase tracking-widest text-neutral-700 transition-colors hover:text-brand-red data-[status=active]:text-brand-red'

/** Style of the entries inside the Products group. */
const SUB_ENTRY_CLASS =
  'flex items-center gap-3 py-2.5 ps-1 font-heading text-sm text-neutral-600 transition-colors hover:text-brand-red'

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
          'p-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-red',
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
        className="w-72 gap-0 border-0 bg-white p-0 shadow-2xl sm:max-w-72"
      >
        <SheetHeader className="flex-row items-center justify-between border-b border-neutral-150 px-6 py-5">
          <SheetTitle className="sr-only">{t.header.mainMenu}</SheetTitle>
          <Link to="/" onClick={close} aria-label={t.header.home}>
            <Logo className="h-9" />
          </Link>
          <SheetClose
            aria-label={t.header.closeMenu}
            className="p-1 text-neutral-500 transition-colors outline-none hover:text-brand-charcoal focus-visible:ring-2 focus-visible:ring-brand-red"
          >
            <X size={20} aria-hidden="true" />
          </SheetClose>
        </SheetHeader>

        <nav aria-label={t.header.mainMenu} className="flex-1 overflow-y-auto px-6 py-4">
          <ul className="divide-y divide-neutral-100">
            {items.map((item) => (
              <li key={item.id}>
                {'children' in item ? (
                  <details className="group">
                    <summary className={cn(ENTRY_CLASS, 'flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden')}>
                      {item.label(t)}
                      <ChevronDown size={14} aria-hidden="true" className="transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <ul className="pb-3">
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
            {user?.kind === 'staff' && (
              <li>
                <Link to="/admin" onClick={close} className={cn(ENTRY_CLASS, 'flex items-center gap-2')}>
                  <ShieldCheck size={14} aria-hidden="true" />
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
                  className={cn(ENTRY_CLASS, 'flex items-center gap-2')}
                >
                  <LogOut size={14} aria-hidden="true" />
                  {t.login.signOut}
                </button>
              ) : (
                <Link {...HEADER_LOGIN.link} onClick={close} className={cn(ENTRY_CLASS, 'flex items-center gap-2')}>
                  <UserRound size={14} aria-hidden="true" />
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
