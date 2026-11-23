/**
 * ProductGallery.tsx — The photos of one product: a large photo and, when there are several, a row of
 * thumbnail buttons that switch it (each says which photo it shows; the current one is pressed). The large
 * photo fades in once it has loaded (img-fade; its frame shimmers until then, img-frame), so it cross-fades when it
 * changes. With no photo, a quiet placeholder keeps the layout. Used by the product
 * page (routes/products.$slug.tsx).
 *
 * Mobile-first: on a phone (below md) several photos are a swipe strip like a phone app's (each photo 88% wide, the
 * next one peeking in, snapping to the centre, bleeding into the page's side margins) with a row of dots under it
 * showing which photo is in view (decorative: the photos are swiped, and every photo keeps its alt text); no thumbnails.
 */
import { useRef, useState } from 'react'
import { cn } from 'cn'
import type { ProductDetail } from '@/api'
import { PHONE_QUERY, useMediaQuery } from '@/components/useMediaQuery'
import { useI18n } from '@/i18n'
import { imgFade } from '@/motion'

/**
 * Renders the gallery.
 * @param props.images - The photos in gallery order (the first is the main one).
 * @param props.name - The product's name in the page language: the alt text of a photo without its own.
 * @param props.className - Extra classes for the gallery.
 * @returns The gallery element.
 */
export function ProductGallery({ images, name, className }: { images: ProductDetail['images']; name: string; className?: string }) {
  const { t, locale } = useI18n()
  const [active, setActive] = useState(0)
  const phone = useMediaQuery(PHONE_QUERY)
  const strip = useRef<HTMLUListElement>(null)
  const image = images[Math.min(active, images.length - 1)]

  /** The phone's strip scrolled: the photo nearest its centre becomes the current one (scrollLeft is negative in RTL). */
  const handleScroll = () => {
    const el = strip.current
    const slide = el?.firstElementChild as HTMLElement | null
    if (!el || !slide) return
    setActive(Math.min(images.length - 1, Math.round(Math.abs(el.scrollLeft) / (slide.offsetWidth + 12))))
  }

  if (phone && images.length > 1) {
    return (
      <div role="group" aria-label={t.product.galleryLabel} className={cn('flex flex-col gap-3', className)}>
        {/* Focusable (a scrolling box): the arrow keys scroll it too. */}
        <ul
          ref={strip}
          onScroll={handleScroll}
          tabIndex={0}
          aria-label={t.product.galleryLabel}
          className="-mx-4 flex snap-x outline-none focus-visible:ring-2 focus-visible:ring-brand-red/60 snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {images.map((photo, index) => (
            <li key={photo.src} className="img-frame relative aspect-square w-[88%] shrink-0 snap-center overflow-hidden rounded-3xl bg-neutral-100">
              <img
                src={photo.src}
                alt={photo.alt?.[locale] ?? name}
                width={800}
                height={800}
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : 'auto'}
                decoding="async"
                {...imgFade}
                className="img-fade size-full object-contain p-6 mix-blend-multiply"
              />
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="flex justify-center gap-1.5">
          {images.map((photo, index) => (
            <span
              key={photo.src}
              className={cn('h-1.5 rounded-full transition-[width,background-color] duration-300', index === active ? 'w-5 bg-brand-red' : 'w-1.5 bg-neutral-300')}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div role="group" aria-label={t.product.galleryLabel} className={cn('flex flex-col gap-3', className)}>
      <div className="img-frame relative aspect-square overflow-hidden rounded-3xl bg-neutral-100">
        {image ? (
          <img
            key={image.src}
            src={image.src}
            alt={image.alt?.[locale] ?? name}
            width={800}
            height={800}
            fetchPriority="high"
            decoding="async"
            {...imgFade}
            className="img-fade size-full object-contain p-6 mix-blend-multiply sm:p-10"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-brand-charcoal-muted">
            <p className="text-sm">{t.product.noPhoto}</p>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.map((thumb, index) => (
            <li key={thumb.src}>
              <button
                type="button"
                aria-pressed={index === active}
                aria-label={t.product.showPhoto.replace('{n}', String(index + 1)).replace('{total}', String(images.length))}
                onClick={() => setActive(index)}
                className={cn(
                  'block aspect-square w-full overflow-hidden rounded-xl border-2 bg-neutral-100 transition-[border-color,box-shadow,scale] duration-300 active:scale-[0.97] active:duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/60',
                  index === active ? 'border-brand-red shadow-premium-sm' : 'border-transparent hover:border-neutral-300',
                )}
              >
                <img
                  src={thumb.thumbnail}
                  alt=""
                  width={150}
                  height={150}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-contain p-1.5 mix-blend-multiply"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
