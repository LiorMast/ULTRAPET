/**
 * customerColumns.tsx — The fields of a business customer's account as DataTable / RecordDialog columns: company,
 * contact person, sign-in email, password (write-only, generated or typed), phone, business number, city, address,
 * Rivhit number, internal notes and active. Shared by the customers table (/admin/customers, which adds its own
 * columns: discounts, last online) and the "Open account" dialog of the account requests (/admin/requests), so both
 * open accounts with the same form.
 */
import type { StaffCustomer } from '@/api'
import type { DataColumn } from '@/components/DataTable'
import type { Dictionary } from '@/i18n/he'

/** A customer as the account form edits it: the staff row, plus the write-only `password` that exists only in the form. */
export type CustomerFormRow = StaffCustomer & { password?: never }

/**
 * The account's columns, in form order.
 * @param t - The dictionary.
 * @param extras - The caller's own columns (table-only ones, e.g. discounts), placed before "Active".
 * @returns The columns.
 */
export function customerColumns<Row extends CustomerFormRow>(t: Dictionary, extras: DataColumn<Row>[] = []): DataColumn<Row>[] {
  const f = t.admin.customerFields
  return [
    { key: 'companyName', label: f.companyName, required: true },
    { key: 'fullName', label: f.fullName, required: true },
    { key: 'email', label: f.email, required: true, ltr: true },
    { key: 'password', label: f.password, type: 'password', required: true, hint: f.passwordHint },
    { key: 'phone', label: f.phone, ltr: true },
    { key: 'businessNumber', label: f.businessNumber, ltr: true, pattern: '[0-9]{9}', hint: f.businessNumberHint },
    { key: 'city', label: f.city },
    { key: 'address', label: f.address, inTable: false },
    { key: 'rivhitCustomerId', label: f.rivhitCustomerId, ltr: true, inTable: false },
    { key: 'notes', label: f.notes, multiline: true, inTable: false, hint: f.notesHint },
    ...extras,
    { key: 'isActive', label: f.isActive, type: 'boolean', hint: f.isActiveHint },
  ]
}
