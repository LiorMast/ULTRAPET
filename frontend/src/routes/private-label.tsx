/**
 * routes/private-label.tsx — The Private Label page (תווית פרטית, /private-label): Ultra Pet developing and making pet
 * products under a customer's own brand. Sections: the page heading with its calls to action, the approach beside the
 * manufacturing capabilities, the process (the home page's Private Label section, read-only, so both show the steps
 * staff saved), what we manufacture (four product categories), why Ultra Pet, a private label FAQ and a closing call
 * to action. The copy is in the dictionaries (t.privateLabelPage); the loader reads the saved process (page_sections
 * "private_label" and "private_label_steps").
 *
 * SEO: `head` sets the title, description, canonical and hreflang links, plus BreadcrumbList and FAQPage JSON-LD (the
 * closed answers are not in the DOM).
 */
import type { ReactNode } from 'react'
import { createFileRoute, Link, linkOptions } from '@tanstack/react-router'
import { Bone, Droplets, Globe, Handshake, Package, ShieldCheck, Sparkles, Truck, type LucideIcon } from 'lucide-react'
import { fetchSections, type FlowStepsContent, type SectionContent } from '@/api'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { PrivateLabel } from '@/components/PrivateLabel'
import { SectionHeading } from '@/components/SectionHeading'
import { TextLink } from '@/components/TextLink'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { dictionaryFor, useI18n } from '@/i18n'
import type { Dictionary } from '@/i18n/he'
import { breadcrumbJsonLd, faqJsonLd, pageHead } from '@/seo'

export const Route = createFileRoute('/private-label')({
  loader: async ({ abortController }) => {
    const sections = await fetchSections(abortController.signal)
    return {
      steps: (sections.private_label_steps as FlowStepsContent | undefined)?.steps ?? null,
      content: (sections.private_label ?? null) as SectionContent | null,
    }
  },
  head: ({ match }) => {
    const { locale } = match.context
    const t = dictionaryFor(locale)
    return pageHead({
      locale,
      path: '/private-label',
      title: t.privateLabelPage.metaTitle,
      description: t.privateLabelPage.description,
      jsonLd: [
        breadcrumbJsonLd(locale, [
          { name: t.articles.home, path: '/' },
          { name: t.nav.privateLabel, path: '/private-label' },
        ]),
        faqJsonLd(t.privateLabelPage.faq),
      ],
    })
  },
  component: PrivateLabelPage,
})

type Page = Dictionary['privateLabelPage']

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
 * A card with an icon chip, a title and a text (a product category, a reason to choose us).
 * @param props.icon - The lucide icon of the chip (decorative).
 * @param props.title - The card's title (an h3).
 * @param props.children - The card's text and any extra content.
 * @returns The card.
 */
function FeatureCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col rounded-2xl border border-neutral-150 bg-white p-7 shadow-soft">
      <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-lg bg-brand-red-muted text-brand-red">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-5 font-display text-xl font-bold text-brand-charcoal">{title}</h3>
      {children}
    </li>
  )
}

/**
 * The manufacturing capabilities: a dark panel with four figures and the audit note.
 * @returns The panel.
 */
