/**
 * PrivateLabel.tsx — The Private Label section (anchor #private-label): a centred heading and the process of a private
 * label project as a flow of steps (FlowchartList + FlowchartCard: an icon medallion, a title, a description and the
 * step's number, with chevrons between the steps), then a call to action and a link to the /private-label page. Used
 * by the home page (routes/index.tsx, editable by staff) and, read-only and without the links, by the /private-label
 * page (`variant="page"`), so both always show the same steps.
 *
 * - The steps are saved in page_sections row "private_label_steps" ({ steps: FlowStep[] }, in order); never saved =
 *   the five built-in steps (PRIVATE_LABEL_STEPS in config.ts: idea, design, development, production, shipping),
 *   whose texts come from the dictionaries (t.privateLabel.steps). A built-in step's missing text shows the
 *   dictionary's; a step with no title in the page's language is not shown in it (a page never mixes languages).
 * - The heading's texts are saved in row "private_label" (EditableSection: words, font and size per language).
 * - With `onSave`, staff edit the section in place, in the page's language (InlineEditor, like the FAQ): "Edit on page"
 *   stacks the steps (room for the controls) with each step's title and description in boxes, an icon menu, "Earlier" /
 *   "Later" to reorder it, Delete, and a picture upload (ImageUploadField, folder "private-label": a step's picture is
 *   shown in its medallion instead of the icon; the step stores the object key `image`, the server answers its
 *   `imageUrl`); "Add a step" appends one. Save waits for running uploads (it says so instead of saving). A step with a description but no title is refused
 *   before saving; a new step left without any title is dropped. One Save stores the steps, then the heading.
 */
import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Link, linkOptions } from '@tanstack/react-router'
import { cn } from 'cn'
import type { FlowStep, SectionContent } from '@/api'
import { mergeSection, SectionEditBar, sectionFields, type SectionOptions } from '@/components/EditableSection'
import { FLOWCHART_TEXT_CLASS, FLOWCHART_TITLE_CLASS, FlowchartCard, FlowchartList } from '@/components/Flowchart'
import { EditableText, InlineEditError, useInlineDraft, type TextValue } from '@/components/InlineEditor'
import { ImageUploadField } from '@/components/ImageUploadField'
import { HEADING_KEYS, headingLabels, SectionHeading, type HeadingKey } from '@/components/SectionHeading'
import { TextLink } from '@/components/TextLink'
import { Button } from '@/components/ui/button'
import { inputVariants } from '@/components/ui/input'
import { DEFAULT_STEP_ICON, PRIVATE_LABEL_STEPS, STEP_ICONS, type StepIconKey } from '@/config'
import { useI18n, type Locale } from '@/i18n'
import type { Dictionary } from '@/i18n/he'

/** A text of the steps' draft: "<entry>:title" or "<entry>:text" (the entry = the step's id, or NEW_ENTRY + a number). */
type StepKey = `${string}:${'title' | 'text'}`

/** The steps' part of the draft, in flow order. */
type StepDraft = Record<StepKey, TextValue>

/** One language's texts of a step, e.g. { he: '...', en: '...' }. */
type Texts = Partial<Record<Locale, string>>

/** The start of the entry of a step added in the editor (saved steps use their id). */
const NEW_ENTRY = 'new-'

/** A step as one language shows it. */
export type ShownStep = { id: string; icon: StepIconKey; imageUrl?: string; title: string; text: string }

/** A step's uploaded picture while editing: its storage key (saved) and URL (the preview); null = none. */
type Picture = { key: string; url: string } | null

/**
 * What a step's medallion shows: its picture, else its icon.
 * @param props.icon - The step's icon key.
 * @param props.imageUrl - Its picture's URL, if any.
 * @returns The <img> (decorative: the title names the step) or the icon.
 */
function StepMedia({ icon, imageUrl }: { icon: StepIconKey; imageUrl?: string }) {
  const Icon = STEP_ICONS[icon]
  return imageUrl ? <img src={imageUrl} alt="" width={80} height={80} loading="lazy" decoding="async" /> : <Icon />
}

/**
 * One text of the draft. Step texts keep the flow's typography, so their font and size never change.
 * @param text - The words.
 * @returns The draft value.
 */
