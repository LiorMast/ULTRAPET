/**
 * RecordDialog.tsx — The add/edit form of DataTable: a dialog with one input per column, generated from the
 * table's column config (DataColumn), so every admin table gets its form for free.
 *
 * Each column type has its input (text or textarea, a Hebrew + English pair for localized text, number, money,
 * checkbox, select, colour, URL, date and time; a `searchable` select or text column gets a SearchableField; an
 * "image" column an upload-only ImageUploadField, which uploads the file at once and holds Save until it is stored; a
 * "password" column a GeneratedPasswordInput, never filled in: required only when adding, and left out of an edit
 * when it stays empty, so the password is kept). The form
 * checks required fields, patterns and numbers before sending; on an edit it sends only the fields that changed. When the server refuses the change, its error lands
 * on the field it names (`field`, or the column in a constraint name such as "brands_slug_key"), or above the
 * buttons when it names none. Used only by DataTable.
 */
import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '@/api'
import type { DataColumn, RowValues } from '@/components/DataTable'
import { GeneratedPasswordInput, MIN_PASSWORD_LENGTH } from '@/components/GeneratedPasswordInput'
import { ImageUploadField } from '@/components/ImageUploadField'
import { SearchableField } from '@/components/SearchableField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Dictionary } from '@/i18n/he'
import { useI18n } from '@/i18n'

/** A field's value while it is edited: text for most inputs, a pair for localized text, a flag for a checkbox. */
type FormValue = string | boolean | { he: string; en: string }

/** The admin forms' text input look (also used by DiscountDialog). */
export const INPUT_CLASS =
  'mt-2 block w-full border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-brand-charcoal transition-colors focus:border-brand-red focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40 disabled:cursor-not-allowed disabled:text-brand-charcoal-muted aria-[invalid=true]:border-brand-red'
/** The admin forms' field label look (also used by DiscountDialog). */
export const LABEL_CLASS = 'block font-heading text-2xs font-semibold uppercase tracking-widest text-brand-charcoal-muted'

/**
 * The message for a server error code.
 * @param code - The API error code (ApiError.code), e.g. "duplicate", or the form's own "too_short" (a password);
 *   undefined for a failed connection.
 * @param t - The dictionary.
 * @returns The translated message.
 */
export function errorMessage(code: string | undefined, t: Dictionary): string {
  switch (code) {
    case 'required':
      return t.admin.errors.required
    case 'invalid':
    case 'invalid_value':
      return t.admin.errors.invalid
    case 'duplicate':
      return t.admin.errors.duplicate
    case 'too_short':
      return t.admin.errors.passwordShort
    case 'in_use':
      return t.admin.errors.inUse
    case 'invalid_reference':
      return t.admin.errors.invalidReference
    default:
      return t.admin.errors.failed
  }
}

/**
 * Turns a stored value into what its input edits.
 * @param column - The column.
 * @param value - The row's value (null/undefined = empty).
 * @returns The input's value.
 */
function toForm<Row>(column: DataColumn<Row>, value: unknown): FormValue {
  if (column.type === 'boolean') return Boolean(value)
  if (column.type === 'localized') {
    const text = (value ?? {}) as Partial<Record<'he' | 'en', string>>
    return { he: text.he ?? '', en: text.en ?? '' }
  }
  // A stored password is never sent to the browser, and a new one starts empty.
  if (value === null || value === undefined || column.type === 'password') return ''
  if (column.type === 'datetime') {
    // <input type="datetime-local"> edits local time without a zone: "2026-11-03T09:30".
    const date = new Date(String(value))
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  }
  return String(value)
}

/**
 * Whether a field must be filled in: a required column, except a password on an edit (empty = keep it).
 * @param column - The column.
 * @param creating - True in the Add form.
 * @returns True when the form refuses it empty.
 */
const isRequired = <Row,>(column: DataColumn<Row>, creating: boolean) => Boolean(column.required) && (column.type !== 'password' || creating)

/**
 * Turns an input's value into the JSON the API takes, checking it on the way.
 * @param column - The column.
 * @param value - The input's value.
 * @param creating - True in the Add form (a password is then required when its column is).
 * @returns `{ value }` (null = empty), or `{ error }` naming what is wrong ("required", "invalid", or "too_short" for
 *   a password under MIN_PASSWORD_LENGTH characters).
 */
