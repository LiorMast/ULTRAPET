/**
 * LoginPopover.tsx — The header's login button and the popover it opens, holding the login form. Replaces
 * the plain login link in the desktop Navbar; the mobile drawer still links to the /login page, which shows
 * the same LoginForm. Once signed in, the button reads "My account" and the popover shows the AccountPanel
 * (who is signed in, the catalog link, sign out) instead of the form.
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { UserRound } from 'lucide-react'
import { useAuth } from '@/auth'
import { AccountPanel } from '@/components/AccountPanel'
import { LoginForm } from '@/components/LoginForm'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { HEADER_LOGIN } from '@/config'
import { useI18n } from '@/i18n'

/**
 * The login button with its popover: signed out = title, form and a link to open an account; signed in =
 * the account panel.
 * @returns The trigger button and, when open, the popover panel.
 */
export function LoginPopover() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-neutral-300 px-6 py-3 font-heading text-base font-semibold uppercase tracking-widest text-neutral-700 outline-none transition-colors duration-300 hover:border-brand-red hover:bg-brand-red hover:text-white focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 data-[state=open]:border-brand-red data-[state=open]:bg-brand-red data-[state=open]:text-white">
        <UserRound size={18} aria-hidden="true" />
        {user ? t.login.account : HEADER_LOGIN.label(t)}
      </PopoverTrigger>
      <PopoverContent aria-label={user ? t.login.account : t.login.title}>
        {user ? (
          <>
            <h2 className="mb-4 font-display text-xl font-bold text-brand-charcoal">{t.login.account}</h2>
            <AccountPanel user={user} onNavigate={() => setOpen(false)} />
          </>
        ) : (
          <>
            <h2 className="font-display text-xl font-bold text-brand-charcoal">{t.login.title}</h2>
            <p className="mb-5 mt-1 text-xs text-brand-charcoal-muted">{t.login.subtitle}</p>
            <LoginForm idPrefix="popover-login" />
            <p className="mt-5 border-t border-neutral-150 pt-4 text-xs text-brand-charcoal-muted">
              {t.login.noAccount}{' '}
              <Link to="/" hash="business" className="font-semibold text-brand-red-dark underline underline-offset-2">
                {t.login.openAccount}
              </Link>
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
