/**
 * EditableSection.tsx — The shared parts of every home section that staff edit in place (built on InlineEditor.tsx).
 *
 * A section's texts have keys (e.g. "eyebrow", "title", "pillar.expertise.text"); their built-in words come from the
 * dictionaries, and what staff saved lives in the section's page_sections row as SectionContent: one SectionText
 * ({ text, font, size, width }, each per language) per key. An empty or missing text shows the built-in words.
 * - resolveText / putLocale / putWidth: the per-language reading and writing of one text (also used by the hero).
 * - sectionDraft / mergeSection: the editor's starting values in the page language, and the draft written back into
 *   the content (the other languages keep theirs).
 * - sectionFields(inline, options): what a section renders from its draft: `field(key)` = the props of the text's
 *   EditableText (read mode: the saved or built-in text; edit mode: its box), and `propBar` for the font + size bar.
 *   Only the `styled` keys (the section heading's texts) have a font and size of their own; the other texts are
 *   words only, in the site's typography, and selecting one hides the bar. Every text stored in the content (styled
 *   or not) is `resizable`: staff drag its width, saved with it. `data` keys are texts stored elsewhere
 *   (the stats numbers, the contact details in the settings): they start from their current value, have no
 *   built-in fallback or width and are left out of the content; the section's onSave stores them.
 * - useEditableSection(options): useInlineDraft + sectionFields, for a section with a fixed set of texts. The FAQ,
 *   which also edits a list, calls useInlineDraft and sectionFields itself.
 * - SectionEditBar: the section's "Edit on page" / Save / Cancel and its PropBar, at the top end of the section; it
 *   stays in reach below the header while editing.
 * - fieldLabel: the accessible name of a text box ("Title", or "Title: Cat litter" for a card's text).
 */
import type { ComponentProps } from 'react'
import { cn } from 'cn'
import type { SectionContent, SectionText } from '@/api'
import { EditableText, InlineEditBar, MIN_WIDTH, PropBar, useInlineDraft, type TextValue } from '@/components/InlineEditor'
import { FONTS, SIZE_STEPS } from '@/config'
import type { Dictionary } from '@/i18n/he'
import { useI18n, type Locale } from '@/i18n'

/** The props sectionFields gives one EditableText (the caller adds `as`, classes, `multiline`, ...). */
export type EditableField = Pick<ComponentProps<typeof EditableText>, 'value' | 'editing' | 'onChange' | 'selected' | 'onSelect' | 'label' | 'locale' | 'placeholder' | 'resizable'>

/** The useInlineDraft state of a section with the text keys Key. */
type InlineDraft<Key extends string> = ReturnType<typeof useInlineDraft<Key>>

/** A text in the site's own typography: words only. */
const unstyled = (text: string): TextValue => ({ text, font: 'default', size: 'md' })

/**
 * Works out what one text shows in a language: the saved value, else the default.
 * @param saved - The text's saved content, if any.
 * @param locale - The language.
 * @param fallback - The dictionary's words for this text.
 * @returns The words, font ("default" when unset), size ("md" when unset) and width (undefined = full, also for a
 *   stored value outside MIN_WIDTH-99).
 */
export function resolveText(saved: SectionText | undefined, locale: Locale, fallback: string): TextValue {
  // Unknown keys (e.g. a font removed from FONTS since it was saved) fall back too.
  const font = saved?.font?.[locale]
  const size = saved?.size?.[locale]
  const width = saved?.width?.[locale]
  return {
    text: saved?.text?.[locale]?.trim() || fallback,
    font: font && font in FONTS ? font : 'default',
    size: size && SIZE_STEPS.includes(size) ? size : 'md',
    ...(typeof width === 'number' && width >= MIN_WIDTH && width < 100 && { width }),
  }
}

/**
 * Sets or removes one language's value of a per-language map.
 * @param values - The saved map, e.g. { he: "...", en: "..." }.
 * @param locale - The language to set.
 * @param value - The new value; '' removes it (the built-in one shows again).
 * @returns The new map.
 */
export function putLocale<T>(values: Partial<Record<Locale, T>> | undefined, locale: Locale, value: T | ''): Partial<Record<Locale, T>> {
  const next = { ...values }
  if (value === '') delete next[locale]
  else next[locale] = value
  return next
}

