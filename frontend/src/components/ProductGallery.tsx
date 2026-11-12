/**
 * ProductGallery.tsx — The photos of one product: a large photo and, when there are several, a row of
 * thumbnail buttons that switch it (each says which photo it shows; the current one is pressed). The large
 * photo cross-fades when it changes. With no photo, a quiet placeholder keeps the layout. Used by the product
 * page (routes/products.$slug.tsx).
 */
import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from 'cn'
import type { ProductDetail } from '@/api'
import { useI18n } from '@/i18n'

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
  const image = images[Math.min(active, images.length - 1)]

  return (
    <div role="group" aria-label={t.product.galleryLabel} className={cn('flex flex-col gap-3', className)}>
      <div className="relative aspect-square overflow-hidden border border-neutral-200 bg-neutral-50">
        {image ? (
          <img
            key={image.src}
            src={image.src}
            alt={image.alt?.[locale] ?? name}
            width={800}
            height={800}
            fetchPriority="high"
            decoding="async"
            className="size-full object-contain p-6 mix-blend-multiply animate-in fade-in duration-500 sm:p-10"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 text-brand-charcoal-muted">
            <ImageOff aria-hidden="true" className="size-10" />
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
                  'block aspect-square w-full border bg-neutral-50 transition-[border-color,box-shadow,scale] duration-300 active:scale-[0.97] active:duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/60',
                  index === active ? 'border-brand-red shadow-premium-sm' : 'border-neutral-200 hover:border-neutral-400',
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
