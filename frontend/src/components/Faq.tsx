/**
 * Faq.tsx — The home page FAQ section (anchor #faq): the questions business customers ask most, as an accordion
 * (ui/accordion.tsx), next to a "still have a question?" box that links to the Contact section. Used by
 * routes/index.tsx, which also puts the same questions in the page head as schema.org FAQPage data (seo.ts). The
 * questions come from FAQ_ITEMS in config.ts, their texts from the dictionaries (t.faq).
 */
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { SectionHeading } from '@/components/SectionHeading'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { FAQ_ITEMS, type FaqItem } from '@/config'
import { useI18n } from '@/i18n'

/**
 * The FAQ section: the heading and contact box (sticky beside the list on desktop) and one accordion panel per
 * question, one open at a time.
 * @param props.items - The questions, in display order; defaults to FAQ_ITEMS in config.ts.
 * @param props.defaultOpen - The id of the question open on load; defaults to the first one, null = all closed.
 * @returns The <section>.
 */
export function Faq({ items = FAQ_ITEMS, defaultOpen = items[0]?.id ?? null }: { items?: FaqItem[]; defaultOpen?: string | null }) {
  const { t } = useI18n()
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-white px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeading id="faq-title" eyebrow={t.faq.eyebrow} title={t.faq.title} intro={t.faq.intro} />
          <div className="mt-10 border-s-2 border-brand-red ps-6">
            <h3 className="font-display text-xl font-bold text-brand-charcoal">{t.faq.moreTitle}</h3>
            <p className="mt-2 text-brand-charcoal-muted">{t.faq.moreText}</p>
            <Button asChild className="mt-6">
              <Link to="/" hash="contact">
                {t.faq.cta}
                <ArrowRight aria-hidden="true" className="rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </div>
        <Accordion type="single" collapsible defaultValue={defaultOpen ?? undefined}>
          {items.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger>{item.question(t)}</AccordionTrigger>
              <AccordionContent>{item.answer(t)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
