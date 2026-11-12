/**
 * Faq.tsx — The home page FAQ section (anchor #faq): the questions business customers ask most, as an accordion
 * (ui/accordion.tsx), next to a "still have a question?" box that links to the Contact section. Used by
 * routes/index.tsx, which loads the questions from the API (table faq_items, GET /api/faq) and puts the shown ones in
 * the page head as schema.org FAQPage data too (seo.ts, through shownFaq). The heading and the contact box come from
 * the dictionaries (t.faq).
 *
 * - A question shows in a language only when both its question and its answer have text in that language
 *   (shownFaq), so a page never mixes languages. Visitors get no section at all when no question has their language.
 * - With `onSave`, staff edit the questions in place, in the page's language (InlineEditor): "Edit on page" turns the
 *   accordion into a numbered list of boxes (a wrapping box per question, a multi-line box per answer) with a Delete
 *   button on each and "Add a question" below, as many as they want; one Save stores the whole list (mergeFaq). A
 *   question with only one of its two texts is refused before saving and its empty box gets the focus; a question
 *   left with no text in any language is deleted. An empty box shows the question's text in another language as its
 *   placeholder, so staff see what to translate. The questions keep the section's typography (no font or size bar).
 *   The same edit mode also edits the section's own texts (EditableSection, saved in page_sections "faq"): the
 *   heading's words, font and size (the PropBar shows while one of them is selected) and the contact box's title and
 *   text (words only; its button keeps its label). One Save stores the list, then the texts.
 */
import { useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Plus, Trash2 } from 'lucide-react'
import type { FaqItem, FaqItemInput, SectionContent } from '@/api'
import { fieldLabel, mergeSection, SectionEditBar, sectionFields, type SectionOptions } from '@/components/EditableSection'
import { EditableText, InlineEditError, useInlineDraft, type TextValue } from '@/components/InlineEditor'
import { HEADING_KEYS, headingLabels, SectionHeading, type HeadingKey } from '@/components/SectionHeading'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { useI18n, type Locale } from '@/i18n'

/**
 * A text of the editor's draft: "<entry>:question" or "<entry>:answer", where the entry is the question's id, or
 * NEW_ENTRY plus a number for a question added in the editor.
 */
type FaqKey = `${string}:${'question' | 'answer'}`

/** The section's own texts (page_sections "faq"): the heading's and the contact box's. */
type TextKey = HeadingKey | 'moreTitle' | 'moreText'

/** The editor's draft: both texts of every question, in list order. */
type FaqDraft = Record<FaqKey, TextValue>

/** The questions' part of a draft that also holds the section's own texts. */
const questionsOf = (draft: Partial<Record<string, TextValue>>): FaqDraft =>
  Object.fromEntries(Object.entries(draft).filter(([key]) => /:(question|answer)$/.test(key))) as FaqDraft

/** The start of the entry of a question added in the editor (saved questions use their id). */
const NEW_ENTRY = 'new-'

/** A question as one language shows it. */
export type ShownFaqItem = { id: string; question: string; answer: string }

/** One language's texts of a question or an answer, e.g. { he: '...', en: '...' }. */
type Texts = Partial<Record<Locale, string>>

/**
 * The questions a language shows: those with both a question and an answer in it.
 * @param items - Every question, in display order.
 * @param locale - The page language.
 * @returns The shown questions with their texts in that language, trimmed.
 */
export function shownFaq(items: FaqItem[], locale: Locale): ShownFaqItem[] {
  return items.flatMap((item) => {
    const question = item.question[locale]?.trim()
    const answer = item.answer[locale]?.trim()
    return question && answer ? [{ id: item.id, question, answer }] : []
  })
}

/**
 * One text of the draft. FAQ texts keep the section's typography, so their font and size never change.
 * @param text - The words.
 * @returns The draft value.
 */
const plain = (text: string): TextValue => ({ text, font: 'default', size: 'md' })

/**
 * The questions of the draft in list order (the draft keeps its keys in the order they were added).
 * @param draft - The draft.
 * @returns Their entries, e.g. ["<id>", "new-1"].
 */
function draftEntries(draft: FaqDraft): string[] {
  return [...new Set(Object.keys(draft).map((key) => key.slice(0, key.lastIndexOf(':'))))]
}

/**
 * The editor's starting values: every question's texts in the page language ('' where it has none).
 * @param items - Every saved question, in display order.
 * @param locale - The page language.
 * @returns The draft.
 */
