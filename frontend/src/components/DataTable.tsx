/**
 * DataTable.tsx — The reusable data table of the admin panel: lists the rows of any database table (search,
 * sorting, paging) and, when given the handlers, lets staff add, edit and delete them.
 *
 * Built on DataTables (datatables.net-react, the free core: no jQuery in v3). The caller describes the columns
 * once (DataColumn: key, label, type, required, ...); the same config drives the table cells, what search and
 * sorting see, and the edit form (RecordDialog). Editing is our own Radix dialog, not the paid DataTables
 * Editor. Each handler left out hides its action, so a table with none is read-only. `rowActions` add buttons of
 * the caller's own (e.g. "Discounts") that open the caller's dialog for the row. `onReorder` adds "Change order",
 * which opens ReorderDialog (drag the rows into order) for a table whose rows have a display order. A page whose
 * form is not one field per column (e.g. the Discounts page) passes `formDialog`, its own dialog for Add and Edit,
 * in place of RecordDialog; `canEdit` hides Edit on rows that form cannot edit. Used by the
 * /admin pages (e.g. routes/admin.brands.tsx), one column config per resource.
 *
 * How it talks to DataTables: the options, columns and cell renderers are read once, when the table mounts
 * (the library's rule), so the renderers read the latest props through a ref; new `rows` redraw the table
 * keeping its search, sort and page. Cells are React (slots rendered through portals) for display, and plain
 * text for DataTables' sorting and search; only the rows of the page shown get their cells built (deferRender),
 * so a table of hundreds of rows stays fast. Changing `columns` after mount needs a remount (a new `key`).
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import DataTableLib, { type DataTableSlots } from 'datatables.net-react'
import DT, { type ColumnOptions, type Options } from 'datatables.net-dt'
import 'datatables.net-dt/css/dataTables.dataTables.css'
import { ArrowUpDown, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { ApiError, type UploadFolder } from '@/api'
import { localized, type Localized } from '@/config'
import { RecordDialog, errorMessage } from '@/components/RecordDialog'
import { ReorderDialog } from '@/components/ReorderDialog'
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
 * `url`, `datetime` (an ISO timestamp) or `image` (a stored picture's URL: a thumbnail cell, and an upload-only
 * field into the column's `folder`).
 */
export type FieldType = 'text' | 'localized' | 'integer' | 'number' | 'money' | 'boolean' | 'select' | 'color' | 'url' | 'datetime' | 'image'

/**
 * One column of a DataTable and one field of its edit form.
 * - `key`: the row property (the staff API's camelCase JSON key, e.g. "sortOrder").
 * - `type`: see FieldType; default "text". `multiline`: a text or localized field edited in a textarea.
 * - `options`: the choices of a "select" column, or the suggestions of a searchable "text" column.
 * - `searchable`: the form edits the column with a SearchableField: a "select" column becomes a type-to-search
 *   field limited to its options (strict), a "text" column a free field that suggests its options.
 * - `required`: the form refuses an empty value. `pattern` / `hint`: input pattern (regex) and help text.
 * - `ltr`: left-to-right content in any language (slugs, URLs, codes).
 * - `folder`: where an "image" column's uploads are stored (e.g. "categories").
 * - `readOnly`: shown in the form but not editable. `inTable` / `inForm`: false hides it there (default true).
 * - `render`: overrides the cell (the form still uses `type`).
 */
export type DataColumn<Row> = {
  key: keyof Row & string
  label: string
  type?: FieldType
  multiline?: boolean
  options?: { value: string; label: string }[]
  searchable?: boolean
  required?: boolean
  pattern?: string
  hint?: string
  ltr?: boolean
  folder?: UploadFolder
  readOnly?: boolean
  inTable?: boolean
  inForm?: boolean
  render?: (row: Row) => ReactNode
}

/** A row's values by column key, as the form edits them and the handlers receive them. */
export type RowValues = Record<string, unknown>