/**
 * Sets or removes one language's width of a text (no `width` map is kept once it is empty, so texts never resized
 * store none).
 * @param saved - The text's content.
 * @param locale - The language to set.
 * @param width - The new width in percent; undefined = the full width (removed).
 * @returns The text's new content.
 */
export function putWidth<T extends SectionText>(saved: T, locale: Locale, width: number | undefined): T {
  const { width: widths, ...rest } = saved
  const next = putLocale(widths, locale, width ?? '')
  return (Object.keys(next).length > 0 ? { ...rest, width: next } : rest) as T
}

/** What sectionFields, sectionDraft and mergeSection need to know about a section's texts. */
export type SectionOptions<Key extends string> = {
  /** The saved content (page_sections), or null/undefined when the section was never edited. */
  content: SectionContent | null | undefined
  /** Every text's built-in words in the page language (also the placeholder of its empty box). */
  defaults: Record<Key, string>
  /** Every text's name, for its box and the PropBar. */
  labels: Record<Key, string>
  /** The texts with a font and size of their own (the heading's); default none. */
  styled?: readonly Key[]
  /** The current words of the texts stored elsewhere (settings), by key; default none. */
  data?: Partial<Record<Key, string>>
}

/**
 * What one text shows in read mode.
 * @param options - The section (see SectionOptions).
 * @param locale - The page language.
 * @param key - The text.
 * @returns Its words, font and size.
 */
function shownText<Key extends string>({ content, defaults, styled = [], data }: SectionOptions<Key>, locale: Locale, key: Key): TextValue {
  const stored = data?.[key]
  if (stored !== undefined) return unstyled(stored)
  const shown = resolveText(content?.[key], locale, defaults[key])
  return styled.includes(key) ? shown : { ...unstyled(shown.text), ...(shown.width !== undefined && { width: shown.width }) }
}

/**
 * The editor's starting values in the page language: the saved words ('' when not saved, so the box shows the
 * built-in words as its placeholder) with the font and size shown now; a data text starts from its current value.
 * @param options - The section (see SectionOptions).
 * @param locale - The page language.
 * @returns The draft, one value per key of `defaults`, in their order.
 */
export function sectionDraft<Key extends string>(options: SectionOptions<Key>, locale: Locale): Record<Key, TextValue> {
  const keys = Object.keys(options.defaults) as Key[]
  return Object.fromEntries(
    keys.map((key) => {
      const shown = shownText(options, locale, key)
      const stored = options.data?.[key]
      return [key, stored !== undefined ? shown : { ...shown, text: options.content?.[key]?.text?.[locale] ?? '' }]
    }),
  ) as Record<Key, TextValue>
}

/**
 * Writes one language's inline edit into the section's content; the other languages and texts keep their values.
 * @param options - The section (see SectionOptions); its data texts are left out.
 * @param locale - The edited language.
 * @param draft - The edited texts (an empty text is removed, so the built-in one shows).
 * @returns The new content to save. Every text stores its words and width (none = the full width), a styled text
 *   its font and size too.
 */
export function mergeSection<Key extends string>(options: SectionOptions<Key>, locale: Locale, draft: Partial<Record<Key, TextValue>>): SectionContent {
  const { content, styled = [] } = options
  const data: Partial<Record<Key, string>> = options.data ?? {}
  const next: SectionContent = { ...content }
  for (const key of Object.keys(options.defaults) as Key[]) {
    const value = draft[key]
    if (!value || data[key] !== undefined) continue
    const saved = content?.[key]
    next[key] = putWidth({
      ...saved,
      text: putLocale(saved?.text, locale, value.text.trim()),
      ...(styled.includes(key) && { font: putLocale(saved?.font, locale, value.font), size: putLocale(saved?.size, locale, value.size) }),
    }, locale, value.width)
  }
  return next
}

/**
 * What a section renders from its edit state (see the file header).
 * @param inline - The section's useInlineDraft state (its keys may include more texts, e.g. the FAQ's questions).
 * @param options - The section's fixed texts (see SectionOptions).
 * @param locale - The page language.
 * @returns `field(key)` (the EditableText props of a text), `shown(key)` (its read-mode value), `draft()` (the
 *   starting values, for inline.start) and `propBar` (the PropBar's props, or null when no styled text is selected).
 */
