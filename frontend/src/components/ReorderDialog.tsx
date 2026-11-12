/**
 * ReorderDialog.tsx — A dialog that sets the order of a list: staff drag the entries (or move them one step with the
 * arrow buttons) and Save sends the new order, the position in the list being the order. Reusable for any list of
 * records with a display order (e.g. the categories, through DataTable's `onReorder`; brands or products the same way).
 *
 * Dragging is @dnd-kit (core + sortable): with a pointer or a finger on an entry's grip, or with the keyboard (Space
 * on the grip picks it up, the up/down arrows move it, Space drops it, Escape cancels). Every move is announced in
 * the page language (dnd-kit's live region for drags, our own for the arrow buttons), and the arrow buttons are the
 * single-pointer alternative to dragging. Escape during a keyboard drag cancels the drag instead of closing the
 * dialog. The list moves only vertically; entries glide on --ease-spring (the global reduced-motion rule applies).
 * Long lists (the 400 products) stay responsive: a move re-renders only the entries whose place changed (EntryContent
 * is memoized and the move handler is stable).
 */
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { cn } from 'cn'
import { ApiError } from '@/api'
import { errorMessage } from '@/components/RecordDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'

/** One entry of the list: its key (what onSave receives), its name and an optional second line. */
export type ReorderItem = { id: string; label: string; detail?: string }

/** Keeps a drag on the vertical axis (the list is one column). */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/** How an entry glides to its new place while another one is dragged over it. */
const GLIDE = { duration: 250, easing: 'var(--ease-spring)' }

/**
 * Escapes an id for a CSS attribute selector (the browser's CSS.escape; `CSS` here is dnd-kit's helper).
 * @param value - The id.
 * @returns The escaped id.
 */
const escapeId = (value: string) => globalThis.CSS.escape(value)

/** The arrow button that last moved an entry, focused again after the list re-renders. */
type FocusTarget = { id: string; action: 'up' | 'down' }

/**
 * Fills a message's {name}, {position} and {total}.
 * @param template - The dictionary text, e.g. "{name} moved to position {position} of {total}."
 * @param name - The entry's label.
 * @param position - Its 1-based position.
 * @param total - How many entries the list has.
 * @returns The message.
 */
function fill(template: string, name: string, position: number, total: number): string {
  return template.replace('{name}', name).replace('{position}', String(position)).replace('{total}', String(total))
}

/**
 * The reorder dialog.
 * @param props.items - The entries in their current order.
 * @param props.title - The dialog title (also the list's accessible name).
 * @param props.description - The text under the title; default: how to reorder.
 * @param props.onSave - Saves the new order (every entry's id, first to last); rejects with ApiError to show the
 *   server's error. The caller closes the dialog after it resolves.
 * @param props.onClose - Closes without saving.
 * @param props.onCloseAutoFocus - Where the focus goes after closing (e.g. back to the button that opened it).
 * @returns The dialog.
 */
