/**
 * DataTable.tsx — The reusable data table of the admin panel: lists the rows of any database table (search,
 * sorting, paging) and, when given the handlers, lets staff add, edit and delete them.
 *
 * Built on DataTables (datatables.net-react, the free core: no jQuery in v3). The caller describes the columns
 * once (DataColumn: key, label, type, required, ...); the same config drives the table cells, what search and
 * sorting see, and the edit form (RecordDialog). Editing is our own Radix dialog, not the paid DataTables
 * Editor. Each handler left out hides its action, so a table with none is read-only. Used by the /admin pages
 * (e.g. routes/admin.brands.tsx), one column config per resource.
 *
 * How it talks to DataTables: the options, columns and cell renderers are read once, when the table mounts
 * (the library's rule), so the renderers read the latest props through a ref; new `rows` redraw the table
 * keeping its search, sort and page. Cells are React (slots rendered through portals) for display, and plain
 * text for DataTables' sorting and search. Changing `columns` after mount needs a remount (a new `key`).
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import DataTableLib, { type DataTableSlots } from 'datatables.net-react'
import DT, { type ColumnOptions, type Options } from 'datatables.net-dt'
import 'datatables.net-dt/css/dataTables.dataTables.css'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { ApiError } from '@/api'
import { localized, type Localized } from '@/config'
import { RecordDialog, errorMessage } from '@/components/RecordDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n, type Locale } from '@/i18n'

// Tells the React component which DataTables build to use (the default-styled one). Called through a variable
// because the method is named `use`, which the linter would take for React's `use` hook.
const registerLibrary = DataTableLib.use
registerLibrary(DT)

/**
 * How a column's value is shown and edited: plain or multiline `text`, `localized` text ({ he, en }),
 * `integer`, `number` (decimal), `money` (shekels), `boolean`, `select` (one of `options`), `color` ('#RRGGBB'),
 * `url` or `datetime` (an ISO timestamp).
 */
export type FieldType = 'text' | 'localized' | 'integer' | 'number' | 'money' | 'boolean' | 'select' | 'color' | 'url' | 'datetime'

/**
 * One column of a DataTable and one field of its edit form.
 * - `key`: the row property (the staff API's camelCase JSON key, e.g. "sortOrder").
 * - `type`: see FieldType; default "text". `multiline`: a text or localized field edited in a textarea.
 * - `options`: the choices of a "select" column.
 * - `required`: the form refuses an empty value. `pattern` / `hint`: input pattern (regex) and help text.
 * - `ltr`: left-to-right content in any language (slugs, URLs, codes).
 * - `readOnly`: shown in the form but not editable. `inTable` / `inForm`: false hides it there (default true).
 * - `render`: overrides the cell (the form still uses `type`).
 */
export type DataColumn<Row> = {
  key: keyof Row & string
  label: string
  type?: FieldType
  multiline?: boolean
  options?: { value: string; label: string }[]
  required?: boolean
  pattern?: string
  hint?: string
  ltr?: boolean
  readOnly?: boolean
  inTable?: boolean
  inForm?: boolean
  render?: (row: Row) => ReactNode
}

/** A row's values by column key, as the form edits them and the handlers receive them. */
export type RowValues = Record<string, unknown>

/** The props of DataTable (see the component). */
export type DataTableProps<Row> = {
  rows: Row[]
  columns: DataColumn<Row>[]
  caption: string
  rowKey: (row: Row) => string
  rowLabel: (row: Row) => string
  newRow?: RowValues
  pageLength?: number
  onCreate?: (values: RowValues) => Promise<unknown>
  onUpdate?: (key: string, changes: RowValues) => Promise<unknown>
  onDelete?: (key: string) => Promise<unknown>
}

/** What is open: the form for a new row, the form for a row, or the delete confirmation for a row. */
type OpenDialog<Row> = { mode: 'create' } | { mode: 'edit'; row: Row } | { mode: 'delete'; row: Row } | null

/**
 * The text DataTables sorts and searches a cell by (the screen shows the React cell instead).
 * @param column - The column.
 * @param value - The cell's value.
 * @param type - DataTables' request: "sort", "type" or "filter" (search).
 * @param locale - The page language.
 * @returns A number for numeric columns' sorting, else text; search sees every language of a localized value.
 */
