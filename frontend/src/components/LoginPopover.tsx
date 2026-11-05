/**
 * LoginPopover.tsx — The header's account buttons. Signed out: the login button and the popover it opens,
 * holding the login form (the same form customers and staff both use; the mobile drawer links to the /login
 * page instead). Signed in: the login button turns into a Log out button, and staff also get an Admin panel
 * button before it, which opens and closes the header's admin drawer (SubNavDrawer, wired by the Navbar through
 * `adminToggle`; without it the button is a plain link to /admin). Used by the desktop Navbar.
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '@/auth'
import { LoginForm } from '@/components/LoginForm'
import type { DrawerTriggerProps } from '@/components/SubNavDrawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { HEADER_LOGIN } from '@/config'
import { useI18n } from '@/i18n'

/** Style of the header's pill buttons (login popover trigger, admin panel link, log out). */
const PILL_CLASS =
  'inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-neutral-300 px-6 py-3 font-heading text-base font-semibold uppercase tracking-widest text-neutral-700 outline-none transition-[color,background-color,border-color,scale] duration-300 active:scale-[0.97] active:duration-100 hover:border-brand-red hover:bg-brand-red hover:text-white focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 data-[state=open]:border-brand-red data-[state=open]:bg-brand-red data-[state=open]:text-white'

/**
 * The header's account buttons: signed out = the login button with its popover (title, form and a link to
 * open an account); signed in = a Log out button, preceded by an Admin panel button for staff.
 * @param props.adminToggle - The admin drawer's toggle props (useSubNavDrawer().trigger): the Admin panel button
 *   then opens and closes the drawer. Without it, Admin panel is a link to /admin.
 * @returns The buttons (and, when open, the popover panel).
 */
export function LoginPopover({ adminToggle }: { adminToggle?: DrawerTriggerProps }) {
  const { t } = useI18n()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  if (user) {
    return (
      <>
        {user.kind === 'staff' &&
          (adminToggle ? (
            <button type="button" {...adminToggle} className={PILL_CLASS}>
              <ShieldCheck size={18} aria-hidden="true" />
              {t.nav.adminPanel}
              <ChevronDown size={16} aria-hidden="true" className="transition-transform duration-300 in-data-[state=open]:rotate-180" />
            </button>
          ) : (
            <Link to="/admin" className={PILL_CLASS}>
              <ShieldCheck size={18} aria-hidden="true" />
              {t.nav.adminPanel}
            </Link>
          ))}
        <button type="button" onClick={() => void signOut()} className={PILL_CLASS}>
          <LogOut size={18} aria-hidden="true" />
          {t.login.signOut}
        </button>
      </>
    )
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={PILL_CLASS}>
        <UserRound size={18} aria-hidden="true" />
        {HEADER_LOGIN.label(t)}
      </PopoverTrigger>
      <PopoverContent aria-label={t.login.title}>
        <h2 className="font-display text-xl font-bold text-brand-charcoal">{t.login.title}</h2>
        <p className="mb-5 mt-1 text-xs text-brand-charcoal-muted">{t.login.subtitle}</p>
        <LoginForm idPrefix="popover-login" />
        <p className="mt-5 border-t border-neutral-150 pt-4 text-xs text-brand-charcoal-muted">
          {t.login.noAccount}{' '}
          <Link to="/" hash="business" className="font-semibold text-brand-red-dark underline underline-offset-2">
            {t.login.openAccount}
          </Link>
        </p>
      </PopoverContent>
    </Popover>
  )
}
