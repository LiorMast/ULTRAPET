/**
 * LoginPopover.tsx — The header's login button and the popover it opens, holding the login form. Replaces
 * the plain login link in the desktop Navbar; the mobile drawer still links to the /login page, which shows
 * the same LoginForm.
 */
import { Link } from '@tanstack/react-router'
import { UserRound } from 'lucide-react'
import { LoginForm } from '@/components/LoginForm'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { HEADER_LOGIN } from '@/config'
import { useI18n } from '@/i18n'

/**
 * The login button with its popover (title, form, and a link to open an account).
 * @returns The trigger button and, when open, the popover panel.
 */
export function LoginPopover() {
  const { t } = useI18n()
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-neutral-300 px-6 py-3 font-heading text-base font-semibold uppercase tracking-widest text-neutral-700 outline-none transition-colors duration-300 hover:border-brand-red hover:bg-brand-red hover:text-white focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 data-[state=open]:border-brand-red data-[state=open]:bg-brand-red data-[state=open]:text-white">
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