const plain = (text: string): TextValue => ({ text, font: 'default', size: 'md' })

/**
 * The steps' part of a draft that also holds the heading's texts.
 * @param draft - The whole draft.
 * @returns The step texts, in order.
 */
const stepsOf = (draft: Partial<Record<string, TextValue>>): StepDraft =>
  Object.fromEntries(Object.entries(draft).filter(([key]) => /:(title|text)$/.test(key))) as StepDraft

/**
 * The steps of the draft in flow order (the draft keeps its keys in list order).
 * @param draft - The steps' draft.
 * @returns Their entries, e.g. ["idea", "new-1"].
 */
const draftEntries = (draft: StepDraft): string[] => [...new Set(Object.keys(draft).map((key) => key.slice(0, key.lastIndexOf(':'))))]

/**
 * The built-in texts of a step (one of PRIVATE_LABEL_STEPS), in the dictionary's language.
 * @param t - The dictionary.
 * @param id - The step's id.
 * @returns Its title and description, or undefined for a step staff added.
 */
function builtIn(t: Dictionary, id: string): { title: string; text: string } | undefined {
  const steps: Partial<Record<string, { title: string; text: string }>> = t.privateLabel.steps
  return Object.hasOwn(steps, id) ? steps[id] : undefined
}

/**
 * A stored icon key, checked.
 * @param icon - The key saved with a step.
 * @returns It when it is one of STEP_ICONS, else DEFAULT_STEP_ICON.
 */
const iconKey = (icon: string): StepIconKey => (Object.hasOwn(STEP_ICONS, icon) ? (icon as StepIconKey) : DEFAULT_STEP_ICON)

/**
 * The built-in steps, as they are before staff save any (texts from the dictionaries).
 * @returns The steps, in order.
 */
export const defaultSteps = (): FlowStep[] => PRIVATE_LABEL_STEPS.map(({ id, icon }) => ({ id, icon }))

/**
 * The steps one language shows: the saved texts, else a built-in step's dictionary texts; a step without a title in
 * the language is left out.
 * @param steps - Every step, in order.
 * @param t - The dictionary of the page language.
 * @param locale - The page language.
 * @returns The shown steps.
 */
export function shownSteps(steps: FlowStep[], t: Dictionary, locale: Locale): ShownStep[] {
  return steps.flatMap((step) => {
    const fallback = builtIn(t, step.id)
    const title = step.title?.[locale]?.trim() || fallback?.title || ''
    const text = step.text?.[locale]?.trim() || fallback?.text || ''
    return title ? [{ id: step.id, icon: iconKey(step.icon), imageUrl: step.image ? step.imageUrl : undefined, title, text }] : []
  })
}

/**
 * Finds the first step of the draft with a description but no title.
 * @param draft - The steps' draft.
 * @returns The key of its empty title, or null.
 */
function missingTitle(draft: StepDraft): StepKey | null {
  for (const entry of draftEntries(draft)) {
    if (!draft[`${entry}:title`].text.trim() && draft[`${entry}:text`].text.trim()) return `${entry}:title`
  }
  return null
}

/**
 * Turns one language's inline edit into the new list of steps; the other languages keep their texts.
 * @param saved - The steps shown before editing (saved, or the built-in ones).
 * @param locale - The edited language.
 * @param draft - The edited texts, in flow order ('' removes the language's text: a built-in step then shows the
 *   dictionary's again).
 * @param icons - Each entry's icon key.
 * @param pictures - Each entry's picture (null = none; an entry left out keeps its saved one).
 * @param t - The dictionary of the edited language (to tell built-in steps apart).
 * @param newId - Makes the id of a step added in the editor.
 * @returns The steps to save, in order; a step left with no title in any language (and not built in) is left out.
 */