function CapabilitiesPanel() {
  const { t } = useI18n()
  const p = t.privateLabelPage
  return (
    <div className="rounded-3xl bg-brand-charcoal p-8 text-white lg:p-10">
      <h3 className="font-display text-2xl font-bold">{p.capabilitiesTitle}</h3>
      <p className="mt-3 text-white/75">{p.capabilitiesText}</p>
      <dl className="mt-8 grid grid-cols-2 gap-3">
        {CAPABILITIES.map((id) => (
          <div key={id} className="flex flex-col-reverse rounded-2xl bg-white/5 p-5">
            <dt className="mt-1 text-sm text-white/75">{p.capabilities[id].label}</dt>
            <dd className="font-display text-3xl font-bold">
              {/* "15+" keeps its plus sign after the number in Hebrew too. */}
              <bdi dir="ltr">{p.capabilities[id].value}</bdi>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 flex items-start gap-3 text-sm text-white/85">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-red-light" />
        {p.certNote}
      </p>
    </div>
  )
}

/**
 * The Private Label page.
 * @returns The page's sections.
 */
function PrivateLabelPage() {
  const { t } = useI18n()
  const p = t.privateLabelPage
  const { steps, content } = Route.useLoaderData()
  return (
    <>
      <section aria-labelledby="private-label-page-title" className="mx-auto max-w-7xl px-6 pt-16 pb-16 lg:px-10 lg:pt-20 lg:pb-20">
        <Breadcrumbs items={[{ label: t.articles.home, link: linkOptions({ to: '/' }) }, { label: t.nav.privateLabel }]} />
        <SectionHeading as="h1" id="private-label-page-title" eyebrow={p.eyebrow} title={p.title} intro={p.intro} className="mt-10" />
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Button asChild>
            <Link to="/" hash="contact">{p.ctaStart}</Link>
          </Button>
          <TextLink link={linkOptions({ to: '/', hash: 'brands' })}>{p.ctaBrands}</TextLink>
        </div>
      </section>

      <section aria-labelledby="approach-title" className="px-6 pb-20 lg:px-10 lg:pb-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16">
          <div>
            <SectionHeading id="approach-title" eyebrow={p.approachEyebrow} title={p.approachTitle} />
            <p className="mt-6 max-w-2xl text-lg text-brand-charcoal-muted">{p.approachText}</p>
            <p className="mt-4 max-w-2xl text-brand-charcoal-muted">{p.approachText2}</p>
            <p className="mt-8 border-s-2 border-brand-red ps-5 font-display text-xl font-bold text-brand-charcoal">{p.approachQuote}</p>
          </div>
          <CapabilitiesPanel />
        </div>
      </section>

      <PrivateLabel steps={steps} content={content} variant="page" />

      <section aria-labelledby="categories-title" className="px-6 py-20 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <SectionHeading id="categories-title" eyebrow={p.categoriesEyebrow} title={p.categoriesTitle} intro={p.categoriesIntro} />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map(({ id, icon }) => {
              const category = p.categories[id]
              return (
                <FeatureCard key={id} icon={icon} title={category.name}>
                  <p className="mt-1 text-sm font-semibold text-brand-red-dark">{category.tagline}</p>
                  <p className="mt-4 text-sm leading-relaxed text-brand-charcoal-muted">{category.text}</p>
                  <ul className="mt-5 flex-1 space-y-1.5 text-sm text-brand-charcoal">
                    {category.formats.map((format) => (
                      <li key={format} className="flex items-center gap-2">
                        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-brand-red" />
                        {format}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 border-t border-neutral-150 pt-4 text-xs text-brand-charcoal-muted">
                    <span className="block font-semibold text-brand-charcoal">{p.packSizes}</span>
                    {category.sizes}
                  </p>
                </FeatureCard>
              )
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="why-title" className="bg-neutral-50 px-6 py-20 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <SectionHeading id="why-title" eyebrow={p.whyEyebrow} title={p.whyTitle} />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {REASONS.map(({ id, icon }) => (
              <FeatureCard key={id} icon={icon} title={p.reasons[id].title}>
                <p className="mt-3 text-sm leading-relaxed text-brand-charcoal-muted">{p.reasons[id].text}</p>
              </FeatureCard>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="private-label-faq-title" className="px-6 py-20 lg:px-10 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <SectionHeading id="private-label-faq-title" eyebrow={p.faqEyebrow} title={p.faqTitle} />
          <Accordion type="single" collapsible variant="card">
            {p.faq.map((item, i) => (
              <AccordionItem key={i} value={String(i)}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section aria-labelledby="private-label-cta-title" className="px-6 pb-20 lg:px-10 lg:pb-24">
        <div className="mx-auto max-w-7xl rounded-3xl bg-brand-charcoal px-8 py-14 text-center lg:py-20">
          <h2 id="private-label-cta-title" className="mx-auto max-w-3xl font-display text-3xl font-bold text-balance text-white lg:text-4xl">
            {p.ctaTitle}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/75">{p.ctaText}</p>
          <Button asChild className="mt-10">
            <Link to="/" hash="contact">{p.ctaStart}</Link>
          </Button>
        </div>
      </section>
    </>
  )
}
