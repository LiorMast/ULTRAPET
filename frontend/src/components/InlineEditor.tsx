/**
 * InlineEditor.tsx — Editing a page section in place, without a dialog. Reusable by every editable section.
 *
 * - useInlineDraft(onSave): the section's edit state (on/off, the draft of every text, the selected text, saving,
 *   the error) and the props for its <form>, its InlineEditBar and its PropBar. Escape cancels; Enter in a one-line
 *   box saves.
 * - InlineEditBar: "Edit on page", then Save (all the section's texts at once) and Cancel, the refusal message and
 *   a status line that announces the save. The keyboard focus returns to "Edit on page" afterwards.
 * - PropBar: the section's one font + size bar. It controls the selected text: the box that last had the focus
 *   (the first text when editing starts), and says which one ("Editing: Tagline"). Staff can move it out of the way
 *   by its grip (drag with a mouse, finger or pen, or the arrow keys); it stays inside the window.
 * - EditableText: one text of the section. Read mode renders the plain element (exactly what visitors get); edit
 *   mode renders a text box with the text's own classes, size and font, so the box looks like the result. Its
 *   focus selects it for the PropBar; the selected box has a solid frame, the others a dashed one.
 *
 * Fonts and sizes come from FONTS / SIZE_STEPS in src/config.ts; the section supplies its size classes. The
 * section decides what saving means (the hero merges the draft into its page_sections content).
 */
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { GripVertical, Pencil } from 'lucide-react'
import { cn } from 'cn'
import { ApiError, type FontKey, type SizeStep } from '@/api'
import { errorMessage } from '@/components/RecordDialog'
import { Button } from '@/components/ui/button'
import { FONTS, fontsFor, SIZE_STEPS } from '@/config'
import { useI18n, type Locale } from '@/i18n'

/** One editable text: its words, font and size step. */
export type TextValue = { text: string; font: FontKey; size: SizeStep }

/**
 * The inline style that applies a picked font (it beats the font tokens, also the Hebrew swap in index.css).
 * @param font - The font key.
 * @returns The style, or undefined for the site's own font.
 */
export const fontStyle = (font: FontKey) => (FONTS[font].family ? { fontFamily: FONTS[font].family } : undefined)

/**
 * The edit state of one section (see the file header).
 * @param onSave - Stores the draft; rejects with an ApiError when the server refuses it.
 * @returns `editing`, `draft`, `active` (the selected text), `start(values, first?)`, `select(key)`,
 *   `change(key, partial)`, `cancel()`, `formProps` for the section's <form>, `bar` for its InlineEditBar and
 *   `propBar(labels)` for its PropBar.
 */
export function useInlineDraft<Key extends string>(onSave: (draft: Record<Key, TextValue>) => Promise<unknown>) {
  const { t } = useI18n()
  const formId = useId()
  const editButton = useRef<HTMLButtonElement>(null)
  const [draft, setDraft] = useState<Record<Key, TextValue> | null>(null)
  const [active, setActive] = useState<Key | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  /** Set when edit mode ends, so the effect below focuses the Edit button once it is back. */
  const returnFocus = useRef(false)
  /** Set when edit mode starts, so the effect below focuses the selected box once it is rendered. */
  const focusSelected = useRef(false)

  useEffect(() => {
    if (returnFocus.current && !draft) {
      returnFocus.current = false
      editButton.current?.focus()
    }
    if (focusSelected.current && draft) {
      focusSelected.current = false
      document.getElementById(formId)?.querySelector<HTMLElement>('[data-selected="true"]')?.focus()
    }
  }, [draft, formId])

  /**
   * Turns edit mode on and puts the focus in the first selected box.
   * @param values - Every text's starting values.
   * @param first - The text selected first; default the first key of `values`.
   */
  const start = (values: Record<Key, TextValue>, first?: Key) => {
    focusSelected.current = true
    setDraft(values)
    setActive(first ?? (Object.keys(values)[0] as Key))
    setError('')
    setStatus('')
  }

  /**
   * Changes one text of the draft.
   * @param key - The text.
   * @param change - The changed field(s).
   */
  const change = (key: Key, change: Partial<TextValue>) => setDraft((current) => current && { ...current, [key]: { ...current[key], ...change } })

  /** Leaves edit mode without saving. */
  const cancel = () => {
    returnFocus.current = true
    setDraft(null)
    setActive(null)
    setError('')
  }

  /**
   * Saves every text of the draft at once; on a refusal stays in edit mode and shows why.
   * @param event - The form submit event.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft || pending) return
    setPending(true)
    setError('')
    try {
      await onSave(draft)
      returnFocus.current = true
      setDraft(null)
      setActive(null)
      setStatus(t.admin.saved)
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiError ? caught.code : undefined, t))
    } finally {
      setPending(false)
    }
  }

  /**
   * Cancels on Escape anywhere inside the section's form or its PropBar; Enter in a one-line box saves (done here,
   * not left to the browser's implicit submission, which depends on how many boxes and buttons the form has).
   * @param event - The key press.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!draft) return
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    } else if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type === 'text') {
      event.preventDefault()
      ;(document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit()
    }
  }

  /**
   * The PropBar's props: the selected text's name, values and change handler.
   * @param labels - Every text's name, e.g. { tagline: "Tagline" }.
   * @returns Props for <PropBar> (add `locale`), or null outside edit mode.
   */
  const propBar = (labels: Record<Key, string>) =>
    draft && active
      ? { label: labels[active], value: draft[active], onChange: (partial: Partial<TextValue>) => change(active, partial), onKeyDown: handleKeyDown }
      : null

  return {
    editing: draft !== null,
    draft,
    active,
    start,
    select: setActive,
    change,
    cancel,
    formProps: { id: formId, onSubmit: handleSubmit, onKeyDown: handleKeyDown, noValidate: true },
    bar: { editing: draft !== null, formId, pending, error, status, editButton, onCancel: cancel },
    propBar,
  }
}

