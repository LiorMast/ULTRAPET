/**
 * routes/admin.index.tsx — /admin itself has no page of its own: it opens the first data page (brands).
 * Signed out, that page shows the staff sign-in form (see admin.tsx).
 */
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/brands', replace: true })
  },
})
