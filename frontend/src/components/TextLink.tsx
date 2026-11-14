/**
 * TextLink.tsx — The site's secondary call to action: a sentence-case, semibold text link (dark brand red by default)
 * whose underline sweeps in from the reading start on hover and keyboard focus (the `link-underline` utility in
 * index.css). No arrow and no icon: the words say where it goes.
 *
 * An internal page takes `link` (TanStack linkOptions, so a wrong route is a type error); another site or a file
 * takes `href` (a plain <a>; `external` opens it in a new tab). A <button> that should look the same uses
 * `textLinkVariants()`. Used by the catalog (the PDF catalog, "show all products", "clear filters"), the product,
 * brand and article pages and the 404 page.
 */
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import type { AppLink } from '@/config'

/** The link's look: dark brand red (default) or muted grey that darkens on hover. */
export const textLinkVariants = cva(
  'link-underline w-fit rounded-sm pb-0.5 font-heading text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-red/60',
  {
    variants: {
      tone: {
        red: 'text-brand-red-dark',
        muted: 'text-brand-charcoal-muted hover:text-brand-charcoal',
      },
    },
    defaultVariants: { tone: 'red' },
  },
)

/** Where a TextLink goes: a page of the site (`link`) or another address (`href`, optionally in a new tab). */
type Target = { link: AppLink; href?: undefined; external?: undefined } | { href: string; external?: boolean; link?: undefined }

/**
 * A text link.
 * @param props.link - An internal page (TanStack linkOptions); give this or `href`.
 * @param props.href - Another address (a file, another site); give this or `link`.
 * @param props.external - With `href`: opens in a new tab (with rel="noopener noreferrer").
 * @param props.tone - "red" (default) or "muted".
 * @param props.className - Extra classes (spacing, placement).
 * @param props.children - The link's words.
 * @returns The <a> element.
 */
export function TextLink({ link, href, external, tone, className, children }: Target & VariantProps<typeof textLinkVariants> & { className?: string; children: ReactNode }) {
  const classes = cn(textLinkVariants({ tone }), className)
  if (link) {
    return (
      <Link {...link} className={classes}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} className={classes} {...(external && { target: '_blank', rel: 'noopener noreferrer' })}>
      {children}
    </a>
  )
}