/** What InlineEditBar needs: the `bar` returned by useInlineDraft, plus what "Edit on page" does. */
type InlineEditBarProps = ReturnType<typeof useInlineDraft>['bar'] & { onEdit: () => void; className?: string }

/**
 * The section's edit controls: "Edit on page", or Save and Cancel while editing.
 * @param props.editing - Whether the section is in edit mode.
 * @param props.formId - The id of the section's <form> (Save submits it).
 * @param props.pending - True while saving (Save is disabled).
 * @param props.error - Why the last save was refused; '' = none.
 * @param props.status - The announcement after a save; '' = none.
 * @param props.editButton - Ref of "Edit on page", focused again after saving or cancelling.
 * @param props.onEdit - Starts editing (the section calls start() with its current values).
 * @param props.onCancel - Leaves edit mode without saving.
 * @param props.className - Extra classes of the bar.
 * @returns The bar.
 */
export function InlineEditBar({ editing, formId, pending, error, status, editButton, onEdit, onCancel, className }: InlineEditBarProps) {
  const { t } = useI18n()
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-3', className)}>
      {error && (
        <p role="alert" className="bg-white px-3 py-2 text-sm font-medium text-brand-red">
          {error}
        </p>
      )}
      {editing ? (
        <>
          <Button type="button" variant="ghostWhite" size="sm" onClick={onCancel}>
            {t.admin.cancel}
          </Button>
          <Button type="submit" form={formId} size="sm" disabled={pending}>
            {t.admin.save}
          </Button>
        </>
      ) : (
        <Button ref={editButton} type="button" size="sm" onClick={onEdit}>
          <Pencil size={14} aria-hidden="true" />
          {t.inlineEdit.edit}
        </Button>
      )}
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  )
}

/** The look of the PropBar's selectors, on its dark chip (readable on any section). */
const SELECT_CLASS =
  'border border-white/30 bg-brand-charcoal px-2 py-1 text-xs text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white'

/** How far one arrow-key press moves the PropBar, in pixels (with Shift: KEY_STEP * 5). */
const KEY_STEP = 10

/** An offset from the PropBar's place in the layout, in pixels (physical: x grows to the right in RTL too). */
type Offset = { x: number; y: number }

/**
 * Limits a move of the PropBar so the whole bar stays visible: inside its section (which may clip what sticks out,
 * like the hero) and inside the window.
 * @param bar - The bar element (its on-screen box already includes the current offset).
 * @param current - The current offset.
 * @param next - The wanted offset.
 * @returns The wanted offset, clamped.
 */