function fromForm<Row>(column: DataColumn<Row>, value: FormValue, creating: boolean): { value: unknown } | { error: 'required' | 'invalid' | 'too_short' } {
  if (column.type === 'boolean') return { value }
  if (column.type === 'password') {
    // Never trimmed: spaces are part of a password.
    const password = String(value)
    if (!password) return isRequired(column, creating) ? { error: 'required' } : { value: null }
    return password.length < MIN_PASSWORD_LENGTH ? { error: 'too_short' } : { value: password }
  }
  if (typeof value === 'object') {
    const he = value.he.trim()
    const en = value.en.trim()
    // The database keeps a translation only with its Hebrew text (the default language).
    if (!he) return en || column.required ? { error: 'required' } : { value: null }
    return { value: en ? { he, en } : { he } }
  }
  const text = String(value).trim()
  if (!text) return column.required ? { error: 'required' } : { value: null }
  if (column.pattern && !new RegExp(`^(?:${column.pattern})$`).test(text)) return { error: 'invalid' }
  switch (column.type) {
    case 'integer':
      return /^-?\d+$/.test(text) ? { value: Number(text) } : { error: 'invalid' }
    case 'number':
      return Number.isFinite(Number(text)) ? { value: Number(text) } : { error: 'invalid' }
    case 'money':
      return /^\d+(\.\d{1,2})?$/.test(text) ? { value: text } : { error: 'invalid' }
    case 'datetime':
      return Number.isNaN(Date.parse(text)) ? { error: 'invalid' } : { value: new Date(text).toISOString() }
    default:
      return { value: text }
  }
}

/**
 * Finds the column a refused change is about: the error's `field`, or the column named in its constraint
 * (Postgres default names: "<table>_<column>_key" for a duplicate, "<table>_<column>_check" for a failed check).
 * @param error - The API error.
 * @param columns - The form's columns.
 * @returns The column key, or undefined when the error names none of them.
 */
function errorField<Row>(error: ApiError, columns: DataColumn<Row>[]): string | undefined {
  if (error.field) return columns.some((column) => column.key === error.field) ? error.field : undefined
  const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  return columns.find((column) => error.constraint && /_(key|check|fkey)$/.test(error.constraint) && error.constraint.replace(/_(key|check|fkey)$/, '').endsWith(`_${snake(column.key)}`))?.key
}

/**
 * The add/edit form dialog.
 * @param props.columns - The table's columns; those with `inForm: false` are left out.
 * @param props.row - The row being edited; omit to add a new one.
 * @param props.initial - A new row's starting values (ignored when editing).
 * @param props.title - The dialog title.
 * @param props.onSave - Saves: a new row's non-empty values, or an edited row's changed fields; rejects with
 *   ApiError to show the server's error.
 * @param props.onClose - Closes without saving.
 * @param props.onCloseAutoFocus - Where the focus goes after closing (see DataTable).
 * @returns The dialog.
 */