/**
 * A button of the caller's own on every row, between Edit and Delete, that opens the caller's dialog for the row.
 * - `name`: tells the buttons apart (their `data-action`), e.g. "discounts". `label`: the visible text.
 * - `rowLabel`: the button's accessible name for a row name, e.g. "Discounts: Paw" (it must contain `label`).
 * - `icon`: a lucide icon (aria-hidden).
 * - `dialog`: renders the open dialog for the row, always its latest version (after the rows reload). The dialog
 *   calls `onClose` when it closes and passes `onCloseAutoFocus` to its DialogContent, so the focus goes back
 *   to the row's button.
 */
export type RowAction<Row> = {
  name: string
  label: string
  rowLabel: (name: string) => string
  icon: ReactNode
  dialog: (row: Row, props: { onClose: () => void; onCloseAutoFocus: (event: Event) => void }) => ReactNode
}

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
  onReorder?: (keys: string[]) => Promise<unknown>
  rowActions?: RowAction<Row>[]
  formDialog?: (row: Row | undefined, props: FormDialogProps) => ReactNode
  canEdit?: (row: Row) => boolean
}

/**
 * What DataTable hands a `formDialog`: `onSave` creates the row (Add) or saves its changes (Edit) through
 * onCreate / onUpdate, then closes the dialog and announces it (rejects with the handler's error, so the dialog can
 * show it and stay open); `onClose` closes without saving; `onCloseAutoFocus` goes to the dialog's DialogContent.
 */
export type FormDialogProps = { onSave: (values: RowValues) => Promise<void>; onClose: () => void; onCloseAutoFocus: (event: Event) => void }

/**
 * What is open: the form for a new row, the form for a row, the delete confirmation for a row, the dialog of
 * one of the caller's row actions (by its name), or the order of all rows.
 */
type OpenDialog<Row> =
  | { mode: 'create' }
  | { mode: 'reorder' }
  | { mode: 'edit'; row: Row }
  | { mode: 'delete'; row: Row }
  | { mode: 'action'; name: string; row: Row }
  | null

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
    case 'image':
      return <img src={String(value)} alt="" width={64} height={48} loading="lazy" className="aspect-[4/3] w-16 border border-neutral-300 object-cover" />
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
 * The Edit, custom (rowActions) and Delete buttons of one row (DataTables renders them in the actions column).
 * @param props.row - The row.
 * @param props.table - The table's latest props (which actions exist, the row's key and name).
 * @param props.onOpen - Opens the edit form, a custom action's dialog or the delete confirmation for the row.
 * @returns The buttons the table's handlers allow.
 */
function RowActions<Row>({ row, table, onOpen }: { row: Row; table: { current: DataTableProps<Row> }; onOpen: (dialog: OpenDialog<Row>) => void }) {
  const { t } = useI18n()
  const { onUpdate, onDelete, rowKey, rowLabel, rowActions = [], canEdit } = table.current
  const name = rowLabel(row)
  const key = rowKey(row)
  return (
    <span className="flex gap-2">
      {onUpdate && (canEdit?.(row) ?? true) && (
        <Button variant="action" size="action" data-row={key} data-action="edit" aria-label={t.admin.editRow.replace('{name}', name)} onClick={() => onOpen({ mode: 'edit', row })}>
          <Pencil aria-hidden />
          {t.admin.edit}
        </Button>
      )}
      {rowActions.map((action) => (
        <Button key={action.name} variant="action" size="action" data-row={key} data-action={action.name} aria-label={action.rowLabel(name)} onClick={() => onOpen({ mode: 'action', name: action.name, row })}>
          {action.icon}
          {action.label}
        </Button>
      ))}
      {onDelete && (
        <Button variant="actionDanger" size="action" data-row={key} data-action="delete" aria-label={t.admin.deleteRow.replace('{name}', name)} onClick={() => onOpen({ mode: 'delete', row })}>
          <Trash2 aria-hidden />
          {t.admin.delete}
        </Button>
      )}
    </span>
  )
}

/**
 * The data table: a toolbar ("Change order", "Add"), the DataTables table with an actions column, the edit form,
 * the delete confirmation and the reorder dialog.
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
 * @param props.onReorder - Saves a new order: every row's key, first to last (the caller gives `rows` in their display
 *   order, which the table keeps until staff sort a column); omit to hide "Change order".
 * @param props.rowActions - Buttons of the caller's own on every row, each opening its dialog (see RowAction).
 * @param props.formDialog - The caller's own Add/Edit dialog in place of RecordDialog: gets the edited row (undefined
 *   for Add) and FormDialogProps; omit to use the column-driven form.
 * @param props.canEdit - Whether a row shows Edit (with onUpdate); default every row.
 * @returns The table section.
 */
