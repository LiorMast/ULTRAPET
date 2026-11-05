/**
 * Hero.tsx — The home page hero: a full-width slideshow of photos with a dark gradient on the text
 * side, the "Ultra Pet" headline, a short pitch and two buttons. Rebuilt from legacy/src/components/Hero.tsx.
 *
 * - The photos come from the folder src/assets/hero (see HERO_IMAGES in src/config.ts): drop files there
 *   and they appear, in filename order. Photos are decorative; the headline carries the meaning.
 * - Each photo fades in over 1.6s while slowly zooming in (styles: .hero-slide in src/index.css).
 * - Timing is a CSS animation on the active progress dash (.hero-progress); when it ends, the next photo
 *   shows. Pausing is just animation-play-state, so there are no JS timers.
 * - The pause button stops the slideshow (WCAG 2.2.2). With prefers-reduced-motion the photos never
 *   advance by themselves and the pause button is hidden.
 * - The headline starts with the round red logo mark (src/assets/logo-mark.svg), decorative since the text names the brand.
 * - 0 photos: a plain charcoal gradient. 1 photo: no controls. 2 or more: slideshow with controls.
 * - The scroll-down arrow is a real link to the next home section (#stats); it nudges downwards three
 *   times after the text has risen, then stays still.
 * - Staff can change the title, tagline and description, and their font and size per language (`content`, saved in
 *   page_sections, see resolveHero). An empty or missing part shows the dictionary's text in the site's font at
 *   size "md", which is the original design. With `onSave`, staff edit the texts in place (InlineEditor: "Edit on
 *   page", one PropBar in the top corner for the font and size of the selected text, one Save for all of them, the
 *   page's language only, see mergeHero); the page can also put another
 *   control (the two-language dialog) in the `editor` slot.
 */
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, ChevronDown, Pause, Play } from 'lucide-react'
import { cva } from 'class-variance-authority'
import { cn } from 'cn'
import type { HeroContent, SectionText } from '@/api'
import { EditableText, InlineEditBar, PropBar, useInlineDraft, type TextValue } from '@/components/InlineEditor'
import { useReducedMotion } from '@/components/useReducedMotion'
import { Button } from '@/components/ui/button'
import logoMarkUrl from '@/assets/logo-mark.svg'
import { FONTS, HERO_IMAGES, HERO_LINKS, SIZE_STEPS, type HeroImage } from '@/config'
import { dictionaryFor, useI18n, type Locale } from '@/i18n'

/** Same side padding as the navbar, so the hero text lines up with the logo. */
const PAGE_GUTTER = 'px-6 lg:px-10 xl:px-6 2xl:px-10'

// The size class goes first in cn(): tailwind-merge drops a `leading-*` that comes before a text size.

/** The title's size steps ("md" = the design); every step scales with the screen, so phones never overflow. */
const titleSize = cva('', {
  variants: {
    size: {
      sm: 'text-[clamp(2.6rem,5.5vw,4.75rem)]',
      md: 'text-[clamp(3.2rem,7.5vw,6.5rem)]',
      lg: 'text-[clamp(3.4rem,8.5vw,7.5rem)]',
      xl: 'text-[clamp(3.6rem,9.5vw,8.5rem)]',
    },
  },
})

/** The tagline's size steps ("md" = the design). */
const taglineSize = cva('', {
  variants: { size: { sm: 'text-base lg:text-lg', md: 'text-lg lg:text-xl', lg: 'text-xl lg:text-2xl', xl: 'text-2xl lg:text-3xl' } },
})

