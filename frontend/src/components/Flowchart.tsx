/**
 * Flowchart.tsx — A process drawn as a flow of steps: FlowchartList (the order of the steps and the connectors between
 * them) and FlowchartCard (one step: a picture or icon in a round medallion, a title, a description and an ordinal).
 * Used by the Private Label section (home page and /private-label) and reusable for any "how it works" flow.
 *
 * - FlowchartList renders an ordered list (<ol>): its children are FlowchartCards in flow order. It wraps each in an
 *   <li>, draws a decorative connector between neighbours (double chevrons by default, pointing along the reading
 *   direction, so they flip in RTL) and numbers the cards ("01", "02", ...) unless told not to. `orientation`:
 *   "responsive" = one row of centred cards from `lg`, and below it (mobile-first) a compact timeline: each step a row
 *   with its medallion at the start and its card beside it, a thin line joining the medallions; "vertical" = always
 *   stacked, medallion beside card (e.g. while editing).
 * - FlowchartCard reads its ordinal and the list's orientation from the list (a context), so a card needs no index.
 *   Its title and description are strings (rendered in a heading and a paragraph) or any node styled by the caller,
 *   such as an EditableText with FLOWCHART_TITLE_CLASS / FLOWCHART_TEXT_CLASS; `actions` adds controls under the text.
 */
import { Children, createContext, useContext, type ReactNode } from 'react'
import { ChevronsDown, ChevronsRight } from 'lucide-react'
import { cva } from 'class-variance-authority'
import { cn } from 'cn'

/** How the steps are laid out: stacked on small screens and in a row from `lg`, or always stacked. */
export type FlowchartOrientation = 'responsive' | 'vertical'

/** What is drawn between two steps: double chevrons, a thin line, or nothing. */
export type FlowchartConnector = 'chevrons' | 'line' | 'none'

/** What FlowchartList tells each of its cards. */
type ItemContext = { ordinal?: string; orientation: FlowchartOrientation }

const FlowchartItem = createContext<ItemContext>({ orientation: 'responsive' })

/** The look of a step's title (for a caller that renders its own title node, e.g. an editable one). */
export const FLOWCHART_TITLE_CLASS = 'font-display text-lg font-bold text-brand-charcoal'

/** The look of a step's description (for a caller that renders its own description node). */
export const FLOWCHART_TEXT_CLASS = 'text-sm leading-relaxed text-brand-charcoal-muted'

const listVariants = cva('flex flex-col', {
  variants: {
    orientation: { responsive: 'gap-6 lg:flex-row lg:gap-12', vertical: 'gap-14' },
  },
  defaultVariants: { orientation: 'responsive' },
})

// In a row (from lg) the size-9 (2.25rem) connector sits in the middle of the gap after its step: half the gap plus
// half its own size past the inline end (gap-12 → 2.625rem), halfway down the cards. Below lg (the timeline) it is a
// line under the size-12 medallion's centre, from just below it into the gap before the next one (gap-6). Vertical: it
// sits in the middle of the gap-14 below the step (2.875rem), under the size-20 medallion's centre.
const connectorVariants = cva('pointer-events-none absolute flex items-center justify-center', {
  variants: {
    orientation: {
      responsive:
        'start-[1.4375rem] top-[3.5rem] -bottom-5 w-0.5 lg:start-auto lg:-end-[2.625rem] lg:top-1/2 lg:bottom-auto lg:size-9 lg:-translate-y-1/2',
      vertical: '-bottom-[2.875rem] start-[1.375rem] size-9',
    },
    kind: {
      chevrons: 'text-brand-red',
      line: '',
    },
  },
  defaultVariants: { orientation: 'responsive', kind: 'chevrons' },
})

/**
 * The connector between a step and the next one (decorative: the list's order already says what comes next).
 * @param props.kind - Chevrons or a line ("none" is never rendered).
 * @param props.orientation - The list's orientation.
 * @returns The connector.
 */
function Connector({ kind, orientation }: { kind: Exclude<FlowchartConnector, 'none'>; orientation: FlowchartOrientation }) {
  if (orientation === 'responsive') {
    return (
      <span aria-hidden="true" data-flowchart-connector="" className={connectorVariants({ orientation, kind })}>
        {/* Below lg: the timeline's line down to the next medallion. */}
        <span className="h-full w-0.5 rounded-full bg-brand-red/30 lg:hidden" />
        {kind === 'chevrons' ? (
          <ChevronsRight strokeWidth={2.75} className="hidden size-9 rtl:-scale-x-100 lg:block" />
        ) : (
          <span className="hidden h-px w-full bg-brand-red/40 lg:block" />
        )}
      </span>
    )
  }
  return (
    <span aria-hidden="true" data-flowchart-connector="" className={connectorVariants({ orientation, kind })}>
      {kind === 'chevrons' ? <ChevronsDown strokeWidth={2.75} className="size-9" /> : <span className="h-full w-px bg-brand-red/40" />}
    </span>
  )
}

/**
 * The ordinal shown on a step: its position, two digits.
 * @param index - The step's position, from 0.
 * @returns E.g. "01".
 */
const ordinalOf = (index: number) => String(index + 1).padStart(2, '0')

