/**
 * About.tsx — The home page "About" section (anchor #about): who Ultra Pet is, its vision pillars, what it
 * offers, its advantages and a closing call to action. Used by routes/index.tsx, which loads the section's saved texts
 * (page_sections "about"); the navbar's "About" link scrolls here. The built-in content comes from the dictionaries
 * (t.about) and the lists in config.ts. With `onSave`, staff edit every text in place (EditableSection, the page's
 * language): the heading's words, font and size, and the words of the other titles, the pillars, the offers, the
 * advantages and the closing paragraph (the button keeps its label).
 */
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check } from 'lucide-react'
import { cn } from 'cn'
import type { SectionContent } from '@/api'
import { fieldLabel, SectionEditBar, useEditableSection, type EditableField } from '@/components/EditableSection'
import { EditableText } from '@/components/InlineEditor'
import { HEADING_KEYS, headingLabels, SectionHeading } from '@/components/SectionHeading'
import { Button } from '@/components/ui/button'
import { ABOUT_ADVANTAGES, ABOUT_OFFERS, ABOUT_PILLARS, type AboutItem } from '@/config'
import type { Dictionary } from '@/i18n/he'
import { useI18n } from '@/i18n'

/** The section's own texts besides the heading and the lists. */
const BLOCK_KEYS = ['visionTitle', 'offerTitle', 'advantagesTitle', 'joinTitle', 'joinText', 'closing'] as const

/**
 * One About item: an icon in a square, a title and a description.
 * @param props.item - The item to show (its icon).
 * @param props.title - Its title's EditableText props.
 * @param props.text - Its description's EditableText props.
 * @returns The list item.
 */
function AboutCard({ item, title, text }: { item: AboutItem; title: EditableField; text: EditableField }) {
  const Icon = item.icon
  return (
    <li className="flex gap-5 border-t border-neutral-150 py-6">
      <span className="flex size-12 shrink-0 items-center justify-center bg-brand-red-muted text-brand-red">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <EditableText as="h4" wrap {...title} className="font-heading text-sm font-bold uppercase tracking-widest text-brand-charcoal" />
        <EditableText multiline {...text} className="mt-2 text-brand-charcoal-muted" />
      </div>
    </li>
  )
}

/**
 * The built-in words and box names of every text of the section, in the page language.
 * @param t - The dictionary.
 * @param lists - The pillars, offers and advantages shown.
 * @returns `defaults` and `labels` by text key: the heading's, BLOCK_KEYS, "pillar.<id>.title|text",
 *   "offer.<id>.title|text" and "advantage.<id>".
 */
function aboutTexts(t: Dictionary, lists: { pillars: AboutItem[]; offers: AboutItem[]; advantages: typeof ABOUT_ADVANTAGES }) {
  const { about } = t
  const defaults: Record<string, string> = { eyebrow: about.eyebrow, title: about.title, intro: about.intro }
  const labels: Record<string, string> = headingLabels(t)
  for (const key of BLOCK_KEYS) defaults[key] = about[key]
  for (const key of ['visionTitle', 'offerTitle', 'advantagesTitle', 'joinTitle'] as const) labels[key] = fieldLabel(t, 'title', about[key])
  labels.joinText = fieldLabel(t, 'text', about.joinTitle)
  labels.closing = fieldLabel(t, 'closing')
  for (const [prefix, items] of [['pillar', lists.pillars], ['offer', lists.offers]] as const) {
    for (const item of items) {
      defaults[`${prefix}.${item.id}.title`] = item.title(t)
      defaults[`${prefix}.${item.id}.text`] = item.text(t)
      labels[`${prefix}.${item.id}.title`] = fieldLabel(t, 'title', item.title(t))
      labels[`${prefix}.${item.id}.text`] = fieldLabel(t, 'text', item.title(t))
    }
  }
  for (const item of lists.advantages) {
    defaults[`advantage.${item.id}`] = item.label(t)
    labels[`advantage.${item.id}`] = fieldLabel(t, 'text', item.label(t))
  }
  return { defaults, labels }
}

/**
 * The About section.
 * @param props.pillars - The vision pillars; defaults to ABOUT_PILLARS in config.ts.
 * @param props.offers - What the company offers; defaults to ABOUT_OFFERS.
 * @param props.advantages - The advantage list; defaults to ABOUT_ADVANTAGES.
 * @param props.content - The texts staff saved (see aboutTexts for the keys); null or omitted = the dictionary's.
 * @param props.onSave - Stores new content (rejects with an ApiError on refusal); given = staff can edit in place.
 * @returns The <section> with the story, the pillars, the offers and the advantages panel.
 */
export function About({
  pillars = ABOUT_PILLARS,
  offers = ABOUT_OFFERS,
  advantages = ABOUT_ADVANTAGES,
  content,
  onSave,
}: {
  pillars?: AboutItem[]
  offers?: AboutItem[]
  advantages?: typeof ABOUT_ADVANTAGES
  content?: SectionContent | null
  onSave?: (content: SectionContent) => Promise<unknown>
}) {
  const { t } = useI18n()
  const section = useEditableSection<string>({ content, ...aboutTexts(t, { pillars, offers, advantages }), styled: HEADING_KEYS, onSave: onSave && ((next) => onSave(next)) })
  const { field } = section
  return (
    <section id="about" aria-labelledby="about-title" className="border-b border-neutral-150 bg-white px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        {section.edit && <SectionEditBar edit={section.edit} label={t.about.eyebrow} className="bg-white" />}
        <form {...section.formProps}>
          <SectionHeading id="about-title" edit={field} />

          <div className="mt-16 grid gap-16 lg:grid-cols-2 lg:gap-20">
            <div>
              <EditableText as="h3" wrap {...field('visionTitle')} className="font-display text-2xl font-bold text-brand-charcoal" />
              <ul className="mt-6">
                {pillars.map((item) => (
                  <AboutCard key={item.id} item={item} title={field(`pillar.${item.id}.title`)} text={field(`pillar.${item.id}.text`)} />
                ))}
              </ul>
            </div>
            <div>
              <EditableText as="h3" wrap {...field('offerTitle')} className="font-display text-2xl font-bold text-brand-charcoal" />
              <ul className="mt-6">
                {offers.map((item) => (
                  <AboutCard key={item.id} item={item} title={field(`offer.${item.id}.title`)} text={field(`offer.${item.id}.text`)} />
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-20 grid gap-10 bg-brand-charcoal p-8 text-white lg:grid-cols-2 lg:gap-16 lg:p-14">
            <div>
              <EditableText as="h3" wrap {...field('advantagesTitle')} className="font-display text-2xl font-bold" />
              <ul className="mt-6 space-y-4">
                {advantages.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-white/85">
                    <Check aria-hidden="true" className="mt-1 size-5 shrink-0 text-white" />
                    <EditableText as="span" wrap {...field(`advantage.${a.id}`)} className="min-w-0 flex-1" />
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <EditableText as="h3" wrap {...field('joinTitle')} className="font-display text-2xl font-bold" />
              <EditableText multiline {...field('joinText')} className="mt-4 text-white/85" />
              {/* While editing, the button is shown but not followed: the page stays in edit mode. */}
              <Button asChild className={cn('mt-8', section.editing && 'pointer-events-none')}>
                <Link to="/" hash="contact">
                  {t.about.cta}
                  <ArrowRight aria-hidden="true" className="rtl:rotate-180" />
                </Link>
              </Button>
            </div>
          </div>

          <EditableText multiline {...field('closing')} className="mt-12 max-w-3xl text-brand-charcoal-muted" />
        </form>
      </div>
    </section>
  )
}
