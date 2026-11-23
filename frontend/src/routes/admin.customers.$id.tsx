/**
 * routes/admin.customers.$id.tsx — Staff panel: one business customer's profile (/admin/customers/<id>), opened from
 * the company name in the customers table or the account column of the account requests. Shows CustomerProfile in its
 * staff view (GET /api/staff/customers/<id>/profile): the details with the internal ones, whether the customer is
 * online, every own discount (paused ones too) and the purchase history. Read-only: the account and its discounts
 * are edited in the customers table. An unknown id is the not-found page; signed out, the admin layout shows the
 * sign-in form and nothing is loaded.
 */
import { createFileRoute } from '@tanstack/react-router'
import { fetchCustomerProfile, rethrowNotFound } from '@/api'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { CustomerProfile } from '@/components/CustomerProfile'
import { dictionaryFor, useI18n } from '@/i18n'

export const Route = createFileRoute('/admin/customers/$id')({
  loader: async ({ context, params, abortController }) =>
    context.staff ? await fetchCustomerProfile(params.id, abortController.signal).catch(rethrowNotFound) : null,
  head: ({ match, loaderData }) => {
    const t = dictionaryFor(match.context.locale)
    const name = loaderData?.customer.companyName ?? t.admin.profileTitle
    return { meta: [{ title: `${name} | ${t.admin.metaTitle}` }] }
  },
  component: AdminCustomerProfile,
})

/**
 * The customer's profile page: breadcrumbs back to the customers, the company name, the profile.
 * @returns The page, or nothing while signed out.
 */
function AdminCustomerProfile() {
  const profile = Route.useLoaderData()
  const { t } = useI18n()
  if (!profile) return null
  const { customer } = profile
  return (
    <section aria-labelledby="customer-title">
      <Breadcrumbs items={[{ label: t.admin.customersTitle, link: { to: '/admin/customers' } }, { label: customer.companyName }]} className="mb-6" />
      <p className="font-heading text-sm font-semibold text-brand-red-dark">{t.admin.profileTitle}</p>
      <h1 id="customer-title" className="mb-8 mt-1 font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">
        {customer.companyName}
      </h1>
      <CustomerProfile profile={profile} view="staff" />
    </section>
  )
}
