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
 * - 0 photos: a plain charcoal gradient. 1 photo: no controls. 2 or more: slideshow with controls.
 * - The scroll-down arrow is a real link to the next home section (#stats).
 */
import { useEffect, useState, type MouseEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, ChevronDown, Pause, Play } from 'lucide-react'
import { cn } from 'cn'
import { useReducedMotion } from '@/components/useReducedMotion'
import { Button } from '@/components/ui/button'
import { HERO_IMAGES, HERO_LINKS, type HeroImage } from '@/config'
import { useI18n } from '@/i18n'

/** Same side padding as the navbar, so the hero text lines up with the logo. */
const PAGE_GUTTER = 'px-6 lg:px-10 xl:px-6 2xl:px-10'

/**
 * The home page hero.
 * @param props.images - The photos to cycle through; defaults to the folder src/assets/hero
 *   (HERO_IMAGES). Pass another list to feed it from elsewhere, e.g. a CMS.
 * @returns The hero <section>.
 */
export function Hero({ images = HERO_IMAGES }: { images?: HeroImage[] }) {
  const { t } = useI18n()
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
      className="relative isolate h-[calc(100svh-5.5rem)] max-h-[960px] min-h-[600px] overflow-hidden bg-linear-to-br from-black via-brand-charcoal to-brand-charcoal-3"
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
        <div className="max-w-3xl">
          <div className="mb-5 flex animate-hero-rise items-center gap-3 [animation-delay:200ms]">
            <span aria-hidden="true" className="h-px w-8 bg-brand-red" />
            <span className="font-heading text-2xs font-semibold uppercase tracking-ultra-wide text-white/90">
              {t.hero.eyebrow}
            </span>
          </div>
          <h1 className="mb-5 animate-hero-rise font-display text-[clamp(3.2rem,7.5vw,6.5rem)] leading-[1.05] font-bold text-white [animation-delay:350ms]">
            {t.hero.title} <span className="text-brand-red ltr:italic">{t.hero.titleAccent}</span>
          </h1>
          <p className="mb-4 max-w-2xl animate-hero-rise font-heading text-lg leading-snug font-medium text-white/90 [animation-delay:500ms] lg:text-xl">
            {t.hero.tagline}
          </p>
          <p className="mb-10 max-w-xl animate-hero-rise text-base leading-relaxed text-white/80 [animation-delay:600ms]">
            {t.hero.description}
          </p>
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
        </div>
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
                className="ms-3 flex size-9 items-center justify-center rounded-full border border-white/40 text-white/80 outline-none transition-colors hover:border-white hover:text-white focus-visible:ring-2 focus-visible:ring-white"
              >
                {userPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>
      )}

      <Link
        {...HERO_LINKS.scrollDown}
        onClick={scrollDown}
        aria-label={t.hero.scrollDown}
        className="absolute inset-x-0 bottom-3 z-10 mx-auto w-fit animate-bounce p-2 text-white/60 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white"
      >
        <ChevronDown size={28} aria-hidden="true" />
      </Link>
    </section>
  )
}
