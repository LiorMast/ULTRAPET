/**
 * routes/admin.requests.tsx — Staff panel: the requests for a business account (/admin/requests), sent with the home
 * page's registration form (customers cannot register themselves; every new request is also emailed to staff).
 *
 * A DataTable of the staff API's "leads" (backend/app/staff/routes.py), newest first: what the business sent
 * (read-only), its follow-up status (new / contacted / converted / rejected, as a ribbon) and staff notes, which Edit
 * changes; Delete removes spam; there is no Add. "Open account" (on a request not converted yet) opens the customer
 * form (customerColumns.tsx, the same as /admin/customers) prefilled from the request: saving creates the customer and
 * marks the request converted and linked to it (convertLead, one transaction); the Account column then links to the
 * customer's profile. The description counts the new requests. Loads nothing when signed out (the layout shows the
 * sign-in form instead).
 */
import { useMemo } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { UserPlus } from 'lucide-react'
import { convertLead, deleteStaffRow, fetchStaffRows, updateStaffRow, type LeadStatus, type StaffLead } from '@/api'
import { customerColumns, type CustomerFormRow } from '@/components/customerColumns'
import { DataTable, type DataColumn, type RowAction } from '@/components/DataTable'
import { DiscountRibbon, type RibbonColor } from '@/components/DiscountRibbon'
import { RecordDialog } from '@/components/RecordDialog'
import { dictionaryFor, useI18n } from '@/i18n'
import { useToast } from '@/toast'

export const Route = createFileRoute('/admin/requests')({
  loader: async ({ context, abortController }) => (context.staff ? fetchStaffRows<StaffLead>('leads', abortController.signal) : []),
  head: ({ match }) => {
    const t = dictionaryFor(match.context.locale)
    return { meta: [{ title: `${t.admin.requestsTitle} | ${t.admin.metaTitle}` }] }
  },
  component: AdminRequests,
})

/** The follow-up states, in workflow order. */
const STATUSES: LeadStatus[] = ['new', 'contacted', 'converted', 'rejected']

/** The ribbon color of each state: new requests stand out in brand red. */
const STATUS_COLORS: Record<LeadStatus, RibbonColor> = { new: 'red', contacted: 'warning', converted: 'success', rejected: 'charcoal' }

/**
 * The requests page: its title, the count of new requests and the table.
 * @returns The page.
 */
function AdminRequests() {
  const leads = Route.useLoaderData()
  const { t, locale } = useI18n()
  const router = useRouter()
  const toast = useToast()
  const f = t.admin.leadFields
  const fresh = leads.filter((lead) => lead.status === 'new').length

  const columns = useMemo<DataColumn<StaffLead>[]>(
    () => [
      {
        key: 'createdAt',
        label: f.createdAt,
        type: 'datetime',
        inForm: false,
        render: (row) => new Date(row.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }),
      },
      { key: 'companyName', label: f.companyName, readOnly: true },
      { key: 'contactPerson', label: f.contactPerson, readOnly: true },
      { key: 'phone', label: f.phone, ltr: true, readOnly: true },
      { key: 'email', label: f.email, ltr: true, readOnly: true },
      { key: 'city', label: f.city, readOnly: true },
      { key: 'message', label: f.message, multiline: true, inTable: false, readOnly: true },
      { key: 'locale', label: f.locale, inForm: false, render: (row) => (row.locale === 'en' ? t.admin.languageEn : t.admin.languageHe) },
      {
        key: 'status',
        label: f.status,
        type: 'select',
        required: true,
        options: STATUSES.map((status) => ({ value: status, label: t.admin.leadStatus[status] })),
        render: (row) => <DiscountRibbon message={t.admin.leadStatus[row.status]} color={STATUS_COLORS[row.status]} />,
      },
      { key: 'notes', label: f.notes, multiline: true, inTable: false, hint: f.notesHint },
      {
        key: 'businessUserId',
        label: f.account,
        inForm: false,
        render: (row) =>
          row.businessUserId ? (
            <Link
              to="/admin/customers/$id"
              params={{ id: row.businessUserId }}
              className="relative font-semibold text-brand-charcoal underline decoration-brand-red/40 underline-offset-4 touch-target transition-colors duration-300 hover:text-brand-red-dark hover:decoration-brand-red-dark"
            >
              {row.companyName}
            </Link>
          ) : (
            '—'
          ),
      },
    ],
    [f, t, locale],
  )

  const accountColumns = useMemo(() => customerColumns<CustomerFormRow>(t), [t])

  const openAccount: RowAction<StaffLead> = {
    name: 'open-account',
    label: t.admin.openAccount,
    rowLabel: (name) => t.admin.openAccountRow.replace('{name}', name),
    icon: <UserPlus aria-hidden />,
    available: (row) => row.status !== 'converted' && row.businessUserId === null,
    dialog: (row, { onClose, onCloseAutoFocus }) => (
      <RecordDialog<CustomerFormRow>
        columns={accountColumns}
        initial={{ companyName: row.companyName, fullName: row.contactPerson, email: row.email, phone: row.phone, city: row.city, isActive: true }}
        title={t.admin.openAccountTitle.replace('{name}', row.companyName)}
        onSave={async (values) => {
          await convertLead(row.id, values)
          toast.success(t.admin.accountOpened)
          await router.invalidate()
          onClose()
        }}
        onClose={onClose}
        onCloseAutoFocus={onCloseAutoFocus}
      />
    ),
  }

  return (
    <section>
      <h1 className="font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">{t.admin.requestsTitle}</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-charcoal-muted">{t.admin.requestsDescription}</p>
      <p role="status" className="mb-8 mt-3 text-sm font-semibold text-brand-charcoal">
        {fresh > 0 ? t.admin.requestsNew.replace('{count}', fresh.toLocaleString(locale)) : t.admin.requestsNone}
      </p>
      <DataTable
        rows={leads}
        columns={columns}
        caption={t.admin.requestsTitle}
        rowKey={(lead) => lead.id}
        rowLabel={(lead) => lead.companyName}
        onUpdate={async (id, changes) => {
          await updateStaffRow('leads', id, changes)
          await router.invalidate()
        }}
        onDelete={async (id) => {
          await deleteStaffRow('leads', id)
          await router.invalidate()
        }}
        rowActions={[openAccount]}
      />
    </section>
  )
}