function clampOffset(bar: HTMLElement, current: Offset, next: Offset): Offset {
  const box = bar.getBoundingClientRect()
  const section = bar.closest('section')?.getBoundingClientRect()
  const bounds = {
    left: Math.max(section?.left ?? 0, 0),
    top: Math.max(section?.top ?? 0, 0),
    right: Math.min(section?.right ?? window.innerWidth, window.innerWidth),
    bottom: Math.min(section?.bottom ?? window.innerHeight, window.innerHeight),
  }
  // The bar's box with no offset at all, i.e. where the layout puts it.
  const left = box.left - current.x
  const top = box.top - current.y
  /**
   * Clamps one axis; when the bar is larger than the room, its start edge wins.
   * @param value - The wanted offset on the axis.
   * @param min - The smallest allowed offset.
   * @param max - The largest allowed offset.
   * @returns The clamped offset.
   */
  const clamp = (value: number, min: number, max: number) => Math.max(Math.min(value, max), min)
  return {
    x: clamp(next.x, bounds.left - left, bounds.right - box.width - left),
    y: clamp(next.y, bounds.top - top, bounds.bottom - box.height - top),
  }
}

/**
 * The section's one font and size bar; it controls the selected text (see useInlineDraft's `propBar`). It can be
 * dragged by its grip (or moved with the arrow keys on the grip) and keeps its spot until edit mode ends.
 * @param props.label - The selected text's name, e.g. "Tagline" (shown, and in the selectors' names).
 * @param props.value - The selected text's values.
 * @param props.onChange - Called with the new font or size of the selected text.
 * @param props.onKeyDown - The section's key handler (Escape cancels).
 * @param props.locale - The texts' language: which fonts are offered.
 * @param props.className - Extra classes of the bar.
 * @returns The toolbar.
 */