export function mergeSteps(
  saved: FlowStep[],
  locale: Locale,
  draft: StepDraft,
  icons: Partial<Record<string, StepIconKey>>,
  pictures: Partial<Record<string, Picture>>,
  t: Dictionary,
  newId: () => string = () => crypto.randomUUID(),
): FlowStep[] {
  /**
   * Sets or removes this language's text.
   * @param texts - The saved texts of every language.
   * @param text - The edited text; '' removes it.
   * @returns The new texts.
   */
  const put = (texts: Texts | undefined, text: string): Texts => {
    const next = { ...texts }
    if (text) next[locale] = text
    else delete next[locale]
    return next
  }
  return draftEntries(draft).flatMap((entry) => {
    const step = saved.find((s) => s.id === entry)
    const title = put(step?.title, draft[`${entry}:title`].text.trim())
    const text = put(step?.text, draft[`${entry}:text`].text.trim())
    if (!builtIn(t, entry) && !Object.values(title).some((value) => value?.trim())) return []
    const picture = pictures[entry]
    const image = picture === undefined ? step?.image : picture?.key
    return [{ id: step?.id ?? newId(), icon: icons[entry] ?? iconKey(step?.icon ?? ''), ...(image && { image }), title, text }]
  })
}

/**
 * The Private Label section (see the file header).
 * @param props.steps - The saved steps (page_sections "private_label_steps"); null or omitted = the built-in ones.
 * @param props.content - The heading's saved texts (page_sections "private_label"); null or omitted = the dictionary's.
 * @param props.onSave - Stores the new steps and the heading's new content (rejects with an ApiError on refusal);
 *   given = staff can edit in place.
 * @param props.variant - "home" (default: with the call to action and the link to /private-label) or "page" (the
 *   /private-label page's process: without them).
 * @returns The <section>, or nothing for visitors when no step has the page language.
 */