function faqDraft(items: FaqItem[], locale: Locale): FaqDraft {
  return Object.fromEntries(items.flatMap((item) => [[`${item.id}:question`, plain(item.question[locale] ?? '')], [`${item.id}:answer`, plain(item.answer[locale] ?? '')]]))
}

/**
 * Finds the first question of the draft that has only one of its two texts.
 * @param draft - The edited texts.
 * @returns The key of its empty text, or null when every question has both texts or neither.
 */
function incompleteText(draft: FaqDraft): FaqKey | null {
  for (const entry of draftEntries(draft)) {
    const question = draft[`${entry}:question`].text.trim()
    const answer = draft[`${entry}:answer`].text.trim()
    if (question && !answer) return `${entry}:answer`
    if (answer && !question) return `${entry}:question`
  }
  return null
}

/**
 * Turns one language's inline edit into the new list of questions; the other languages keep their texts.
 * @param items - The saved questions.
 * @param locale - The edited language.
 * @param draft - The edited texts, in list order (an empty text removes the question's text in this language).
 * @returns The list to save, in order: a saved question keeps its id, a new one has none; a question left with no
 *   text in any language is left out (so the server deletes it).
 */
export function mergeFaq(items: FaqItem[], locale: Locale, draft: FaqDraft): FaqItemInput[] {
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
  /**
   * Whether any language has words.
   * @param texts - The texts.
   * @returns True when at least one is not blank.
   */
  const hasWords = (texts: Texts) => Object.values(texts).some((text) => text?.trim())
  return draftEntries(draft).flatMap((entry) => {
    const saved = items.find((item) => item.id === entry)
    const question = put(saved?.question, draft[`${entry}:question`].text.trim())
    const answer = put(saved?.answer, draft[`${entry}:answer`].text.trim())
    if (!hasWords(question) && !hasWords(answer)) return []
    return [saved ? { id: saved.id, question, answer } : { question, answer }]
  })
}

/**
 * The FAQ section: the heading and contact box (sticky beside the list on desktop) and one accordion panel per shown
 * question, one open at a time; for staff, the in-place editor of the questions and the section's texts (see the file
 * header).
 * @param props.items - Every question, in display order (from the API).
 * @param props.content - The section's texts staff saved (page_sections "faq"); null or omitted = the dictionary's.
 * @param props.onSave - Stores the new list of questions and the section's new content (rejects with an ApiError on
 *   refusal); given = staff can edit in place.
 * @param props.defaultOpen - The id of the question open on load; default the first shown one, null = all closed.
 * @returns The <section>, or nothing for visitors when no question has the page language.
 */
