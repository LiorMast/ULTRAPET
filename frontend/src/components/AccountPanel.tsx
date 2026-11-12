/**
 * AccountPanel.tsx — What a signed-in user sees instead of the login form: who is signed in, a link to the
 * catalog (where a customer's prices show), for staff a link to the admin panel, and a sign-out button. Used by
 * the /login page.
 */
import { Link } from '@tanstack/react-router'
import { LayoutGrid, LogOut, ShieldCheck } from 'lucide-react'
import type { User } from '@/api'
import { useSignOut } from '@/auth'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

/**
 * The account panel.
 * @param props.user - The signed-in customer or staff member.
 * @returns The panel.
 */
export function AccountPanel({ user }: { user: User }) {
  const { t } = useI18n()
  const handleSignOut = useSignOut()
  return (
    <div className="space-y-4">
      <p role="status" className="text-sm text-brand-charcoal">
        {t.login.signedInAs}
        <bdi className="font-semibold">{user.email}</bdi>
      </p>
      <Button asChild className="w-full">
        <Link to="/catalog">
          <LayoutGrid aria-hidden="true" />
          {t.login.toCatalog}
        </Link>
      </Button>
      {user.kind === 'staff' && (
        <Button asChild variant="outline" className="w-full">
          <Link to="/admin">
            <ShieldCheck aria-hidden="true" />
            {t.nav.adminPanel}
          </Link>
        </Button>
      )}
      <Button type="button" variant="outline" className="w-full" onClick={handleSignOut}>
        <LogOut aria-hidden="true" />
        {t.login.signOut}
      </Button>
    </div>
  )
}