export function sectionFields<All extends string, Key extends All>(inline: InlineDraft<All>, options: SectionOptions<Key>, locale: Locale) {
  const { labels, defaults, styled = [] } = options
  const data: Partial<Record<Key, string>> = options.data ?? {}
  /**
   * What one text shows in read mode.
   * @param key - The text.
   * @returns Its value.
   */
  const shown = (key: Key) => shownText(options, locale, key)
  /**
   * The props of one text's EditableText.
   * @param key - The text.
   * @returns Its value (the draft's while editing), edit handlers, name, placeholder and whether its width can be
   *   dragged (not for a data text).
   */
  const field = (key: Key): EditableField => ({
    value: inline.draft?.[key] ?? shown(key),
    editing: inline.editing,
    onChange: (change) => inline.change(key, change),
    selected: inline.active === key,
    onSelect: () => inline.select(key),
    label: labels[key],
    locale,
    placeholder: data[key] === undefined ? defaults[key] : undefined,
    resizable: data[key] === undefined,
  })
  const styledLabels = Object.fromEntries(styled.map((key) => [key, labels[key]])) as Partial<Record<All, string>>
  return { field, shown, draft: () => sectionDraft(options, locale), propBar: inline.propBar(styledLabels) }
}

/**
 * The edit state of a section with a fixed set of texts (see the file header).
 * @param options - The section's texts (see SectionOptions), plus `onSave`: stores the new content (and, from the
 *   draft, the data texts); given = staff can edit. It may throw InlineEditError to refuse a save itself.
 * @returns `field(key)`, `shown(key)`, `editing`, `formProps` for the section's <form>, and `edit` for its
 *   SectionEditBar (null without onSave: no bar).
 */
export function useEditableSection<Key extends string>(
  options: SectionOptions<Key> & { onSave?: (content: SectionContent, draft: Record<Key, TextValue>) => Promise<unknown> },
) {
  const { locale } = useI18n()
  const { onSave } = options
  const inline = useInlineDraft<Key>(onSave && ((draft) => onSave(mergeSection(options, locale, draft), draft)))
  const fields = sectionFields<Key, Key>(inline, options, locale)
  return {
    field: fields.field,
    shown: fields.shown,
    editing: inline.editing,
    formProps: inline.formProps,
    edit: onSave ? { bar: { ...inline.bar, onEdit: () => inline.start(fields.draft()) }, propBar: fields.propBar } : null,
  }
}

/** What SectionEditBar needs: the section's InlineEditBar props (with onEdit) and PropBar props. */
export type SectionEdit = {
  bar: Omit<ComponentProps<typeof InlineEditBar>, 'label' | 'tone' | 'className'>
  propBar: Omit<ComponentProps<typeof PropBar>, 'locale'> | null
}

/**
 * A section's edit controls: "Edit on page", then Save and Cancel with the PropBar beside them. While editing, the
 * row sticks below the header so Save stays in reach however long the section is.
 * @param props.edit - The section's edit state (`edit` of useEditableSection).
 * @param props.label - The section's name, for "Edit on page: <section>".
 * @param props.tone - "light" (default, a white or grey section) or "dark" (a black one): the Cancel button's look.
 * @param props.className - Extra classes; give the section's background (e.g. "bg-white"), which the sticky row
 *   needs to cover the content scrolling under it.
 * @returns The controls.
 */
export function SectionEditBar({ edit, label, tone = 'light', className }: { edit: SectionEdit; label: string; tone?: 'light' | 'dark'; className?: string }) {
  const { locale } = useI18n()
  const { bar, propBar } = edit
  return (
    <div className={cn('mb-6 flex flex-wrap items-start justify-end gap-3', bar.editing && 'sticky top-24 z-20 py-3', className)}>
      <InlineEditBar {...bar} label={label} tone={tone} />
      {propBar && <PropBar {...propBar} locale={locale} />}
    </div>
  )
}

/**
 * The accessible name of a text box.
 * @param t - The dictionary.
 * @param field - What the text is, e.g. "title".
 * @param item - The card or list item it belongs to (its built-in name), if any.
 * @returns E.g. "Title", or "Title: Cat litter".
 */
export function fieldLabel(t: Dictionary, field: keyof Dictionary['inlineEdit']['fields'], item?: string): string {
  const name = t.inlineEdit.fields[field]
  return item ? t.inlineEdit.fieldOf.replace('{field}', name).replace('{item}', item) : name
}
