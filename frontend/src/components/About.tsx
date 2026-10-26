/**
 * About.tsx — The home page "About" section (anchor #about): who Ultra Pet is, its vision pillars, what it
 * offers, its advantages and a closing call to action. Used by routes/index.tsx; the navbar's "About" link
 * scrolls here. All content comes from the dictionaries (t.about) and the lists in config.ts.
 */
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ABOUT_ADVANTAGES, ABOUT_OFFERS, ABOUT_PILLARS, type AboutItem } from '@/config'
import { useI18n } from '@/i18n'

/**
 * One About item: an icon in a square, a title and a description.
 * @param props.item - The item to show (icon and labels).
 * @returns The list item.
 */
function AboutCard({ item }: { item: AboutItem }) {
  const { t } = useI18n()
  const Icon = item.icon
  return (
    <li className="flex gap-5 border-t border-neutral-150 py-6">
      <span className="flex size-12 shrink-0 items-center justify-center bg-brand-red-muted text-brand-red">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <div>
        <h4 className="font-heading text-sm font-bold uppercase tracking-widest text-brand-charcoal">{item.title(t)}</h4>
        <p className="mt-2 text-brand-charcoal-muted">{item.text(t)}</p>
      </div>
    </li>
  )
}

/**
 * The About section.
 * @param props.pillars - The vision pillars; defaults to ABOUT_PILLARS in config.ts.
 * @param props.offers - What the company offers; defaults to ABOUT_OFFERS.
 * @param props.advantages - The advantage list; defaults to ABOUT_ADVANTAGES.
 * @returns The <section> with the story, the pillars, the offers and the advantages panel.
 */
export function About({
  pillars = ABOUT_PILLARS,
  offers = ABOUT_OFFERS,
  advantages = ABOUT_ADVANTAGES,
}: {
  pillars?: AboutItem[]
  offers?: AboutItem[]
  advantages?: typeof ABOUT_ADVANTAGES
}) {
  const { t } = useI18n()
  return (
    <section id="about" aria-labelledby="about-title" className="border-b border-neutral-150 bg-white px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-red">{t.about.eyebrow}</p>
          <h2 id="about-title" className="mt-4 font-display text-4xl font-bold text-brand-charcoal lg:text-5xl">
            {t.about.title}
          </h2>
          <p className="mt-5 text-lg text-brand-charcoal-muted">{t.about.intro}</p>
        </div>

        <div className="mt-16 grid gap-16 lg:grid-cols-2 lg:gap-20">
          <div>
            <h3 className="font-display text-2xl font-bold text-brand-charcoal">{t.about.visionTitle}</h3>
            <ul className="mt-6">
              {pillars.map((item) => (
                <AboutCard key={item.id} item={item} />
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-display text-2xl font-bold text-brand-charcoal">{t.about.offerTitle}</h3>
            <ul className="mt-6">
              {offers.map((item) => (
                <AboutCard key={item.id} item={item} />
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-20 grid gap-10 bg-brand-charcoal p-8 text-white lg:grid-cols-2 lg:gap-16 lg:p-14">
          <div>
            <h3 className="font-display text-2xl font-bold">{t.about.advantagesTitle}</h3>
            <ul className="mt-6 space-y-4">
              {advantages.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-white/85">
                  <Check aria-hidden="true" className="mt-1 size-5 shrink-0 text-white" />
                  <span>{a.label(t)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-display text-2xl font-bold">{t.about.joinTitle}</h3>
            <p className="mt-4 text-white/85">{t.about.joinText}</p>
            <Button asChild className="mt-8">
              <Link to="/" hash="contact">
                {t.about.cta}
                <ArrowRight aria-hidden="true" className="rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </div>

        <p className="mt-12 max-w-3xl text-brand-charcoal-muted">{t.about.closing}</p>
      </div>
    </section>
  )
}