function plainValue<Row>(column: DataColumn<Row>, value: unknown, type: string, locale: Locale): string | number {
  if (value === null || value === undefined) return ''
  switch (column.type) {
    case 'localized': {
      const text = value as Localized<string>
      return type === 'filter' ? Object.values(text).join(' ') : localized(text, locale)
    }
    case 'boolean':
      return value ? 1 : 0
    case 'integer':
    case 'number':
    case 'money':
      return Number(value)
    case 'select':
      return column.options?.find((option) => option.value === value)?.label ?? String(value)
    default:
      return String(value)
  }
}

/**
 * The default cell of a column type.
 * @param props.column - The column.
 * @param props.value - The cell's value (null/undefined shows a dash).
 * @param props.locale - The page language (localized text, number and date formats).
 * @param props.yes - The word for true (read by screen readers next to the check icon).
 * @param props.no - The word for false.
 * @returns The cell content.
 */
function Cell<Row>({ column, value, locale, yes, no }: { column: DataColumn<Row>; value: unknown; locale: Locale; yes: string; no: string }) {
  if (value === null || value === undefined || value === '') return <span className="text-brand-charcoal-muted">—</span>
  switch (column.type) {
    case 'localized':
      return <>{localized(value as Localized<string>, locale)}</>
    case 'boolean':
      return value ? (
        <Check className="size-4 text-brand-charcoal" role="img" aria-label={yes} />
      ) : (
        <X className="size-4 text-brand-charcoal-muted" role="img" aria-label={no} />
      )
    case 'integer':
    case 'number':
      return <>{Number(value).toLocaleString(locale)}</>
    case 'money':
      return <>{Number(value).toLocaleString(locale, { style: 'currency', currency: 'ILS' })}</>
    case 'select':
      return <>{column.options?.find((option) => option.value === value)?.label ?? String(value)}</>
    case 'color':
      return (
        <span className="inline-flex items-center gap-2" dir="ltr">
          <span className="size-4 border border-neutral-300" style={{ backgroundColor: String(value) }} aria-hidden />
          {String(value)}
        </span>
      )
    case 'datetime':
      return <>{new Date(String(value)).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</>
    default:
      return column.ltr ? <span dir="ltr">{String(value)}</span> : <>{String(value)}</>
  }
}

/** How many frames focusSettled keeps checking: a save's redraw mounts the new cells within a few. */
const FOCUS_FRAMES = 10

/**
 * Focuses an element inside the table once the table has settled. After a save, DataTables redraws its cells
 * and React mounts the new buttons a frame or two later, replacing the old ones; so this focuses the current
 * match on each frame until it is still focused and attached on the next, or the frames run out.
 * @param root - The table wrapper (focused itself when nothing matches).
 * @param selector - The element to focus, e.g. the row's Edit button.
 * @param frames - Frames left to check.
 */
function focusSettled(root: HTMLElement | null, selector: string, frames = FOCUS_FRAMES) {
  requestAnimationFrame(() => {
    if (!root?.isConnected) return
    const active = document.activeElement
    if (active instanceof HTMLElement && active.isConnected && root.contains(active) && active.matches(selector)) return
    ;(root.querySelector<HTMLElement>(selector) ?? root).focus()
    if (frames > 1) focusSettled(root, selector, frames - 1)
  })
}

/**
 * The Edit and Delete buttons of one row (DataTables renders them in the actions column).
 * @param props.row - The row.
 * @param props.table - The table's latest props (which actions exist, the row's key and name).
 * @param props.onOpen - Opens the edit form or the delete confirmation for the row.
 * @returns The buttons the table's handlers allow.
 */
function RowActions<Row>({ row, table, onOpen }: { row: Row; table: { current: DataTableProps<Row> }; onOpen: (dialog: OpenDialog<Row>) => void }) {
  const { t } = useI18n()
  const { onUpdate, onDelete, rowKey, rowLabel } = table.current
  const name = rowLabel(row)
  const key = rowKey(row)
  return (
    <span className="flex gap-1">
      {onUpdate && (
        <Button variant="ghost" size="xs" data-row={key} data-action="edit" aria-label={t.admin.editRow.replace('{name}', name)} onClick={() => onOpen({ mode: 'edit', row })}>
          <Pencil aria-hidden />
          {t.admin.edit}
        </Button>
      )}
      {onDelete && (
        <Button variant="ghost" size="xs" data-row={key} data-action="delete" aria-label={t.admin.deleteRow.replace('{name}', name)} onClick={() => onOpen({ mode: 'delete', row })}>
          <Trash2 aria-hidden />
          {t.admin.delete}
        </Button>
      )}
    </span>
  )
}

/**
 * The data table: a toolbar ("Add"), the DataTables table with an actions column, the edit form and the delete
 * confirmation.
 * @param props.rows - The rows to show; a new array redraws the table (search, sort and page are kept).
 * @param props.columns - The column config (read once at mount; see DataColumn).
 * @param props.caption - The table's accessible name (e.g. "Brands").
 * @param props.rowKey - The key the handlers receive for a row (its id).
 * @param props.rowLabel - A row's name for people: in the action buttons' names and the dialog titles.
 * @param props.newRow - The form's starting values for a new row (e.g. { isActive: true }).
 * @param props.pageLength - Rows per page; default 25.
 * @param props.onCreate - Saves a new row (rejects with ApiError to show the server's error); omit to hide "Add".
 * @param props.onUpdate - Saves the changed fields of a row; omit to hide "Edit".
 * @param props.onDelete - Deletes a row; omit to hide "Delete".
 * @returns The table section.
 */
export function DataTable<Row>(props: DataTableProps<Row>) {
  const { rows, caption, rowLabel, onCreate, onDelete } = props
  const { t, locale, dir } = useI18n()
  const [open, setOpen] = useState<OpenDialog<Row>>(null)
  const [status, setStatus] = useState('')
  const wrapper = useRef<HTMLDivElement>(null)
  /** The props of the latest render, for the cell renderers DataTables keeps from the first one. */
  const latest = useRef(props)
  useLayoutEffect(() => {
    latest.current = props
  })

  // Built once: DataTables reads its options, columns and renderers only when it mounts.
  const [{ columns, slots, options }] = useState(() => {
    const shown = props.columns.filter((column) => column.inTable !== false)
    const hasActions = Boolean(props.onUpdate || props.onDelete)
    const columns: ColumnOptions[] = shown.map((column) => ({
      data: column.key,
      name: column.key,
      title: column.label,
      defaultContent: '',
      type: ['integer', 'number', 'money', 'boolean'].includes(column.type ?? 'text') ? 'num' : 'string',
    }))
    if (hasActions) columns.push({ data: null, name: 'actions', title: t.admin.actions, orderable: false, searchable: false, className: 'dt-actions' })
    const slots: DataTableSlots = {}
    for (const column of shown) {
      slots[column.key] = (data: unknown, type: string, row: Row, _meta: object) =>
        type === 'display' ? (
          column.render ? column.render(row) : <Cell column={column} value={data} locale={locale} yes={t.admin.yes} no={t.admin.no} />
        ) : (
          plainValue(column, data, type, locale)
        )
    }
    if (hasActions) slots.actions = (_data: unknown, row: Row) => <RowActions row={row} table={latest} onOpen={setOpen} />
    const options: Options = {
      order: [],
      pageLength: props.pageLength ?? 25,
      // Search first (the control staff use most), the page length at the far end; count and pages below.
      layout: { topStart: 'search', topEnd: 'pageLength', bottomStart: 'info', bottomEnd: 'paging' },
      autoWidth: false,
      language: {
        search: t.admin.table.search,
        info: t.admin.table.info,
        infoEmpty: t.admin.table.infoEmpty,
        infoFiltered: t.admin.table.infoFiltered,
        emptyTable: t.admin.table.emptyTable,
        zeroRecords: t.admin.table.zeroRecords,
        lengthMenu: t.admin.table.lengthMenu,
        thousands: ',',
        aria: {
          orderable: t.admin.table.orderable,
          orderableReverse: t.admin.table.orderableReverse,
          orderableRemove: t.admin.table.orderableRemove,
          paginate: {
            first: t.admin.table.first,
            last: t.admin.table.last,
            next: t.admin.table.next,
            previous: t.admin.table.previous,
            // DataTables appends the page number directly, so the space keeps it a separate word ("Page 1").
            number: `${t.admin.table.pageNumber} `,
          },
        },
      },
    }
    return { columns, slots, options }
  })

  /**
   * Puts the keyboard focus back after a dialog closes: on the row's button again (the table redraws its
   * cells after a save, so the button that opened the dialog may be a new element), else on the table.
   * @param event - Radix's close-autofocus event; its default (focus the old trigger) is replaced.
   */
  const handleCloseFocus = (event: Event) => {
    event.preventDefault()
    const target = open && open.mode !== 'create' ? `[data-row="${CSS.escape(props.rowKey(open.row))}"][data-action="${open.mode}"]` : '[data-action="create"]'
    focusSettled(wrapper.current, target)
  }

  /**
   * Saves the form: creates the row or sends the changed fields, then closes the dialog and announces it.
   * @param changes - The new row's values, or the edited row's changed fields.
   * @returns Resolves when saved; rejects with the handler's error so the form can show it.
   */
  const handleSave = async (changes: RowValues) => {
    if (open?.mode === 'edit') {
      if (Object.keys(changes).length > 0) await props.onUpdate?.(props.rowKey(open.row), changes)
      setStatus(t.admin.saved)
    } else {
      await onCreate?.(changes)
      setStatus(t.admin.created)
    }
    setOpen(null)
  }

  const memoTable = useMemo(
    () => (
      <DataTableLib data={rows} columns={columns} slots={slots} options={options} className="admin-table">
        <caption className="sr-only">{caption}</caption>
      </DataTableLib>
    ),
    [rows, columns, slots, options, caption],
  )

  return (
    <div ref={wrapper} tabIndex={-1} dir={dir} className="data-table outline-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <p role="status" className="text-sm text-brand-charcoal-muted">
          {status}
        </p>
        {onCreate && (
          <Button size="sm" data-action="create" onClick={() => setOpen({ mode: 'create' })}>
            <Plus aria-hidden />
            {t.admin.add}
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">{memoTable}</div>

      {(open?.mode === 'create' || open?.mode === 'edit') && (
        <RecordDialog
          columns={props.columns}
          row={open.mode === 'edit' ? (open.row as RowValues) : undefined}
          initial={props.newRow}
          title={open.mode === 'edit' ? t.admin.editTitle.replace('{name}', rowLabel(open.row)) : t.admin.addTitle}
          onSave={handleSave}
          onClose={() => setOpen(null)}
          onCloseAutoFocus={handleCloseFocus}
        />
      )}
      {open?.mode === 'delete' && onDelete && (
        <DeleteDialog
          name={rowLabel(open.row)}
          onConfirm={async () => {
            await onDelete(props.rowKey(open.row))
            setStatus(t.admin.deleted)
            setOpen(null)
          }}
          onClose={() => setOpen(null)}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            requestAnimationFrame(() => wrapper.current?.focus())
          }}
        />
      )}
    </div>
  )
}

/**
 * Asks before deleting a row, and shows why the server refused (e.g. other rows still use it).
 * @param props.name - The row's name, in the title.
 * @param props.onConfirm - Deletes the row (rejects with ApiError on refusal).
 * @param props.onClose - Closes the dialog without deleting.
 * @param props.onCloseAutoFocus - Where the focus goes after closing (the row and its button are gone).
 * @returns The confirmation dialog.
 */
function DeleteDialog({
  name,
  onConfirm,
  onClose,
  onCloseAutoFocus,
}: {
  name: string
  onConfirm: () => Promise<void>
  onClose: () => void
  onCloseAutoFocus: (event: Event) => void
}) {
  const { t } = useI18n()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  /** Runs the delete; on failure keeps the dialog open with the server's reason. */
  const handleConfirm = async () => {
    setPending(true)
    setError('')
    try {
      await onConfirm()
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiError ? caught.code : undefined, t))
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent role="alertdialog" closeLabel={t.admin.close} onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t.admin.deleteTitle.replace('{name}', name)}</DialogTitle>
          <DialogDescription>{t.admin.deleteBody}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="px-6 pt-4 text-sm font-medium text-brand-red-dark">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t.admin.cancel}
          </Button>
          <Button size="sm" disabled={pending} onClick={handleConfirm}>
            {t.admin.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