export function PropBar({
  label,
  value,
  onChange,
  onKeyDown,
  locale,
  className,
}: {
  label: string
  value: TextValue
  onChange: (change: Partial<TextValue>) => void
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
  locale: Locale
  className?: string
}) {
  const { t } = useI18n()
  const bar = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  /** The drag in progress: where the pointer and the bar started. */
  const drag = useRef<{ pointerX: number; pointerY: number; start: Offset } | null>(null)

  // Downloads a picked font that the page does not load by itself, so the preview shows it.
  useEffect(() => {
    void FONTS[value.font].load?.()
  }, [value.font])

  /**
   * Moves the bar to an offset, kept inside the window.
   * @param next - The wanted offset.
   */
  const moveTo = (next: Offset) => {
    if (bar.current) setOffset(clampOffset(bar.current, offset, next))
  }

  /**
   * Starts dragging the bar by its grip (mouse, finger or pen); the grip keeps the pointer until it is released.
   * @param event - The pointer press on the grip.
   */
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = { pointerX: event.clientX, pointerY: event.clientY, start: offset }
  }

  /**
   * Follows the pointer while dragging.
   * @param event - The pointer move.
   */
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const from = drag.current
    if (from) moveTo({ x: from.start.x + event.clientX - from.pointerX, y: from.start.y + event.clientY - from.pointerY })
  }

  /** Ends the drag (pointer released or cancelled). */
  const handlePointerUp = () => {
    drag.current = null
  }

  /**
   * Moves the bar with the arrow keys on the grip (the keyboard way to drag); Shift moves further.
   * @param event - The key press on the grip.
   */
  const handleGripKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? KEY_STEP * 5 : KEY_STEP
    const moves: Record<string, Offset> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    moveTo({ x: offset.x + move.x, y: offset.y + move.y })
  }

  return (
    <div
      ref={bar}
      role="toolbar"
      aria-label={t.inlineEdit.toolbar}
      onKeyDown={onKeyDown}
      style={{ translate: `${offset.x}px ${offset.y}px` }}
      className={cn('relative z-30 flex flex-wrap items-center gap-3 bg-brand-charcoal py-2 ps-1 pe-3 font-sans text-xs text-white shadow-premium', className)}
    >
      <button
        type="button"
        aria-label={t.inlineEdit.move}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        title={t.inlineEdit.move}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleGripKeyDown}
        className="flex h-7 w-6 cursor-grab touch-none items-center justify-center text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-white active:cursor-grabbing"
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <p aria-live="polite" className="font-semibold">
        {t.inlineEdit.editing.replace('{label}', label)}
      </p>
      <label className="flex items-center gap-1.5">
        <span aria-hidden="true">{t.inlineEdit.font}</span>
        <select aria-label={t.inlineEdit.fontOf.replace('{label}', label)} value={value.font} onChange={(event) => onChange({ font: event.target.value as FontKey })} className={SELECT_CLASS}>
          {fontsFor(locale).map((font) => (
            <option key={font} value={font}>
              {font === 'default' ? t.inlineEdit.siteFont : FONTS[font].name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <span aria-hidden="true">{t.inlineEdit.size}</span>
        <select aria-label={t.inlineEdit.sizeOf.replace('{label}', label)} value={value.size} onChange={(event) => onChange({ size: event.target.value as SizeStep })} className={SELECT_CLASS}>
          {SIZE_STEPS.map((size) => (
            <option key={size} value={size}>
              {t.inlineEdit.sizes[size]}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/** The look of a text box: the text's own typography, a dashed frame, a solid one when selected or focused. */
const BOX_CLASS =
  'block w-full bg-transparent p-0 text-inherit outline-1 outline-offset-4 outline-current/50 outline-dashed [font:inherit] [letter-spacing:inherit] placeholder:text-current/50 focus:outline-2 focus:outline-solid focus:outline-current data-[selected=true]:outline-solid data-[selected=true]:outline-current'

/**
 * One text of an editable section.
 * @param props.as - The element in read mode (and the look in edit mode); default "p".
 * @param props.value - The text's words, font and size.
 * @param props.editing - Edit mode: a text box instead of the element.
 * @param props.onChange - Called with the new words while editing.
 * @param props.label - The text's name, e.g. "Tagline": the box's accessible name.
 * @param props.locale - The text's language (the box's lang).
 * @param props.selected - The PropBar controls this text (solid frame; the box focused when editing starts).
 * @param props.onSelect - Called when the box gets the focus, to select its text (or the text whose style it follows).
 * @param props.className - The text's classes (colour, weight, line height, margins, ...), in both modes.
 * @param props.sizeClass - The text's size classes per step; omitted = no size of its own (inherits).
 * @param props.controls - false = no font/size of its own: it follows its parent's (e.g. an accent word).
 * @param props.multiline - A growing multi-line box instead of a one-line one.
 * @param props.placeholder - Shown in an empty box (e.g. the built-in text an empty value falls back to).
 * @param props.before - Shown before the words in both modes (e.g. a decorative logo).
 * @param props.after - Shown after the words in both modes (e.g. an accent word, itself an EditableText).
 * @returns The element, or the box.
 */
export function EditableText({
  as: As = 'p',
  value,
  editing,
  onChange,
  label,
  locale,
  selected = false,
  onSelect,
  className,
  sizeClass,
  controls = true,
  multiline = false,
  placeholder,
  before,
  after,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
  value: TextValue
  editing: boolean
  onChange: (change: Partial<TextValue>) => void
  label: string
  locale: Locale
  selected?: boolean
  onSelect?: () => void
  className?: string
  sizeClass?: (size: SizeStep) => string
  controls?: boolean
  multiline?: boolean
  placeholder?: string
  before?: ReactNode
  after?: ReactNode
}) {
  const look = cn(controls && sizeClass?.(value.size), className)
  const style = controls ? fontStyle(value.font) : undefined

  // Downloads a picked font that the page does not load by itself.
  useEffect(() => {
    if (controls) void FONTS[value.font].load?.()
  }, [controls, value.font])

  if (!editing) {
    return (
      <As className={look} style={style}>
        {before}
        {value.text}
        {after}
      </As>
    )
  }

  const box = {
    value: value.text,
    placeholder,
    'aria-label': label,
    lang: locale,
    'data-selected': selected,
    onFocus: onSelect,
    onChange: (event: { target: { value: string } }) => onChange({ text: event.target.value }),
  }
  const field = multiline ? (
    <textarea rows={3} className={cn(BOX_CLASS, 'field-sizing-content resize-none')} {...box} />
  ) : (
    // One line that grows with its words (field-sizing), so a short word stays inline next to the next box.
    <input type="text" size={Math.max((value.text || placeholder || '').length, 2)} className={cn(BOX_CLASS, 'inline-block w-auto max-w-full field-sizing-content')} {...box} />
  )

  if (!controls) return <span className={look}>{field}</span>

  return (
    <div className={look} style={style}>
      {before}
      {field}
      {after}
    </div>
  )
}