export function RecordDialog<Row>({
  columns,
  row,
  initial,
  title,
  onSave,
  onClose,
  onCloseAutoFocus,
}: {
  columns: DataColumn<Row>[]
  row?: RowValues
  initial?: RowValues
  title: string
  onSave: (values: RowValues) => Promise<void>
  onClose: () => void
  onCloseAutoFocus: (event: Event) => void
}) {
  const { t } = useI18n()
  const id = useId()
  const fields = columns.filter((column) => column.inForm !== false)
  const [start] = useState(() => Object.fromEntries(fields.map((column) => [column.key, toForm(column, (row ?? initial ?? {})[column.key])])))
  const [values, setValues] = useState<Record<string, FormValue>>(start)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  // How many picture fields are uploading: Save waits for them (the field's value is the stored file's URL).
  const [uploads, setUploads] = useState(0)

  /**
   * Submit handler: checks every field, sends the new row or the changed fields, and shows the server's error.
   * @param event - The form submit event.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found: Record<string, string> = {}
    const payload: RowValues = {}
    for (const column of fields) {
      if (column.readOnly) continue
      const changed = JSON.stringify(values[column.key]) !== JSON.stringify(start[column.key])
      const result = fromForm(column, values[column.key], !row)
      if ('error' in result) found[column.key] = errorMessage(result.error, t)
      else if (row ? changed : result.value !== null) payload[column.key] = result.value
    }
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length > 0) {
      document.getElementById(`${id}-${Object.keys(found)[0]}`)?.focus()
      return
    }
    setPending(true)
    try {
      await onSave(payload)
    } catch (error) {
      const field = error instanceof ApiError ? errorField(error, fields) : undefined
      const message = errorMessage(error instanceof ApiError ? error.code : undefined, t)
      if (field) {
        setErrors({ [field]: message })
        document.getElementById(`${id}-${field}`)?.focus()
      } else setFormError(message)
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl" closeLabel={t.admin.close} onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t.admin.formHint}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
            {fields.map((column) => (
              <Field
                key={column.key}
                id={`${id}-${column.key}`}
                column={column}
                value={values[column.key]}
                error={errors[column.key]}
                creating={!row}
                onChange={(value) => setValues((current) => ({ ...current, [column.key]: value }))}
                onBusyChange={(busy) => setUploads((count) => count + (busy ? 1 : -1))}
              />
            ))}
          </div>
          {formError && (
            <p role="alert" className="px-6 pb-4 text-sm font-medium text-brand-red-dark">
              {formError}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t.admin.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={pending || uploads > 0}>
              {t.admin.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * One labelled input of the form, chosen by the column type, with its hint and error.
 * @param props.id - The input's id (a localized field adds "-he" / "-en"; the Hebrew input keeps the id itself).
 * @param props.column - The column.
 * @param props.value - The input's value.
 * @param props.error - The error message to show, if any.
 * @param props.creating - True in the Add form (a password is required only there, and its hint differs).
 * @param props.onChange - Called with the new value.
 * @param props.onBusyChange - An "image" field tells when an upload starts (true) and ends (false).
 * @returns The field.
 */
function Field<Row>({
  id,
  column,
  value,
  error,
  creating,
  onChange,
  onBusyChange,
}: {
  id: string
  column: DataColumn<Row>
  value: FormValue
  error?: string
  creating: boolean
  onChange: (value: FormValue) => void
  onBusyChange: (busy: boolean) => void
}) {
  const { t } = useI18n()
  const required = isRequired(column, creating)
  // An edited password field explains that empty keeps the password.
  const hint = column.type === 'password' && !creating ? t.admin.passwordKeep : column.hint
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const label = `${column.label}${required ? ' *' : ''}`
  const common = {
    disabled: column.readOnly,
    'aria-invalid': Boolean(error),
    'aria-describedby': described,
    'aria-required': required || undefined,
  }
  const footer = (
    <>
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-brand-charcoal-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs font-medium text-brand-red-dark">{error}</p>}
    </>
  )

  if (column.type === 'boolean') {
    return (
      <div>
        <label htmlFor={id} className="flex cursor-pointer items-center gap-3 text-sm text-brand-charcoal">
          <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-brand-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red" {...common} />
          {column.label}
        </label>
        {footer}
      </div>
    )
  }

  if (typeof value === 'object') {
    const Input = column.multiline ? 'textarea' : 'input'
    return (
      <fieldset>
        <legend className={LABEL_CLASS}>{label}</legend>
        {(['he', 'en'] as const).map((language) => (
          <label key={language} htmlFor={language === 'he' ? id : `${id}-${language}`} className="mt-2 block text-xs text-brand-charcoal-muted">
            {language === 'he' ? t.admin.languageHe : t.admin.languageEn}
            <Input
              id={language === 'he' ? id : `${id}-${language}`}
              dir={language === 'he' ? 'rtl' : 'ltr'}
              lang={language}
              rows={column.multiline ? 4 : undefined}
              value={value[language]}
              onChange={(e) => onChange({ ...value, [language]: e.target.value })}
              className={INPUT_CLASS}
              {...common}
              aria-invalid={Boolean(error) && (language === 'he' || !value.he.trim())}
            />
          </label>
        ))}
        {footer}
      </fieldset>
    )
  }

  const text = String(value)

  if (column.type === 'image' && column.folder) {
    return (
      <fieldset>
        <legend className={LABEL_CLASS}>{label}</legend>
        <ImageUploadField id={id} value={text} onChange={onChange} folder={column.folder} onBusyChange={onBusyChange} disabled={common.disabled} aria-invalid={common['aria-invalid']} aria-describedby={described} />
        {footer}
      </fieldset>
    )
  }

  let input
  if (column.type === 'password') {
    input = (
      <GeneratedPasswordInput
        id={id}
        autoComplete="new-password"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onGenerate={onChange}
        inputClassName={INPUT_CLASS}
        {...common}
      />
    )
  } else if (column.searchable) {
    input = (
      <SearchableField
        id={id}
        label={column.label}
        value={text}
        onChange={(next) => onChange(next)}
        options={column.options}
        strict={column.type === 'select'}
        dir={column.ltr ? 'ltr' : undefined}
        className="mt-2"
        inputClassName={INPUT_CLASS}
        {...common}
      />
    )
  } else if (column.type === 'select') {
    input = (
      <select id={id} value={text} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} {...common}>
        {!column.required && <option value="">—</option>}
        {column.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    )
  } else if (column.multiline) {
    input = <textarea id={id} rows={4} dir={column.ltr ? 'ltr' : 'auto'} value={text} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} {...common} />
  } else {
    const types: Partial<Record<string, string>> = { url: 'url', datetime: 'datetime-local', integer: 'number', number: 'number', money: 'number' }
    input = (
      <span className="flex items-end gap-2">
        {column.type === 'color' && (
          <input type="color" aria-hidden tabIndex={-1} value={/^#[0-9a-f]{6}$/i.test(text) ? text : '#be1e24'} onChange={(e) => onChange(e.target.value)} disabled={column.readOnly} className="h-11.5 w-12 shrink-0 cursor-pointer border border-neutral-300 bg-white p-1" />
        )}
        <input
          id={id}
          type={types[column.type ?? 'text'] ?? 'text'}
          inputMode={column.type === 'money' || column.type === 'number' ? 'decimal' : undefined}
          step={column.type === 'money' ? '0.01' : column.type === 'number' ? 'any' : undefined}
          dir={column.ltr || column.type === 'url' || column.type === 'color' ? 'ltr' : 'auto'}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLASS}
          {...common}
        />
      </span>
    )
  }
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>{label}</label>
      {input}
      {footer}
    </div>
  )
}
