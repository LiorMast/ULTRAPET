/**
 * PrivateLabelPage.tsx — The sections of the Private Label page (routes/private-label.tsx) that staff edit in place,
 * like the home sections (EditableSection.tsx: "Edit on page", the page's language, one section at a time; the
 * headings' words, font and size, every other text's words). Each section's built-in words come from the dictionaries
 * (t.privateLabelPage); what staff saved lives in its own page_sections row (PAGE_SECTION_KEYS). Button labels stay
 * in the dictionaries.
 *
 * - PrivateLabelIntro: the breadcrumbs, the page heading (h1) and its calls to action.
 * - PrivateLabelApproach: the approach texts beside the dark manufacturing capabilities panel (its figures too).
 * - PrivateLabelCategories: what we manufacture, a FeatureCard per product category (name, tagline, text, the
 *   product formats, the pack sizes).
 * - PrivateLabelWhy: the reasons to choose Ultra Pet, a FeatureCard each.
 * - PrivateLabelCta: the closing call to action on a dark panel.
 * - defaultPageFaq: the page FAQ's built-in questions (every language), shown until staff save the list; the page
 *   renders the FAQ with the shared Faq component.
 */
import type { ReactNode } from 'react'
import { Link, linkOptions } from '@tanstack/react-router'
import { Bone, Droplets, Globe, Handshake, Package, ShieldCheck, Sparkles, Truck, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import type { FaqItem, SectionContent } from '@/api'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { fieldLabel, SectionEditBar, useEditableSection, type EditableField } from '@/components/EditableSection'
import { EditableText } from '@/components/InlineEditor'
import { HEADING_KEYS, headingLabels, SectionHeading } from '@/components/SectionHeading'
import { TextLink } from '@/components/TextLink'
import { Button } from '@/components/ui/button'
import { dictionaryFor, ENABLED_LOCALES, useI18n } from '@/i18n'
import type { Dictionary } from '@/i18n/he'

type Page = Dictionary['privateLabelPage']

/** The page_sections rows of the page's editable texts, by section. */
export const PAGE_SECTION_KEYS = {
  intro: 'private_label_page_intro',
  approach: 'private_label_page_approach',
  categories: 'private_label_page_categories',
  why: 'private_label_page_why',
  faq: 'private_label_page_faq',
  faqItems: 'private_label_page_faq_items',
  cta: 'private_label_page_cta',
} as const

/** The props of every editable section of the page. */
type SectionProps = {
  /** The texts staff saved (its page_sections row); null or omitted = the dictionary's. */
  content?: SectionContent | null
  /** Stores new content (rejects with an ApiError on refusal); given = staff can edit in place. */
  onSave?: (content: SectionContent) => Promise<unknown>
}

/** The product categories made under a customer's brand, with their icons, in display order. */
const CATEGORIES: { id: keyof Page['categories']; icon: LucideIcon }[] = [
  { id: 'dry', icon: Package },
  { id: 'wet', icon: Droplets },
  { id: 'treats', icon: Bone },
  { id: 'litter', icon: Sparkles },
]

/** The reasons to choose Ultra Pet, with their icons, in display order. */
const REASONS: { id: keyof Page['reasons']; icon: LucideIcon }[] = [
  { id: 'factories', icon: Globe },
  { id: 'quality', icon: ShieldCheck },
  { id: 'partner', icon: Handshake },
  { id: 'distribution', icon: Truck },
]

/** The manufacturing figures of the capabilities panel, in display order. */
const CAPABILITIES: (keyof Page['capabilities'])[] = ['factories', 'iso', 'formats', 'countries']

/**
 * The built-in words and box names of a section heading.
 * @param t - The dictionary.
 * @param eyebrow - The eyebrow's words.
 * @param title - The title's words.
 * @param intro - The intro's words; '' (default) = none (staff may add one).
 * @returns `defaults` and `labels` of the heading's keys.
 */
const headingTexts = (t: Dictionary, eyebrow: string, title: string, intro = '') => ({
  defaults: { eyebrow, title, intro } as Record<string, string>,
  labels: headingLabels(t) as Record<string, string>,
})

/**
 * The edit state of one section of the page: its texts with the heading's styled.
 * @param texts - The section's `defaults` and `labels` by text key.
 * @param props - The section's content and onSave.
 * @returns useEditableSection's state.
 */
const usePageSection = (texts: { defaults: Record<string, string>; labels: Record<string, string> }, { content, onSave }: SectionProps) =>
  useEditableSection<string>({ content, ...texts, styled: HEADING_KEYS, onSave: onSave && ((next) => onSave(next)) })

/**
 * A card with an icon chip, an editable title and its texts (a product category, a reason to choose us).
 * @param props.icon - The lucide icon of the chip (decorative).
 * @param props.title - The title's EditableText props (an h3).
 * @param props.children - The card's text and any extra content.
 * @returns The list item.
 */
function FeatureCard({ icon: Icon, title, children }: { icon: LucideIcon; title: EditableField; children: ReactNode }) {
  return (
    <li className="flex flex-col rounded-2xl border border-neutral-150 bg-white p-5 shadow-soft sm:p-7">
      <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-lg bg-brand-red-muted text-brand-red">
        <Icon className="size-5" />
      </span>
      <EditableText as="h3" wrap {...title} className="mt-5 font-display text-xl font-bold text-brand-charcoal" />
      {children}
    </li>
  )
}

/**
 * The page heading: breadcrumbs, the h1 with its eyebrow and intro, and the calls to action.
 * @param props.content - The heading's saved texts (row "private_label_page_intro").
 * @param props.onSave - Stores them; given = staff can edit.
 * @returns The <section>.
 */
export function PrivateLabelIntro(props: SectionProps) {
  const { t } = useI18n()
  const p = t.privateLabelPage
  const section = usePageSection(headingTexts(t, p.eyebrow, p.title, p.intro), props)
  return (
    <section aria-labelledby="private-label-page-title" className="page-y px-gutter mx-auto max-w-7xl lg:py-20">
      <Breadcrumbs items={[{ label: t.articles.home, link: linkOptions({ to: '/' }) }, { label: t.nav.privateLabel }]} />
      {section.edit && <SectionEditBar edit={section.edit} label={p.eyebrow} className="mt-6 bg-white" />}
      <form {...section.formProps}>
        <SectionHeading as="h1" id="private-label-page-title" edit={section.field} className="mt-10" />
      </form>
      {/* While editing, the links are shown but not followed: the page stays in edit mode. */}
      <div className={cn('mt-10 flex flex-wrap items-center gap-x-8 gap-y-4', section.editing && 'pointer-events-none')}>
        <Button asChild>
          <Link to="/" hash="contact">{p.ctaStart}</Link>
        </Button>
        <TextLink link={linkOptions({ to: '/', hash: 'brands' })}>{p.ctaBrands}</TextLink>
      </div>
    </section>
  )
}

/**
 * The approach (heading, two paragraphs, a quote) beside the manufacturing capabilities: a dark panel with its title,
 * text, four figures and the audit note.
 * @param props.content - The section's saved texts (row "private_label_page_approach").
 * @param props.onSave - Stores them; given = staff can edit.
 * @returns The <section>.
 */
export function PrivateLabelApproach(props: SectionProps) {
  const { t } = useI18n()
  const p = t.privateLabelPage
  const { defaults, labels } = headingTexts(t, p.approachEyebrow, p.approachTitle)
  const own = {
    approachText: fieldLabel(t, 'text', p.approachTitle, 1),
    approachText2: fieldLabel(t, 'text', p.approachTitle, 2),
    approachQuote: fieldLabel(t, 'quote', p.approachTitle),
    capabilitiesTitle: fieldLabel(t, 'title', p.capabilitiesTitle),
    capabilitiesText: fieldLabel(t, 'text', p.capabilitiesTitle),
    certNote: fieldLabel(t, 'closing', p.capabilitiesTitle),
  }
  for (const key of Object.keys(own) as (keyof typeof own)[]) {
    defaults[key] = p[key]
    labels[key] = own[key]
  }
  for (const id of CAPABILITIES) {
    const { value, label } = p.capabilities[id]
    defaults[`capability.${id}.value`] = value
    defaults[`capability.${id}.label`] = label
    labels[`capability.${id}.value`] = fieldLabel(t, 'value', label)
    labels[`capability.${id}.label`] = fieldLabel(t, 'label', label)
  }
  const section = usePageSection({ defaults, labels }, props)
  const { field } = section
  return (
    <section aria-labelledby="approach-title" className="bg-white px-gutter pb-12 md:pb-16 lg:pb-24">
      <div className="mx-auto max-w-7xl">
        {section.edit && <SectionEditBar edit={section.edit} label={p.approachEyebrow} className="bg-white" />}
        <form {...section.formProps} className="grid gap-8 sm:gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16">
          <div>
            <SectionHeading id="approach-title" edit={field} />
            <EditableText multiline {...field('approachText')} className="mt-6 max-w-2xl text-lg text-brand-charcoal-muted" />
            <EditableText multiline {...field('approachText2')} className="mt-4 max-w-2xl text-brand-charcoal-muted" />
            <EditableText wrap {...field('approachQuote')} className="mt-8 border-s-2 border-brand-red ps-5 font-display text-xl font-bold text-brand-charcoal" />
          </div>
          <div className="rounded-3xl bg-brand-charcoal p-6 text-white sm:p-8 lg:p-10">
            <EditableText as="h3" wrap {...field('capabilitiesTitle')} className="font-display text-2xl font-bold" />
            <EditableText multiline {...field('capabilitiesText')} className="mt-3 text-white/75" />
            <dl className="mt-8 grid grid-cols-2 gap-3">
              {CAPABILITIES.map((id) => (
                <div key={id} className="flex flex-col-reverse rounded-2xl bg-white/5 p-5">
                  <dt className="mt-1 text-sm text-white/75">
                    <EditableText as="span" wrap {...field(`capability.${id}.label`)} />
                  </dt>
                  <dd className="font-display text-3xl font-bold">
                    {/* dir="ltr": "15+" keeps its plus sign after the number in Hebrew too. */}
                    <EditableText as="span" wrap dir="ltr" {...field(`capability.${id}.value`)} />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex items-start gap-3 text-sm text-white/85">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-red-light" />
              <EditableText multiline {...field('certNote')} className="min-w-0 flex-1" />
            </div>
          </div>
        </form>
      </div>
    </section>
  )
}

/**
 * What we manufacture: the heading and a card per product category (name, tagline, text, product formats, pack sizes).
 * @param props.content - The section's saved texts (row "private_label_page_categories").
 * @param props.onSave - Stores them; given = staff can edit.
 * @returns The <section>.
 */
export function PrivateLabelCategories(props: SectionProps) {
  const { t } = useI18n()
  const p = t.privateLabelPage
  const { defaults, labels } = headingTexts(t, p.categoriesEyebrow, p.categoriesTitle, p.categoriesIntro)
  defaults.packSizes = p.packSizes
  labels.packSizes = fieldLabel(t, 'label', p.packSizes)
  for (const { id } of CATEGORIES) {
    const category = p.categories[id]
    for (const [part, name] of [['name', 'title'], ['tagline', 'tagline'], ['text', 'text'], ['sizes', 'sizes']] as const) {
      defaults[`category.${id}.${part}`] = category[part]
      labels[`category.${id}.${part}`] = fieldLabel(t, name, category.name)
    }
    category.formats.forEach((format, i) => {
      defaults[`category.${id}.format.${i}`] = format
      labels[`category.${id}.format.${i}`] = fieldLabel(t, 'format', category.name, i + 1)
    })
  }
  const section = usePageSection({ defaults, labels }, props)
  const { field } = section
  return (
    <section aria-labelledby="categories-title" className="bg-white px-gutter section-y">
      <div className="mx-auto max-w-7xl">
        {section.edit && <SectionEditBar edit={section.edit} label={p.categoriesEyebrow} className="bg-white" />}
        <form {...section.formProps}>
          <SectionHeading id="categories-title" edit={field} />
          <ul className="section-gap grid gap-4 sm:grid-cols-2 sm:gap-5 lg:mt-12 lg:grid-cols-4">
            {CATEGORIES.map(({ id, icon }) => (
              <FeatureCard key={id} icon={icon} title={field(`category.${id}.name`)}>
                <EditableText wrap {...field(`category.${id}.tagline`)} className="mt-1 text-sm font-semibold text-brand-red-dark" />
                <EditableText multiline {...field(`category.${id}.text`)} className="mt-4 text-sm leading-relaxed text-brand-charcoal-muted" />
                <ul className="mt-5 flex-1 space-y-1.5 text-sm text-brand-charcoal">
                  {p.categories[id].formats.map((_, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-brand-red" />
                      <EditableText as="span" wrap {...field(`category.${id}.format.${i}`)} className="min-w-0 flex-1" />
                    </li>
                  ))}
                </ul>
                <div className="mt-6 border-t border-neutral-150 pt-4 text-xs text-brand-charcoal-muted">
                  <EditableText as="span" wrap {...field('packSizes')} className="block font-semibold text-brand-charcoal" />
                  <EditableText as="span" wrap {...field(`category.${id}.sizes`)} className="block" />
                </div>
              </FeatureCard>
            ))}
          </ul>
        </form>
      </div>
    </section>
  )
}

/**
 * Why Ultra Pet: the heading and a card per reason.
 * @param props.content - The section's saved texts (row "private_label_page_why").
 * @param props.onSave - Stores them; given = staff can edit.
 * @returns The <section>.
 */
export function PrivateLabelWhy(props: SectionProps) {
  const { t } = useI18n()
  const p = t.privateLabelPage
  const { defaults, labels } = headingTexts(t, p.whyEyebrow, p.whyTitle)
  for (const { id } of REASONS) {
    const reason = p.reasons[id]
    defaults[`reason.${id}.title`] = reason.title
    defaults[`reason.${id}.text`] = reason.text
    labels[`reason.${id}.title`] = fieldLabel(t, 'title', reason.title)
    labels[`reason.${id}.text`] = fieldLabel(t, 'text', reason.title)
  }
  const section = usePageSection({ defaults, labels }, props)
  const { field } = section
  return (
    <section aria-labelledby="why-title" className="bg-neutral-50 px-gutter section-y">
      <div className="mx-auto max-w-7xl">
        {section.edit && <SectionEditBar edit={section.edit} label={p.whyEyebrow} className="bg-neutral-50" />}
        <form {...section.formProps}>
          <SectionHeading id="why-title" edit={field} />
          <ul className="section-gap grid gap-4 sm:grid-cols-2 sm:gap-5 lg:mt-12 lg:grid-cols-4">
            {REASONS.map(({ id, icon }) => (
              <FeatureCard key={id} icon={icon} title={field(`reason.${id}.title`)}>
                <EditableText multiline {...field(`reason.${id}.text`)} className="mt-3 text-sm leading-relaxed text-brand-charcoal-muted" />
              </FeatureCard>
            ))}
          </ul>
        </form>
      </div>
    </section>
  )
}

/**
 * The closing call to action: a title and a text on a dark panel, and the button to the Contact section.
 * @param props.content - The section's saved texts (row "private_label_page_cta").
 * @param props.onSave - Stores them; given = staff can edit.
 * @returns The <section>.
 */
export function PrivateLabelCta(props: SectionProps) {
  const { t } = useI18n()
  const p = t.privateLabelPage
  const section = usePageSection(
    {
      defaults: { ctaTitle: p.ctaTitle, ctaText: p.ctaText },
      labels: { ctaTitle: fieldLabel(t, 'title', p.ctaLabel), ctaText: fieldLabel(t, 'text', p.ctaLabel) },
    },
    props,
  )
  const { field } = section
  return (
    <section aria-labelledby="private-label-cta-title" className="bg-white px-gutter pb-12 md:pb-16 lg:pb-24">
      <div className="mx-auto max-w-7xl">
        {section.edit && <SectionEditBar edit={section.edit} label={p.ctaLabel} className="bg-white" />}
        <form {...section.formProps} className="rounded-3xl bg-brand-charcoal px-5 py-10 text-center sm:px-8 sm:py-14 lg:py-20">
          <EditableText as="h2" id="private-label-cta-title" wrap {...field('ctaTitle')} className="mx-auto max-w-3xl font-display text-3xl font-bold text-balance text-white lg:text-4xl" />
          <EditableText multiline {...field('ctaText')} className="mx-auto mt-5 max-w-2xl text-lg text-white/75" />
          {/* While editing, the button is shown but not followed: the page stays in edit mode. */}
          <Button asChild className={cn('mt-10', section.editing && 'pointer-events-none')}>
            <Link to="/" hash="contact">{p.ctaStart}</Link>
          </Button>
        </form>
      </div>
    </section>
  )
}

/**
 * The page FAQ's built-in questions, in every enabled language, shown until staff save the list.
 * @returns The questions (ids "q1", "q2", ...), in order.
 */
export function defaultPageFaq(): FaqItem[] {
  const [first] = ENABLED_LOCALES
  return dictionaryFor(first).privateLabelPage.faq.map((_, i) => ({
    id: `q${i + 1}`,
    question: Object.fromEntries(ENABLED_LOCALES.map((locale) => [locale, dictionaryFor(locale).privateLabelPage.faq[i]?.question])),
    answer: Object.fromEntries(ENABLED_LOCALES.map((locale) => [locale, dictionaryFor(locale).privateLabelPage.faq[i]?.answer])),
  }))
}