export function DataTable<Row>(props: DataTableProps<Row>) {
  const { rows, caption, rowLabel, onCreate, onDelete, onReorder } = props
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
    const hasActions = Boolean(props.onUpdate || props.onDelete || props.rowActions?.length)
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
      deferRender: true,
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
    const action = open?.mode === 'action' ? open.name : open?.mode
    const target = open && open.mode !== 'create' && open.mode !== 'reorder' ? `[data-row="${CSS.escape(props.rowKey(open.row))}"][data-action="${action}"]` : `[data-action="${action}"]`
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

  // A custom action's dialog shows the row as it is now: a save inside it reloads the rows.
  const action = open?.mode === 'action' ? props.rowActions?.find((candidate) => candidate.name === open.name) : undefined
  const actionRow = open?.mode === 'action' ? (rows.find((row) => props.rowKey(row) === props.rowKey(open.row)) ?? open.row) : undefined

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
        <div className="flex flex-wrap gap-2">
          {onReorder && rows.length > 1 && (
            <Button size="sm" variant="outline" data-action="reorder" onClick={() => setOpen({ mode: 'reorder' })}>
              <ArrowUpDown aria-hidden />
              {t.admin.reorder.button}
            </Button>
          )}
          {onCreate && (
            <Button size="sm" data-action="create" onClick={() => setOpen({ mode: 'create' })}>
              <Plus aria-hidden />
              {t.admin.add}
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">{memoTable}</div>

      {(open?.mode === 'create' || open?.mode === 'edit') && props.formDialog && (
        <FormDialog
          render={props.formDialog}
          row={open.mode === 'edit' ? open.row : undefined}
          onSave={handleSave}
          onClose={() => setOpen(null)}
          onCloseAutoFocus={handleCloseFocus}
        />
      )}
      {(open?.mode === 'create' || open?.mode === 'edit') && !props.formDialog && (
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
      {open?.mode === 'reorder' && onReorder && (
        <ReorderDialog
          items={rows.map((row) => ({ id: props.rowKey(row), label: rowLabel(row) }))}
          title={t.admin.reorder.title}
          onSave={async (keys) => {
            await onReorder(keys)
            setStatus(t.admin.reorder.saved)
            setOpen(null)
          }}
          onClose={() => setOpen(null)}
          onCloseAutoFocus={handleCloseFocus}
        />
      )}
      {action && actionRow !== undefined && <ActionDialog action={action} row={actionRow} onClose={() => setOpen(null)} onCloseAutoFocus={handleCloseFocus} />}
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
 * The open dialog of a caller's row action.
 * @param props.action - The action.
 * @param props.row - The row, as it is now.
 * @param props.onClose - Closes the dialog.
 * @param props.onCloseAutoFocus - Where the focus goes after closing (the row's button).
 * @returns What the action's `dialog` renders.
 */
function ActionDialog<Row>({ action, row, onClose, onCloseAutoFocus }: { action: RowAction<Row>; row: Row; onClose: () => void; onCloseAutoFocus: (event: Event) => void }) {
  return action.dialog(row, { onClose, onCloseAutoFocus })
}

/**
 * The caller's own Add/Edit dialog (DataTable's `formDialog`).
 * @param props.render - The caller's `formDialog`.
 * @param props.row - The edited row; undefined for Add.
 * @param props.onSave - Creates or updates the row through the table's handlers (see FormDialogProps).
 * @param props.onClose - Closes the dialog.
 * @param props.onCloseAutoFocus - Where the focus goes after closing (the row's Edit button, or Add).
 * @returns What `render` returns.
 */
function FormDialog<Row>({ render, row, ...props }: FormDialogProps & { render: NonNullable<DataTableProps<Row>['formDialog']>; row: Row | undefined }) {
  return render(row, props)
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