export function PrivateLabel({
  steps,
  content,
  onSave,
  variant = 'home',
}: {
  steps?: FlowStep[] | null
  content?: SectionContent | null
  onSave?: (steps: FlowStep[], content: SectionContent) => Promise<unknown>
  variant?: 'home' | 'page'
}) {
  const { t, locale } = useI18n()
  const e = t.privateLabel.edit
  const saved = steps ?? defaultSteps()
  const shown = shownSteps(saved, t, locale)
  const texts: SectionOptions<HeadingKey> = {
    content,
    defaults: { eyebrow: t.privateLabel.eyebrow, title: t.privateLabel.title, intro: t.privateLabel.intro },
    labels: headingLabels(t),
    styled: HEADING_KEYS,
  }
  /** Each entry's icon while editing. */
  const [icons, setIcons] = useState<Partial<Record<string, StepIconKey>>>({})
  /** Each entry's picture while editing. */
  const [pictures, setPictures] = useState<Partial<Record<string, Picture>>>({})
  /** The entries whose picture is uploading right now (Save waits for them). */
  const uploading = useRef(new Set<string>())
  const inline = useInlineDraft<StepKey | HeadingKey>(
    onSave &&
      (async (all) => {
        const draft = stepsOf(all)
        const missing = missingTitle(draft)
        if (missing) throw new InlineEditError(e.missingTitle, missing)
        if (uploading.current.size) throw new InlineEditError(e.uploading)
        await onSave(mergeSteps(saved, locale, draft, icons, pictures, t), mergeSection(texts, locale, all))
      }),
  )
  const { field, draft: textsDraft, propBar } = sectionFields<StepKey | HeadingKey, HeadingKey>(inline, texts, locale)
  /** Counts the steps added in this editor, to give each a unique entry. */
  const added = useRef(0)
  /** The step just moved and the way it went, so its move button gets the focus back after the list re-renders. */
  const moved = useRef<{ entry: string; offset: -1 | 1 } | null>(null)

  // Moving a step re-inserts its card in the DOM, which drops the focus: give it back to the same button (or the other
  // one, when the step reached an end of the flow and the button it used is now disabled).
  useEffect(() => {
    const move = moved.current
    if (!move) return
    moved.current = null
    const controls = document.querySelector(`[data-step-controls="${move.entry}"]`)
    const target = controls?.querySelector<HTMLButtonElement>(`[data-move="${move.offset}"]:not(:disabled)`) ?? controls?.querySelector<HTMLButtonElement>('[data-move]:not(:disabled)')
    target?.focus()
  })

  if (!shown.length && !onSave) return null

  const { draft } = inline
  const entries = draft ? draftEntries(stepsOf(draft)) : []

  /** Starts editing: the heading's texts, then every step's texts and icon in the page language. */
  const startEditing = () => {
    setIcons(Object.fromEntries(saved.map((step) => [step.id, iconKey(step.icon)])))
    setPictures(Object.fromEntries(saved.map((step) => [step.id, step.image && step.imageUrl ? { key: step.image, url: step.imageUrl } : null])))
    uploading.current.clear()
    const stepTexts = Object.fromEntries(
      saved.flatMap((step) => {
        const fallback = builtIn(t, step.id)
        return [
          [`${step.id}:title`, plain(step.title?.[locale] ?? fallback?.title ?? '')],
          [`${step.id}:text`, plain(step.text?.[locale] ?? fallback?.text ?? '')],
        ]
      }),
    ) as StepDraft
    inline.start({ ...textsDraft(), ...stepTexts })
  }

  /** Appends an empty step (with the default icon) and focuses its title box. */
  const addStep = () => {
    added.current += 1
    const entry = `${NEW_ENTRY}${added.current}`
    setIcons((current) => ({ ...current, [entry]: DEFAULT_STEP_ICON }))
    setPictures((current) => ({ ...current, [entry]: null }))
    inline.add({ [`${entry}:title`]: plain(''), [`${entry}:text`]: plain('') })
  }

  /**
   * Removes a step and focuses the next one's title box (the previous one's at the end; "Add a step" when none is left).
   * @param entry - The step's entry.
   */
  const removeStep = (entry: string) => {
    uploading.current.delete(entry)
    const index = entries.indexOf(entry)
    const next = entries[index + 1] ?? entries[index - 1]
    inline.remove([`${entry}:title`, `${entry}:text`], next === undefined ? undefined : `${next}:title`)
  }

  /**
   * Moves a step one place earlier or later in the flow.
   * @param entry - The step's entry.
   * @param offset - -1 = earlier, 1 = later.
   */
  const moveStep = (entry: string, offset: -1 | 1) => {
    const order = [...entries]
    const index = order.indexOf(entry)
    ;[order[index], order[index + offset]] = [order[index + offset], order[index]]
    moved.current = { entry, offset }
    inline.reorder(order.flatMap((step): StepKey[] => [`${step}:title`, `${step}:text`]))
  }

  /**
   * The placeholder of an empty box: the text in another language, as a hint of what to translate.
   * @param texts - The saved texts of every language, if the step is saved.
   * @param prompt - The generic placeholder, when no other language has words.
   * @returns The placeholder.
   */
  const hint = (texts: Texts | undefined, prompt: string) => Object.entries(texts ?? {}).find(([language, text]) => language !== locale && text?.trim())?.[1] ?? prompt

  return (
    <section id="private-label" aria-labelledby="private-label-title" className="bg-neutral-50 px-6 py-20 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-7xl">
        {onSave && (
          <SectionEditBar edit={{ bar: { ...inline.bar, onEdit: startEditing }, propBar }} label={t.privateLabel.eyebrow} className="bg-neutral-50" />
        )}
        <form {...inline.formProps}>
          <SectionHeading id="private-label-title" edit={field} className="mx-auto text-center" />

          {draft ? (
            <div className="mx-auto mt-14 max-w-3xl">
              {entries.length > 0 && (
                <FlowchartList orientation="vertical" label={t.privateLabel.processLabel}>
                  {entries.map((entry, i) => {
                    const step = saved.find((s) => s.id === entry)
                    const title: StepKey = `${entry}:title`
                    const text: StepKey = `${entry}:text`
                    const n = String(i + 1)
                    return (
                      <FlowchartCard
                        key={entry}
                        media={<StepMedia icon={icons[entry] ?? DEFAULT_STEP_ICON} imageUrl={pictures[entry]?.url} />}
                        title={
                          <EditableText
                            as="h3"
                            wrap
                            editing
                            value={draft[title]}
                            onChange={(change) => inline.change(title, change)}
                            selected={inline.active === title}
                            onSelect={() => inline.select(title)}
                            label={e.stepTitle.replace('{n}', n)}
                            locale={locale}
                            placeholder={hint(step?.title, e.titlePlaceholder)}
                            className={FLOWCHART_TITLE_CLASS}
                          />
                        }
                        description={
                          <EditableText
                            multiline
                            editing
                            value={draft[text]}
                            onChange={(change) => inline.change(text, change)}
                            selected={inline.active === text}
                            onSelect={() => inline.select(text)}
                            label={e.stepText.replace('{n}', n)}
                            locale={locale}
                            placeholder={hint(step?.text, e.textPlaceholder)}
                            className={cn('mt-3', FLOWCHART_TEXT_CLASS)}
                          />
                        }
                        actions={
                          <div className="w-full">
                            <div data-step-controls={entry} className="flex flex-wrap items-center gap-2">
                              <label className="flex items-center gap-2 text-xs font-semibold text-brand-charcoal">
                                <span aria-hidden="true">{e.icon}</span>
                                <select
                                  aria-label={e.iconOf.replace('{n}', n)}
                                  value={icons[entry] ?? DEFAULT_STEP_ICON}
                                  onChange={(event) => setIcons((current) => ({ ...current, [entry]: event.target.value as StepIconKey }))}
                                  className={cn(inputVariants({ size: 'compact' }), 'h-9 w-auto')}
                                >
                                  {(Object.keys(STEP_ICONS) as StepIconKey[]).map((key) => (
                                    <option key={key} value={key}>
                                      {t.privateLabel.icons[key]}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <Button type="button" variant="action" size="action" data-move="-1" disabled={i === 0} aria-label={e.moveEarlierOf.replace('{n}', n)} onClick={() => moveStep(entry, -1)}>
                                <ArrowUp aria-hidden="true" />
                                {e.moveEarlier}
                              </Button>
                              <Button
                                type="button"
                                variant="action"
                                size="action"
                                data-move="1"
                                disabled={i === entries.length - 1}
                                aria-label={e.moveLaterOf.replace('{n}', n)}
                                onClick={() => moveStep(entry, 1)}
                              >
                                <ArrowDown aria-hidden="true" />
                                {e.moveLater}
                              </Button>
                              <Button type="button" variant="actionDanger" size="action" aria-label={t.admin.deleteRow.replace('{name}', e.step.replace('{n}', n))} onClick={() => removeStep(entry)}>
                                <Trash2 aria-hidden="true" />
                                {t.admin.delete}
                              </Button>
                            </div>
                            <fieldset className="mt-4">
                              <legend className="text-xs font-semibold text-brand-charcoal">{e.picture}</legend>
                              <ImageUploadField
                                id={`private-label-picture-${entry}`}
                                folder="private-label"
                                item={e.step.replace('{n}', n)}
                                value={pictures[entry]?.url ?? ''}
                                onChange={(url, key) => setPictures((current) => ({ ...current, [entry]: url && key ? { key, url } : null }))}
                                onBusyChange={(busy) => (busy ? uploading.current.add(entry) : uploading.current.delete(entry))}
                              />
                            </fieldset>
                          </div>
                        }
                      />
                    )
                  })}
                </FlowchartList>
              )}
              {/* data-focus-fallback: the focus lands here when the last step is deleted. */}
              <Button type="button" variant="outline" size="sm" className="mt-10" data-focus-fallback onClick={addStep}>
                <Plus aria-hidden="true" />
                {e.add}
              </Button>
            </div>
          ) : shown.length ? (
            <FlowchartList label={t.privateLabel.processLabel} className="mt-16">
              {shown.map((step) => (
                <FlowchartCard key={step.id} media={<StepMedia icon={step.icon} imageUrl={step.imageUrl} />} title={step.title} description={step.text} />
              ))}
            </FlowchartList>
          ) : (
            <p className="mt-10 text-center text-brand-charcoal-muted">{e.empty}</p>
          )}
        </form>

        {variant === 'home' && (
          // While editing, the links are shown but not followed: the page stays in edit mode.
          <div className={cn('mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-4', inline.editing && 'pointer-events-none')}>
            <Button asChild>
              <Link to="/" hash="contact">{t.privateLabel.cta}</Link>
            </Button>
            <TextLink link={linkOptions({ to: '/private-label' })}>{t.privateLabel.learnMore}</TextLink>
          </div>
        )}
      </div>
    </section>
  )
}