export function Faq({
  items,
  content,
  onSave,
  defaultOpen,
}: {
  items: FaqItem[]
  content?: SectionContent | null
  onSave?: (items: FaqItemInput[], content: SectionContent) => Promise<unknown>
  defaultOpen?: string | null
}) {
  const { t, locale } = useI18n()
  const e = t.faq.edit
  const shown = shownFaq(items, locale)
  const open = defaultOpen === undefined ? shown[0]?.id : (defaultOpen ?? undefined)
  const texts: SectionOptions<TextKey> = {
    content,
    defaults: { eyebrow: t.faq.eyebrow, title: t.faq.title, intro: t.faq.intro, moreTitle: t.faq.moreTitle, moreText: t.faq.moreText },
    labels: { ...headingLabels(t), moreTitle: fieldLabel(t, 'title', t.faq.moreTitle), moreText: fieldLabel(t, 'text', t.faq.moreTitle) },
    styled: HEADING_KEYS,
  }
  const inline = useInlineDraft<FaqKey | TextKey>(
    onSave &&
      (async (all) => {
        const draft = questionsOf(all)
        const missing = incompleteText(draft)
        if (missing) throw new InlineEditError(e.incomplete, missing)
        await onSave(mergeFaq(items, locale, draft), mergeSection(texts, locale, all))
      }),
  )
  const { field, draft: textsDraft, propBar } = sectionFields<FaqKey | TextKey, TextKey>(inline, texts, locale)
  /** Counts the questions added in this editor, to give each a unique entry. */
  const added = useRef(0)

  if (!shown.length && !onSave) return null

  const { draft } = inline
  const entries = draft ? draftEntries(questionsOf(draft)) : []

  /** Appends an empty question to the list and focuses its box. */
  const addQuestion = () => {
    added.current += 1
    const entry = `${NEW_ENTRY}${added.current}`
    inline.add({ [`${entry}:question`]: plain(''), [`${entry}:answer`]: plain('') })
  }

  /**
   * Removes a question from the list and focuses the next one's question box (the previous one's at the end of the
   * list; "Add a question" when none is left).
   * @param entry - The question's entry.
   */
  const removeQuestion = (entry: string) => {
    const index = entries.indexOf(entry)
    const next = entries[index + 1] ?? entries[index - 1]
    inline.remove([`${entry}:question`, `${entry}:answer`], next === undefined ? undefined : `${next}:question`)
  }

  /**
   * The placeholder of an empty box: the text in another language, as a hint of what to translate.
   * @param texts - The saved texts of every language, if the question is saved.
   * @param prompt - The generic placeholder, when no other language has words.
   * @returns The placeholder.
   */
  const hint = (texts: Texts | undefined, prompt: string) => Object.entries(texts ?? {}).find(([language, text]) => language !== locale && text?.trim())?.[1] ?? prompt

  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-white px-6 py-24 lg:px-10 lg:py-32">
      {/* One form for the whole section: the questions and the section's texts are saved together. */}
      <form {...inline.formProps} className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeading id="faq-title" edit={field} />
          <div className="mt-10 border-s-2 border-brand-red ps-6">
            <EditableText as="h3" wrap {...field('moreTitle')} className="font-display text-xl font-bold text-brand-charcoal" />
            <EditableText multiline {...field('moreText')} className="mt-2 text-brand-charcoal-muted" />
            <Button asChild className="mt-6">
              <Link to="/" hash="contact">
                {t.faq.cta}
                <ArrowRight aria-hidden="true" className="rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </div>
        <div>
          {onSave && (
            <SectionEditBar
              edit={{ bar: { ...inline.bar, onEdit: () => inline.start({ ...faqDraft(items, locale), ...textsDraft() }) }, propBar }}
              label={t.faq.eyebrow}
              className="bg-white"
            />
          )}
          {draft ? (
            <div>
              <ol>
                {entries.map((entry, i) => {
                  const saved = items.find((item) => item.id === entry)
                  const question: FaqKey = `${entry}:question`
                  const answer: FaqKey = `${entry}:answer`
                  const label = e.question.replace('{n}', String(i + 1))
                  return (
                    <li key={entry} className="flex items-start gap-6 border-b border-neutral-200 py-6 first:border-t">
                      <div className="min-w-0 flex-1 space-y-4">
                        <EditableText
                          wrap
                          editing
                          value={draft[question]}
                          onChange={(change) => inline.change(question, change)}
                          selected={inline.active === question}
                          onSelect={() => inline.select(question)}
                          label={label}
                          locale={locale}
                          placeholder={hint(saved?.question, e.questionPlaceholder)}
                          className="text-base font-semibold text-brand-charcoal lg:text-lg"
                        />
                        <EditableText
                          multiline
                          editing
                          value={draft[answer]}
                          onChange={(change) => inline.change(answer, change)}
                          selected={inline.active === answer}
                          onSelect={() => inline.select(answer)}
                          label={e.answer.replace('{n}', String(i + 1))}
                          locale={locale}
                          placeholder={hint(saved?.answer, e.answerPlaceholder)}
                          className="text-brand-charcoal-muted"
                        />
                      </div>
                      <Button type="button" variant="ghost" size="xs" aria-label={t.admin.deleteRow.replace('{name}', label)} onClick={() => removeQuestion(entry)}>
                        <Trash2 aria-hidden="true" />
                        {t.admin.delete}
                      </Button>
                    </li>
                  )
                })}
              </ol>
              {/* data-focus-fallback: the focus lands here when the last question is deleted. */}
              <Button type="button" variant="outline" size="sm" className="mt-6" data-focus-fallback onClick={addQuestion}>
                <Plus aria-hidden="true" />
                {e.add}
              </Button>
            </div>
          ) : shown.length ? (
            <Accordion type="single" collapsible defaultValue={open}>
              {shown.map((item) => (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  {/* Line breaks staff typed in an answer stay. */}
                  <AccordionContent className="whitespace-pre-line">{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-brand-charcoal-muted">{e.empty}</p>
          )}
        </div>
      </form>
    </section>
  )
}
