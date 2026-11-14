/**
 * motion.ts — The JavaScript side of the site's shared motion (the CSS side is in src/index.css).
 *
 * `imgFade`: a photo fades in once it has loaded instead of popping in. Give the <img> the `img-fade` class and
 * spread these handlers on it; they mark it `data-loaded` on load, or on error (so a broken picture still shows its alt
 * text instead of staying transparent). Used by the cards and galleries that show photos (CategoryCard, BrandCard,
 * CatalogCard, ArticleCard, ProductGallery).
 */
import type { SyntheticEvent } from 'react'

/**
 * Marks a photo as loaded (or failed), which the `img-fade` utility shows.
 * @param event - The image's load or error event.
 */
function markLoaded(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.dataset.loaded = ''
}

/** The handlers of a photo that fades in: spread them on an <img className="img-fade ..."> element. */
export const imgFade = { onLoad: markLoaded, onError: markLoaded } as const
