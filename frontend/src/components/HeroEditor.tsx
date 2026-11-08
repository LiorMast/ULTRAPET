/**
 * HeroEditor.tsx — The staff's "Edit both languages" button and its dialog: the hero's title (white words + red word),
 * tagline and description, each with its font and size, side by side in Hebrew and English.
 *
 * The home page shows it in the hero's `editor` slot to signed-in staff only. A text left empty shows the
 * built-in one (its dictionary text is the placeholder); fonts come from FONTS (Hebrew texts only get fonts with
 * Hebrew letters) and sizes from SIZE_STEPS in src/config.ts. Saving hands the whole content to `onSave` (the page
 * stores it in page_sections through the staff API); a refusal is shown above the buttons.
 */
import { useId, useRef, useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { cn } from 'cn'
import { ApiError, type FontKey, type HeroContent, type SectionText, type SizeStep } from '@/api'
import { resolveHero } from '@/components/Hero'
import { errorMessage, INPUT_CLASS, LABEL_CLASS } from '@/components/RecordDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FONTS, fontsFor, SIZE_STEPS } from '@/config'
import { dictionaryFor, ENABLED_LOCALES, LOCALES, useI18n, type Locale } from '@/i18n'

/** The editable hero texts, in form order. */
const BLOCKS = ['title', 'tagline', 'description'] as const
type Block = (typeof BLOCKS)[number]

/** One text of the form in one language; `text` (and the title's `accent`) are '' while the built-in one is used. */
type DraftText = { text: string; accent?: string; font: FontKey; size: SizeStep }

/** The form's values: every text in every language. */
type Draft = Record<Block, Partial<Record<Locale, DraftText>>>

/**
 * Builds the form's starting values: the saved words (empty when not saved) and the font and size shown now.
 * @param content - The saved hero content, or null.
 * @returns The draft.
 */
function toDraft(content: HeroContent | null): Draft {
  const draft: Draft = { title: {}, tagline: {}, description: {} }
  for (const locale of ENABLED_LOCALES) {
    const shown = resolveHero(content, locale)
    for (const block of BLOCKS) {
      draft[block][locale] = { text: content?.[block]?.text?.[locale] ?? '', font: shown[block].font, size: shown[block].size }
    }
    draft.title[locale]!.accent = content?.title?.accent?.[locale] ?? ''
  }
  return draft
}

/**
 * Turns the form's values into the content to save; empty texts are left out, so the built-in ones show.
 * @param draft - The form's values.
 * @param from - The saved content the form started from (its widths are kept).
 * @returns The hero content.
 */
function fromDraft(draft: Draft, from: HeroContent | null): HeroContent {
  const content: HeroContent = {}
  for (const block of BLOCKS) {
    const saved: SectionText & { accent?: Partial<Record<Locale, string>> } = { text: {}, font: {}, size: {} }
    // The dialog does not edit widths (they are dragged on the page): the saved ones are kept as they are.
    const width = from?.[block]?.width
    if (width && Object.keys(width).length > 0) saved.width = width
    if (block === 'title') saved.accent = {}
    for (const locale of ENABLED_LOCALES) {
      const value = draft[block][locale]!
      if (value.text.trim()) saved.text![locale] = value.text.trim()
      if (value.accent?.trim()) saved.accent![locale] = value.accent.trim()
      saved.font![locale] = value.font
      saved.size![locale] = value.size
    }
    content[block] = saved
  }
  return content
}

/**
 * The staff's Edit button of the hero and its dialog.
 * @param props.content - The saved hero content, or null when it was never edited.
 * @param props.onSave - Stores the new content; rejects with an ApiError when the server refuses it.
 * @returns The button, its dialog and a status line that announces the save.
 */
export function HeroEditor({ content, onSave }: { content: HeroContent | null; onSave: (content: HeroContent) => Promise<unknown> }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const button = useRef<HTMLButtonElement>(null)

  /**
   * Puts the keyboard focus back on the Edit button when the dialog closes (Radix does this only for its own trigger).
   * @param event - Radix's close-autofocus event; its default is replaced.
   */
  const handleCloseFocus = (event: Event) => {
    event.preventDefault()
    button.current?.focus()
  }

  return (
    <>
      <Button ref={button} size="sm" onClick={() => setOpen(true)}>
        <Pencil size={14} aria-hidden="true" />
        {t.hero.edit.button}
      </Button>
      <p role="status" className="sr-only">
        {status}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t.admin.close} className="max-w-3xl" onCloseAutoFocus={handleCloseFocus}>
          {/* Mounted only while open, so every opening starts from the saved content. */}
          {open && (
            <HeroEditForm
              content={content}
              onSave={async (next) => {
                await onSave(next)
                setOpen(false)
                setStatus(t.admin.saved)
              }}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * The dialog's title block and form.
 * @param props.content - The saved hero content, or null.
 * @param props.onSave - Saves the content (rejects with ApiError on refusal).
 * @param props.onCancel - Closes without saving.
 * @returns The header, the fields and the buttons.
 */
function HeroEditForm({ content, onSave, onCancel }: { content: HeroContent | null; onSave: (content: HeroContent) => Promise<void>; onCancel: () => void }) {
  const { t } = useI18n()
  const e = t.hero.edit
  const [draft, setDraft] = useState(() => toDraft(content))
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  const blockLabel: Record<Block, string> = { title: e.titleText, tagline: e.tagline, description: e.descriptionText }

  /**
   * Changes one field of one text in one language.
   * @param block - The text.
   * @param locale - The language.
   * @param change - The changed field(s).
   */
  const update = (block: Block, locale: Locale, change: Partial<DraftText>) =>
    setDraft((current) => ({ ...current, [block]: { ...current[block], [locale]: { ...current[block][locale]!, ...change } } }))

  /**
   * Saves the form; shows the server's reason when it refuses.
   * @param event - The form submit event.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    setPending(true)
    try {
      await onSave(fromDraft(draft, content))
    } catch (error) {
      setFormError(errorMessage(error instanceof ApiError ? error.code : undefined, t))
      setPending(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{e.title}</DialogTitle>
        <DialogDescription>{e.description}</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
        <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-5">
          {BLOCKS.map((block) => (
            <fieldset key={block} className="border-b border-neutral-150 pb-6 last:border-b-0 last:pb-0">
              <legend className="mb-3 font-heading text-sm font-bold text-brand-charcoal">{blockLabel[block]}</legend>
              <div className="grid gap-6 sm:grid-cols-2">
                {ENABLED_LOCALES.map((locale) => (
                  <LanguageFields key={locale} block={block} locale={locale} value={draft[block][locale]!} onChange={(change) => update(block, locale, change)} />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <DialogFooter>
          {formError && (
            <p role="alert" className="text-sm font-medium text-brand-red sm:me-auto sm:self-center">
              {formError}
            </p>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t.admin.cancel}
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {t.admin.save}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

/**
 * The fields of one hero text in one language: its words (the title has two inputs), font and size.
 * @param props.block - Which text.
 * @param props.locale - The language; its inputs take its direction and language.
 * @param props.value - The current values.
 * @param props.onChange - Called with the changed field(s).
 * @returns A fieldset named after the language.
 */
function LanguageFields({ block, locale, value, onChange }: { block: Block; locale: Locale; value: DraftText; onChange: (change: Partial<DraftText>) => void }) {
  const { t } = useI18n()
  const e = t.hero.edit
  const id = useId()
  const builtIn = dictionaryFor(locale).hero
  const placeholder = { title: builtIn.title, tagline: builtIn.tagline, description: builtIn.description }[block].trim()
  const text = { dir: LOCALES[locale].dir, lang: locale, className: INPUT_CLASS }

  return (
    <fieldset>
      <legend className={cn(LABEL_CLASS, 'mb-1 text-brand-charcoal')}>{LOCALES[locale].nativeName}</legend>
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-text`} className={LABEL_CLASS}>
            {block === 'title' ? e.titleMain : e.text}
          </label>
          {block === 'description' ? (
            <textarea id={`${id}-text`} rows={4} value={value.text} placeholder={placeholder} onChange={(event) => onChange({ text: event.target.value })} {...text} />
          ) : (
            <input id={`${id}-text`} type="text" value={value.text} placeholder={placeholder} onChange={(event) => onChange({ text: event.target.value })} {...text} />
          )}
        </div>
        {block === 'title' && (
          <div>
            <label htmlFor={`${id}-accent`} className={LABEL_CLASS}>
              {e.titleAccent}
            </label>
            <input id={`${id}-accent`} type="text" value={value.accent} placeholder={builtIn.titleAccent} onChange={(event) => onChange({ accent: event.target.value })} {...text} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${id}-font`} className={LABEL_CLASS}>
              {e.font}
            </label>
            <select id={`${id}-font`} value={value.font} onChange={(event) => onChange({ font: event.target.value as FontKey })} className={INPUT_CLASS}>
              {fontsFor(locale).map((font) => (
                <option key={font} value={font}>
                  {font === 'default' ? t.inlineEdit.siteFont : FONTS[font].name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-size`} className={LABEL_CLASS}>
              {e.size}
            </label>
            <select id={`${id}-size`} value={value.size} onChange={(event) => onChange({ size: event.target.value as SizeStep })} className={INPUT_CLASS}>
              {SIZE_STEPS.map((size) => (
                <option key={size} value={size}>
                  {t.inlineEdit.sizes[size]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </fieldset>
  )
}