export function ReorderDialog({
  items,
  title,
  description,
  onSave,
  onClose,
  onCloseAutoFocus,
}: {
  items: ReorderItem[]
  title: string
  description?: string
  onSave: (ids: string[]) => Promise<void>
  onClose: () => void
  onCloseAutoFocus: (event: Event) => void
}) {
  const { t } = useI18n()
  const r = t.admin.reorder
  const [order, setOrder] = useState(() => items.map((item) => item.id))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const dragging = useRef(false)
  const list = useRef<HTMLOListElement>(null)
  const focusTarget = useRef<FocusTarget | null>(null)
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const changed = order.some((id, index) => id !== items[index]?.id)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // After an arrow button moved an entry, focus that button again (or the other one at either end of the list).
  useLayoutEffect(() => {
    const target = focusTarget.current
    if (!target) return
    focusTarget.current = null
    const buttons = (action: string) => list.current?.querySelector<HTMLButtonElement>(`[data-reorder-id="${escapeId(target.id)}"][data-reorder-action="${action}"]`)
    const same = buttons(target.action)
    ;(same && !same.disabled ? same : buttons(target.action === 'up' ? 'down' : 'up'))?.focus()
  }, [order])

  /**
   * The label of an entry.
   * @param id - The entry's id.
   * @returns Its label.
   */
  const nameOf = (id: UniqueIdentifier) => byId.get(String(id))?.label ?? ''

  /**
   * The 1-based position of an entry in the current order.
   * @param id - The entry's id.
   * @returns Its position.
   */
  const positionOf = (id: UniqueIdentifier) => order.indexOf(String(id)) + 1

  /** What screen readers hear while an entry is dragged (dnd-kit reads these in its live region). */
  const announcements: Announcements = {
    onDragStart: ({ active }) => fill(r.picked, nameOf(active.id), positionOf(active.id), order.length),
    onDragOver: ({ active, over }) => (over ? fill(r.moved, nameOf(active.id), positionOf(over.id), order.length) : undefined),
    onDragEnd: ({ active, over }) => (over ? fill(r.dropped, nameOf(active.id), positionOf(over.id), order.length) : undefined),
    onDragCancel: ({ active }) => fill(r.cancelled, nameOf(active.id), positionOf(active.id), order.length),
  }

  /**
   * Drop handler: puts the dragged entry where it was dropped.
   * @param event - dnd-kit's drag-end event (the dragged entry and the one it is over).
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    dragging.current = false
    if (!over || active.id === over.id) return
    setOrder((current) => arrayMove(current, current.indexOf(String(active.id)), current.indexOf(String(over.id))))
  }

  /**
   * Arrow-button handler: moves an entry one place up or down, announces it and keeps the focus on the button.
   * @param id - The entry's id.
   * @param action - "up" or "down".
   */
  const handleMove = (id: string, action: 'up' | 'down') => {
    const from = order.indexOf(id)
    const to = from + (action === 'up' ? -1 : 1)
    if (to < 0 || to >= order.length) return
    focusTarget.current = { id, action }
    setOrder(arrayMove(order, from, to))
    setStatus(fill(r.moved, nameOf(id), to + 1, order.length))
  }

  // The latest handleMove behind a stable function, so a move does not re-render every entry's buttons.
  const latestMove = useRef(handleMove)
  useLayoutEffect(() => {
    latestMove.current = handleMove
  })
  const onMove = useCallback((id: string, action: 'up' | 'down') => latestMove.current(id, action), [])

  /** Save handler: sends the new order; on failure keeps the dialog open with the server's reason. */
  const handleSave = async () => {
    setPending(true)
    setError('')
    try {
      await onSave(order)
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiError ? caught.code : undefined, t))
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="max-w-xl"
        closeLabel={t.admin.close}
        onCloseAutoFocus={onCloseAutoFocus}
        // Escape during a keyboard drag cancels the drag (dnd-kit), not the dialog.
        onEscapeKeyDown={(event) => dragging.current && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description ?? r.description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[verticalOnly]}
            accessibility={{ announcements, screenReaderInstructions: { draggable: r.instructions } }}
            onDragStart={() => (dragging.current = true)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => (dragging.current = false)}
          >
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <ol ref={list} aria-label={title} className="space-y-2">
                {order.map((id, index) => (
                  <SortableEntry
                    key={id}
                    item={byId.get(id) ?? { id, label: id }}
                    position={index + 1}
                    first={index === 0}
                    last={index === order.length - 1}
                    onMove={onMove}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          <p role="status" className="sr-only">
            {status}
          </p>
        </div>
        {error && (
          <p role="alert" className="px-6 pb-4 text-sm font-medium text-brand-red-dark">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t.admin.cancel}
          </Button>
          <Button type="button" size="sm" disabled={!changed || pending} onClick={handleSave}>
            {t.admin.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * One draggable entry: its grip (the drag handle), position, label and the up/down buttons.
 * @param props.item - The entry.
 * @param props.position - Its 1-based position, shown before the label.
 * @param props.first - It is first (no "up").
 * @param props.last - It is last (no "down").
 * @param props.onMove - Moves it one place ("up" or "down").
 * @returns The list item.
 */
function SortableEntry({ item, position, first, last, onMove }: { item: ReorderItem; position: number; first: boolean; last: boolean; onMove: (id: string, action: 'up' | 'down') => void }) {
  const { t } = useI18n()
  const r = t.admin.reorder
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    transition: GLIDE,
    attributes: { roleDescription: r.handle },
  })
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative flex items-center gap-3 border border-neutral-150 bg-white py-2 pe-2 ps-1 transition-[box-shadow,scale]',
        isDragging && 'z-10 scale-[1.02] shadow-premium',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={r.grip.replace('{name}', item.label)}
        className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center text-brand-charcoal-muted transition-colors hover:text-brand-charcoal focus-visible:outline-2 focus-visible:outline-brand-red active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden className="size-5" />
      </button>
      <span aria-hidden className="w-6 shrink-0 text-end font-heading text-xs font-semibold text-brand-charcoal-muted tabular-nums">
        {position}
      </span>
      <EntryContent item={item} first={first} last={last} onMove={onMove} />
    </li>
  )
}

/**
 * The label and the up/down buttons of an entry; memoized, so it re-renders only when the entry reaches or leaves an end
 * of the list (or its item changes), not on every move.
 * @param props.item - The entry.
 * @param props.first - It is first (no "up").
 * @param props.last - It is last (no "down").
 * @param props.onMove - Moves it one place (a stable function).
 * @returns The label and the buttons.
 */
const EntryContent = memo(function EntryContent({ item, first, last, onMove }: { item: ReorderItem; first: boolean; last: boolean; onMove: (id: string, action: 'up' | 'down') => void }) {
  const { t } = useI18n()
  const r = t.admin.reorder
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-brand-charcoal">{item.label}</span>
        {item.detail && <span className="block truncate text-xs text-brand-charcoal-muted">{item.detail}</span>}
      </span>
      <span className="flex shrink-0 gap-1">
        <Button type="button" variant="ghost" size="icon-sm" data-reorder-id={item.id} data-reorder-action="up" disabled={first} aria-label={r.moveUp.replace('{name}', item.label)} onClick={() => onMove(item.id, 'up')}>
          <ChevronUp aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" data-reorder-id={item.id} data-reorder-action="down" disabled={last} aria-label={r.moveDown.replace('{name}', item.label)} onClick={() => onMove(item.id, 'down')}>
          <ChevronDown aria-hidden />
        </Button>
      </span>
    </>
  )
})