/** The description's size steps ("md" = the design). */
const descriptionSize = cva('', {
  variants: { size: { sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl lg:text-2xl' } },
})

/** The hero's texts as shown in one language (see resolveHero). */
export type ResolvedHero = { title: TextValue & { accent: string }; tagline: TextValue; description: TextValue }

/** The texts of the hero's inline editor (the red accent word is a text of its own, styled like the title). */
type HeroDraft = Record<'title' | 'accent' | 'tagline' | 'description', TextValue>

/**
 * Works out what one hero text shows in a language: the saved value, else the default.
 * @param saved - The text's saved content, if any.
 * @param locale - The language.
 * @param fallback - The dictionary's words for this text.
 * @returns The words, font ("default" when unset) and size ("md" when unset).
 */
function resolveText(saved: SectionText | undefined, locale: Locale, fallback: string): TextValue {
  // Unknown keys (e.g. a font removed from FONTS since it was saved) fall back too.
  const font = saved?.font?.[locale]
  const size = saved?.size?.[locale]
  return {
    text: saved?.text?.[locale]?.trim() || fallback,
    font: font && font in FONTS ? font : 'default',
    size: size && SIZE_STEPS.includes(size) ? size : 'md',
  }
}

/**
 * Works out what the hero shows in a language: the staff's saved content, with the dictionary's texts, the site's
 * fonts and the "md" size for whatever was not saved. Also used by the hero editor to start from what is shown.
 * @param content - The saved hero content, or null when it was never edited.
 * @param locale - The language.
 * @returns The title (with its red accent word), tagline and description.
 */
export function resolveHero(content: HeroContent | null | undefined, locale: Locale): ResolvedHero {
  const { hero } = dictionaryFor(locale)
  return {
    title: { ...resolveText(content?.title, locale, hero.title), accent: content?.title?.accent?.[locale]?.trim() || hero.titleAccent },
    tagline: resolveText(content?.tagline, locale, hero.tagline),
    description: resolveText(content?.description, locale, hero.description),
  }
}

/**
 * The inline editor's starting values in a language: the saved words ('' when not saved, so the box shows the
 * built-in text as its placeholder) with the font and size shown now.
 * @param content - The saved hero content, or null.
 * @param locale - The page language.
 * @returns The draft.
 */
function heroDraft(content: HeroContent | null | undefined, locale: Locale): HeroDraft {
  const shown = resolveHero(content, locale)
  /**
   * One text's starting values.
   * @param words - The saved words in this language, if any.
   * @param style - The font and size shown now.
   * @returns The text's draft.
   */
  const draftOf = (words: string | undefined, style: TextValue): TextValue => ({ text: words ?? '', font: style.font, size: style.size })
  return {
    title: draftOf(content?.title?.text?.[locale], shown.title),
    accent: draftOf(content?.title?.accent?.[locale], shown.title),
    tagline: draftOf(content?.tagline?.text?.[locale], shown.tagline),
    description: draftOf(content?.description?.text?.[locale], shown.description),
  }
}

/**
 * Writes one language's inline edit into the saved hero content; the other languages keep their values.
 * @param content - The saved hero content, or null.
 * @param locale - The edited language.
 * @param draft - The edited texts (an empty text is removed, so the built-in one shows).
 * @returns The new content to save.
 */
export function mergeHero(content: HeroContent | null | undefined, locale: Locale, draft: HeroDraft): HeroContent {
  /**
   * Sets or removes one language's value of a per-language map.
   * @param values - The saved map, e.g. { he: "...", en: "..." }.
   * @param value - The new value; '' removes it.
   * @returns The new map.
   */
  const put = <T,>(values: Partial<Record<Locale, T>> | undefined, value: T | '') => {
    const next = { ...values }
    if (value === '') delete next[locale]
    else next[locale] = value
    return next
  }
  /**
   * Merges one text.
   * @param saved - Its saved content.
   * @param value - Its edited value.
   * @returns Its new content.
   */
  const text = (saved: SectionText | undefined, value: TextValue): SectionText => ({
    ...saved,
    text: put(saved?.text, value.text.trim()),
    font: put(saved?.font, value.font),
    size: put(saved?.size, value.size),
  })
  return {
    ...content,
    title: { ...text(content?.title, draft.title), accent: put(content?.title?.accent, draft.accent.text.trim()) },
    tagline: text(content?.tagline, draft.tagline),
    description: text(content?.description, draft.description),
  }
}

/**
 * The home page hero.
 * @param props.images - The photos to cycle through; defaults to the folder src/assets/hero
 *   (HERO_IMAGES). Pass another list to feed it from elsewhere, e.g. a CMS.
 * @param props.content - The texts, fonts and sizes staff saved (see resolveHero); null or omitted = the defaults.
 * @param props.onSave - Stores new content (rejects with an ApiError on refusal); given = staff can edit in place.
 * @param props.editor - Shown at the top end of the hero (hidden while editing in place), e.g. the dialog's
 *   button; omitted = nothing.
 * @returns The hero <section>.
 */
export function Hero({
  images = HERO_IMAGES,
  content,
  onSave,
  editor,
}: {
  images?: HeroImage[]
  content?: HeroContent | null
  onSave?: (content: HeroContent) => Promise<unknown>
  editor?: ReactNode
}) {
  const { t, locale } = useI18n()
  const shown = resolveHero(content, locale)
  const inline = useInlineDraft<keyof HeroDraft>(async (draft) => onSave?.(mergeHero(content, locale, draft)))
  const { editing } = inline
  // Once edited, the texts stop rising in: they would replay the entrance on every switch between the modes.
  const [settled, setSettled] = useState(false)
  const rise = settled ? '' : 'animate-hero-rise'
  /**
   * What one text shows: its draft while editing, else the resolved value.
   * @param key - The text.
   * @param resolved - Its value in read mode.
   * @returns The value for EditableText.
   */
  const valueOf = (key: keyof HeroDraft, resolved: TextValue) => (inline.draft ? inline.draft[key] : resolved)
  const builtIn = t.hero
  const e = t.hero.edit
  /** The texts' names, for their boxes and the PropBar ("Editing: Tagline"). */
  const labels: Record<keyof HeroDraft, string> = { title: e.titleMain, accent: e.titleAccent, tagline: e.tagline, description: e.descriptionText }
  const propBar = inline.propBar(labels)
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [zoomReady, setZoomReady] = useState(false)
  const [userPaused, setUserPaused] = useState(false)

  // The first photo is visible straight away (good for load speed). Its slow zoom starts two animation
  // frames later: the browser must paint the un-zoomed photo first, or it has nothing to zoom from.
  useEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setZoomReady(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [])

  const count = images.length
  const current = count ? index % count : 0
  const hasControls = count > 1
  const autoplay = hasControls && !reducedMotion
  const running = autoplay && !userPaused

  /**
   * Builds the accessible name of a dash, e.g. "Show photo 2 of 3".
   * @param i - Zero-based photo number.
   * @returns The translated label.
   */
  const photoLabel = (i: number) => t.hero.showPhoto.replace('{n}', String(i + 1)).replace('{total}', String(count))

  /** Shows the next photo (wrapping to the first); called when the active progress dash finishes. */
  const showNext = () => setIndex((current + 1) % count)

  /**
   * Scrolls to the next home section. The router's Link would navigate to the same URL again on the
   * second click (no scroll, since the hash is unchanged), so this scrolls by hand and cancels the navigation.
   * The href stays for crawlers and for clicks with modifier keys.
   * @param event - The click on the scroll-down arrow.
   */
  const scrollDown = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(HERO_LINKS.scrollDown.hash)
    if (!target) return
    event.preventDefault()
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  return (
    <section
      id="home"
      className={cn(
        'relative isolate h-[calc(100svh-5.5rem)] max-h-[960px] min-h-[600px] overflow-hidden bg-linear-to-br from-black via-brand-charcoal to-brand-charcoal-3',
        // While editing, the boxes' frames and a wrapped bar can add height: the hero grows instead of cutting off.
        editing && 'h-auto max-h-none py-28',
      )}
    >
      {images.map((image, i) => (
        <img
          key={image.src}
          src={image.src}
          srcSet={image.srcSet}
          sizes="100vw"
          alt=""
          draggable={false}
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : 'auto'}
          decoding="async"
          data-active={i === current}
          data-zoom={zoomReady && i === current}
          className="hero-slide absolute inset-0 size-full object-cover"
        />
      ))}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/85 via-black/50 to-black/15 rtl:bg-linear-to-l" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-black/20" />
      <div className="pointer-events-none absolute inset-0 bg-black/30 lg:hidden" />
      <div className="absolute inset-y-0 start-0 z-10 w-1 bg-brand-red" aria-hidden="true" />

      <div className={cn('relative z-10 mx-auto flex h-full max-w-screen-2xl flex-col justify-center', PAGE_GUTTER)}>
        <form {...inline.formProps} className="max-w-3xl">
          <div className="mb-5 flex animate-hero-rise items-center gap-3 [animation-delay:200ms]">
            <span aria-hidden="true" className="h-px w-8 bg-brand-red" />
            <span className="font-heading text-2xs font-semibold uppercase tracking-ultra-wide text-white/90">
              {t.hero.eyebrow}
            </span>
          </div>
          <EditableText
            as="h1"
            value={valueOf('title', shown.title)}
            editing={editing}
            onChange={(change) => inline.change('title', change)}
            selected={inline.active === 'title'}
            onSelect={() => inline.select('title')}
            label={e.titleMain}
            locale={locale}
            placeholder={builtIn.title}
            sizeClass={(size) => titleSize({ size })}
            className={cn('mb-5 font-display leading-[1.05] font-bold tracking-display text-white [animation-delay:350ms]', rise)}
            before={
              <img
                src={logoMarkUrl}
                alt=""
                width={322}
                height={322}
                draggable={false}
                className="me-4 inline-block size-[0.8em] select-none align-[-0.05em] drop-shadow-2xl"
              />
            }
            after={
              <>
                {' '}
                <EditableText
                  as="span"
                  value={editing ? valueOf('accent', shown.title) : { ...shown.title, text: shown.title.accent }}
                  editing={editing}
                  onChange={(change) => inline.change('accent', change)}
                  onSelect={() => inline.select('title')}
                  label={e.titleAccent}
                  locale={locale}
                  placeholder={builtIn.titleAccent}
                  controls={false}
                  className="text-brand-red ltr:italic"
                />
              </>
            }
          />
          <EditableText
            value={valueOf('tagline', shown.tagline)}
            editing={editing}
            onChange={(change) => inline.change('tagline', change)}
            selected={inline.active === 'tagline'}
            onSelect={() => inline.select('tagline')}
            label={e.tagline}
            locale={locale}
            placeholder={builtIn.tagline}
            sizeClass={(size) => taglineSize({ size })}
            className={cn('mb-4 max-w-2xl font-heading leading-snug font-medium text-white/90 [animation-delay:500ms]', rise)}
          />
          <EditableText
            value={valueOf('description', shown.description)}
            editing={editing}
            onChange={(change) => inline.change('description', change)}
            selected={inline.active === 'description'}
            onSelect={() => inline.select('description')}
            label={e.descriptionText}
            locale={locale}
            placeholder={builtIn.description.trim()}
            multiline
            sizeClass={(size) => descriptionSize({ size })}
            className={cn('mb-10 max-w-xl leading-relaxed text-white/80 [animation-delay:600ms]', rise)}
          />
          <div className="flex animate-hero-rise flex-col gap-4 [animation-delay:750ms] sm:flex-row sm:flex-wrap">
            <Button asChild className="px-9 py-5 text-sm">
              <Link {...HERO_LINKS.brands.link}>
                {HERO_LINKS.brands.label(t)}
                <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
              </Link>
            </Button>
            {/* <Button asChild variant="ghostWhite" className="px-9 py-5 text-sm">
              <Link {...HERO_LINKS.business.link}>{HERO_LINKS.business.label(t)}</Link>
            </Button> */}
          </div>
        </form>
      </div>

      {hasControls && (
        <div className={cn('absolute inset-x-0 bottom-6 z-10 mx-auto flex max-w-screen-2xl justify-end', PAGE_GUTTER)}>
          <div
            role="group"
            aria-label={t.hero.slideshowLabel}
            className="flex items-center"
          >
            {images.map((image, i) => (
              <button
                key={image.src}
                type="button"
                aria-label={photoLabel(i)}
                aria-current={i === current ? 'true' : undefined}
                onClick={() => setIndex(i)}
                className="group/dash flex h-6 items-center px-1 outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span
                  className={cn(
                    'block h-0.5 overflow-hidden transition-all duration-300',
                    i === current ? 'w-14 bg-white/25' : 'w-5 bg-white/40 group-hover/dash:bg-white/70',
                  )}
                >
                  {i === current &&
                    (autoplay ? (
                      <span
                        key={current}
                        className="hero-progress block h-full bg-brand-red"
                        data-running={running}
                        style={{ animationPlayState: running ? 'running' : 'paused' }}
                        onAnimationEnd={showNext}
                      />
                    ) : (
                      <span className="block h-full w-full bg-brand-red" />
                    ))}
                </span>
              </button>
            ))}
            {autoplay && (
              <button
                type="button"
                aria-label={userPaused ? t.hero.play : t.hero.pause}
                onClick={() => setUserPaused(!userPaused)}
                className="ms-3 flex size-9 items-center justify-center rounded-full border border-white/40 text-white/80 outline-none transition-[color,border-color,scale] hover:border-white hover:text-white focus-visible:ring-2 focus-visible:ring-white active:scale-90 active:duration-100"
              >
                {userPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>
      )}

      {(onSave || editor) && (
        <div className={cn('absolute inset-x-0 top-6 z-20 mx-auto flex max-w-screen-2xl flex-wrap justify-end gap-3', PAGE_GUTTER)}>
          {onSave && (
            <InlineEditBar
              {...inline.bar}
              label={e.section}
              onEdit={() => {
                setSettled(true)
                inline.start(heroDraft(content, locale), 'title')
              }}
            />
          )}
          {propBar && <PropBar {...propBar} locale={locale} />}
          {!editing && editor}
        </div>
      )}

      <Link
        {...HERO_LINKS.scrollDown}
        onClick={scrollDown}
        aria-label={t.hero.scrollDown}
        className="absolute inset-x-0 bottom-3 z-10 mx-auto w-fit animate-hint-down p-2 text-white/60 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white"
      >
        <ChevronDown size={28} aria-hidden="true" />
      </Link>
    </section>
  )
}
