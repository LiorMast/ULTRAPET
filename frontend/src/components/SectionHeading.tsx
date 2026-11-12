/**
 * SectionHeading.tsx — The heading block that opens a page section: a small uppercase eyebrow, the title and an
 * optional intro paragraph. The home sections (Brands, Categories, About, FAQ, Contact) open with it, so every section
 * starts the same way; pages can use it with `as="h1"`. `tone="dark"` is the white-on-black version (Brands).
 *
 * Its three texts are the styled texts of an editable section (EditableSection.tsx): given `edit`, each renders as an
 * EditableText with the font and size staff picked (size steps below; "md" = the design), a box while editing.
 */
import type { ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from 'cn'
import { fieldLabel, type EditableField } from '@/components/EditableSection'
import { EditableText } from '@/components/InlineEditor'
import type { Dictionary } from '@/i18n/he'

// The size class goes first in cn(): tailwind-merge drops a `leading-*` that comes before a text size.

/** The eyebrow's look: its size steps and tone. */
const eyebrowLook = cva('font-heading font-bold uppercase tracking-widest', {
  variants: {
    size: { sm: 'text-2xs', md: 'text-xs', lg: 'text-sm', xl: 'text-base' },
    tone: { light: 'text-brand-red', dark: 'text-white/80' },
  },
  defaultVariants: { size: 'md', tone: 'light' },
})

/** The title's look: its size steps and tone. */
const titleLook = cva('mt-4 font-display font-bold', {
  variants: {
    size: { sm: 'text-3xl lg:text-4xl', md: 'text-4xl lg:text-5xl', lg: 'text-5xl lg:text-6xl', xl: 'text-5xl lg:text-7xl' },
    tone: { light: 'text-brand-charcoal', dark: 'text-white' },
  },
  defaultVariants: { size: 'md', tone: 'light' },
})

/** The intro's look: its size steps and tone. */
const introLook = cva('mt-5', {
  variants: {
    size: { sm: 'text-base', md: 'text-lg', lg: 'text-xl', xl: 'text-2xl' },
    tone: { light: 'text-brand-charcoal-muted', dark: 'text-white/75' },
  },
  defaultVariants: { size: 'md', tone: 'light' },
})

/** The texts of a section heading, as keys of an editable section. */
export type HeadingKey = 'eyebrow' | 'title' | 'intro'

/** The heading's texts as styled keys of an editable section (see useEditableSection's `styled`). */
export const HEADING_KEYS = ['eyebrow', 'title', 'intro'] as const satisfies readonly HeadingKey[]

/**
 * The names of the heading's text boxes, for an editable section's `labels`.
 * @param t - The dictionary.
 * @returns { eyebrow, title, intro } names.
 */
export const headingLabels = (t: Dictionary): Record<HeadingKey, string> => ({ eyebrow: fieldLabel(t, 'eyebrow'), title: fieldLabel(t, 'title'), intro: fieldLabel(t, 'intro') })

/**
 * The eyebrow, title and intro of a section.
 * @param props.id - The title's id, for the section's aria-labelledby.
 * @param props.eyebrow - The short label above the title (ignored with `edit`).
 * @param props.title - The title (ignored with `edit`).
 * @param props.intro - The paragraph under the title; omitted when not given (ignored with `edit`, which always has
 *   an intro).
 * @param props.edit - The section's editable texts: `edit(key)` gives the EditableText props of "eyebrow", "title"
 *   and "intro" (sectionFields' `field`). Omitted = the plain texts above.
 * @param props.as - The title's heading level: "h2" (default, a page section) or "h1" (a page's own heading).
 * @param props.tone - "light" (default: red eyebrow, charcoal title) or "dark" (white texts, for a black section).
 * @param props.className - Extra classes for the wrapper (it is max-w-3xl by default).
 * @returns The heading block.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  edit,
  as: Heading = 'h2',
  tone = 'light',
  className,
}: {
  id: string
  eyebrow?: ReactNode
  title?: ReactNode
  intro?: ReactNode
  edit?: (key: HeadingKey) => EditableField
  as?: 'h1' | 'h2'
  tone?: 'light' | 'dark'
  className?: string
}) {
  if (edit) {
    return (
      <div className={cn('max-w-3xl', className)}>
        <EditableText {...edit('eyebrow')} sizeClass={(size) => eyebrowLook({ size, tone })} />
        <EditableText {...edit('title')} as={Heading} id={id} wrap sizeClass={(size) => titleLook({ size, tone })} />
        <EditableText {...edit('intro')} multiline sizeClass={(size) => introLook({ size, tone })} />
      </div>
    )
  }
  return (
    <div className={cn('max-w-3xl', className)}>
      <p className={eyebrowLook({ tone })}>{eyebrow}</p>
      <Heading id={id} className={titleLook({ tone })}>
        {title}
      </Heading>
      {intro && <p className={introLook({ tone })}>{intro}</p>}
    </div>
  )
}
