/**
 * RichText.tsx — Shows stored HTML text: the small subset the server allows (p, h2–h4, lists, tables,
 * strong/em, br), styled by `.rich-text` in index.css. Used by the product page for the description; meant also
 * for the legal pages (stubs/pages.json).
 *
 * The HTML is inserted as is, so pass only HTML the API sanitized (GET /api/products/<slug> runs every
 * description through sanitize_html on the way out). Never pass text a visitor typed.
 */
import { cn } from 'cn'

/**
 * Renders sanitized HTML.
 * @param props.html - The HTML, as the API answered it.
 * @param props.lang - The text's language when it differs from the page's (e.g. a Hebrew fallback on an English
 *   page); it also sets the text direction.
 * @param props.className - Extra classes, e.g. spacing.
 * @returns The <div> holding the text.
 */
export function RichText({ html, lang, className }: { html: string; lang?: string; className?: string }) {
  return (
    <div
      lang={lang}
      dir={lang ? (lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr') : undefined}
      className={cn('rich-text', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