/**
 * A flow of steps (see the file header).
 * @param props.children - The FlowchartCards, in flow order.
 * @param props.orientation - "responsive" (default: stacked, a row from `lg`) or "vertical" (always stacked).
 * @param props.connector - "chevrons" (default), "line" or "none".
 * @param props.numbered - true (default) = each card shows its position ("01", "02", ...) unless it has its own
 *   ordinal; false = only cards with their own ordinal show one.
 * @param props.label - The list's accessible name, if it needs one (e.g. when several flows share a page).
 * @param props.className - Extra classes for the <ol>.
 * @returns The ordered list.
 */
export function FlowchartList({
  children,
  orientation = 'responsive',
  connector = 'chevrons',
  numbered = true,
  label,
  className,
}: {
  children: ReactNode
  orientation?: FlowchartOrientation
  connector?: FlowchartConnector
  numbered?: boolean
  label?: string
  className?: string
}) {
  const items = Children.toArray(children)
  return (
    <ol aria-label={label} data-orientation={orientation} className={cn(listVariants({ orientation }), className)}>
      {items.map((item, index) => (
        <li key={(item as { key?: string }).key ?? index} className="relative min-w-0 flex-1">
          <FlowchartItem.Provider value={{ ordinal: numbered ? ordinalOf(index) : undefined, orientation }}>{item}</FlowchartItem.Provider>
          {connector !== 'none' && index < items.length - 1 && <Connector kind={connector} orientation={orientation} />}
        </li>
      ))}
    </ol>
  )
}

const cardVariants = cva('flex h-full', {
  variants: {
    orientation: { responsive: 'items-start gap-3 text-start lg:flex-col lg:items-center lg:gap-0 lg:text-center', vertical: 'items-start gap-5 text-start' },
  },
  defaultVariants: { orientation: 'responsive' },
})

const bodyVariants = cva('relative flex w-full flex-1 flex-col rounded-2xl border border-neutral-150 bg-white shadow-soft', {
  variants: {
    orientation: { responsive: 'min-w-0 items-start p-4 pb-5 lg:-mt-8 lg:items-center lg:px-5 lg:pt-12 lg:pb-9', vertical: 'items-start p-6 pb-7' },
  },
  defaultVariants: { orientation: 'responsive' },
})

/**
 * One step of a flow (see the file header). Place it inside a FlowchartList.
 * @param props.media - The step's picture: a lucide icon, an inline SVG or an <img>, shown in the round medallion.
 * @param props.mediaLabel - What the picture shows, when it carries meaning; omitted = decorative (hidden from screen
 *   readers, the usual case: the title says it all).
 * @param props.title - The step's name: a string (rendered in the heading element) or a node styled by the caller.
 * @param props.description - What happens in the step: a string (a paragraph) or a node styled by the caller.
 * @param props.ordinal - The step's own ordinal, e.g. "A"; omitted = the list's numbering.
 * @param props.headingLevel - The heading element of a string title; default "h3".
 * @param props.actions - Controls under the description (e.g. the editor's buttons).
 * @param props.className - Extra classes for the card.
 * @returns The step card.
 */
export function FlowchartCard({
  media,
  mediaLabel,
  title,
  description,
  ordinal,
  headingLevel: Heading = 'h3',
  actions,
  className,
}: {
  media: ReactNode
  mediaLabel?: string
  title: ReactNode
  description?: ReactNode
  ordinal?: string | number
  headingLevel?: 'h2' | 'h3' | 'h4'
  actions?: ReactNode
  className?: string
}) {
  const item = useContext(FlowchartItem)
  const { orientation } = item
  const shownOrdinal = ordinal ?? item.ordinal
  return (
    <div data-flowchart-card="" className={cn(cardVariants({ orientation }), className)}>
      <span
        {...(mediaLabel ? { role: 'img', 'aria-label': mediaLabel } : { 'aria-hidden': true })}
        className={cn(
          'relative z-10 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-charcoal text-white shadow-premium-sm ring-4 ring-white outline-2 outline-offset-2 outline-brand-red/70 [corner-shape:round] [&>img]:size-full [&>img]:object-cover',
          orientation === 'responsive' ? 'mt-1 size-12 [&>svg]:size-5 lg:mt-0 lg:size-20 lg:[&>svg]:size-8' : 'size-20 [&>svg]:size-8',
        )}
      >
        {media}
      </span>
      <div className={bodyVariants({ orientation })}>
        {typeof title === 'string' ? <Heading className={FLOWCHART_TITLE_CLASS}>{title}</Heading> : title}
        {typeof description === 'string' ? <p className={cn('mt-2', FLOWCHART_TEXT_CLASS)}>{description}</p> : description}
        {actions && <div className={cn('mt-5 flex flex-wrap gap-2', orientation === 'responsive' && 'lg:justify-center')}>{actions}</div>}
        {shownOrdinal !== undefined && (
          // Hidden from screen readers: the <ol> already announces each step's position.
          <span
            aria-hidden="true"
            dir="ltr"
            data-flowchart-ordinal=""
            className={cn(
              'absolute rounded-md bg-brand-red px-2.5 py-0.5 font-heading text-xs font-bold text-white tabular-nums shadow-soft',
              orientation === 'responsive' ? '-top-2.5 end-4 lg:inset-x-0 lg:top-auto lg:-bottom-3 lg:mx-auto lg:w-fit' : '-top-3 end-6',
            )}
          >
            {shownOrdinal}
          </span>
        )}
      </div>
    </div>
  )
}
