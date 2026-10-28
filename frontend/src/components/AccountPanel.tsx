/**
 * AccountPanel.tsx — What a signed-in business customer sees instead of the login form: who is signed in,
 * a link to the catalog (where their prices show) and a sign-out button. Used by LoginPopover (header) and
 * the /login page.
 */
import { Link } from '@tanstack/react-router'
import { LayoutGrid, LogOut } from 'lucide-react'
import { useAuth, type User } from '@/auth'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

/**
 * The account panel.
 * @param props.user - The signed-in customer.
 * @param props.onNavigate - Called when the catalog link is followed (e.g. to close the popover).
 * @returns The panel.
 */
export function AccountPanel({ user, onNavigate }: { user: User; onNavigate?: () => void }) {
  const { t } = useI18n()
  const { signOut } = useAuth()
  return (
    <div className="space-y-4">
      <p role="status" className="text-sm text-brand-charcoal">
        {t.login.signedInAs}
        <bdi className="font-semibold">{user.email}</bdi>
      </p>
      <Button asChild className="w-full">
        <Link to="/catalog" onClick={onNavigate}>
          <LayoutGrid aria-hidden="true" />
          {t.login.toCatalog}
        </Link>
      </Button>
      <Button type="button" variant="outline" className="w-full" onClick={signOut}>
        <LogOut aria-hidden="true" />
        {t.login.signOut}
      </Button>
    </div>
  )
}
