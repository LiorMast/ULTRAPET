/**
 * SectionHeading.tsx — The heading block that opens a page section: a small red uppercase eyebrow, the title and an
 * optional intro paragraph. The home sections (Categories, About, FAQ, Contact) open with it, so every section
 * starts the same way; pages can use it with `as="h1"`.
 */
import type { ReactNode } from 'react'
import { cn } from 'cn'

/**
 * The eyebrow, title and intro of a section.
 * @param props.id - The title's id, for the section's aria-labelledby.
 * @param props.eyebrow - The short label above the title.
 * @param props.title - The title.
 * @param props.intro - The paragraph under the title; omitted when not given.
 * @param props.as - The title's heading level: "h2" (default, a page section) or "h1" (a page's own heading).
 * @param props.className - Extra classes for the wrapper (it is max-w-3xl by default).
 * @returns The heading block.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  as: Heading = 'h2',
  className,
}: {
  id: string
  eyebrow: ReactNode
  title: ReactNode
  intro?: ReactNode
  as?: 'h1' | 'h2'
  className?: string
}) {
  return (
    <div className={cn('max-w-3xl', className)}>
      <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-red">{eyebrow}</p>
      <Heading id={id} className="mt-4 font-display text-4xl font-bold text-brand-charcoal lg:text-5xl">
        {title}
      </Heading>
      {intro && <p className="mt-5 text-lg text-brand-charcoal-muted">{intro}</p>}
    </div>
  )
}
