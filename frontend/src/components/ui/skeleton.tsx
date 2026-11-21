/**
 * ui/skeleton.tsx — The site's loading skeletons (shadcn/ui's skeleton, redrawn for UltraPet): pale placeholder shapes
 * in the place and size of content that is still on its way, so the page keeps its layout while it loads.
 *
 * - `Skeleton`: one placeholder shape (a rounded-md bar by default; size and radius by className). A soft shine sweeps
 *   across it in the reading direction (the `skeleton` utility in index.css); reduced motion pulses it in place.
 *   `tone="dark"` for a black section. Always hidden from assistive technology.
 * - `SkeletonText`: placeholder lines that take exactly the height of real text with the same text classes (each line
 *   is one line box of the inherited font size and line height), the last line shorter.
 * - `SkeletonFields`: placeholder form fields (a label line over a control), for a dialog whose values are loading.
 * - `SkeletonGroup`: the polite `role="status"` region around a set of skeletons, so screen readers hear one
 *   "Loading…" (or `label`) instead of nothing.
 *
 * Used by the pages' first-load skeletons (PageSkeleton.tsx, routes/__root.tsx), the card skeletons next to their cards
 * (CatalogCardSkeleton, ArticleCardSkeleton, BrandCardSkeleton, SectionHeadingSkeleton), a price that is loading
 * (PriceSlot), the admin dialogs that load their data (Stock, Ribbon colors, PDF catalog) and the Where to Buy map.
 * A photo that is still downloading shimmers in its frame instead (the `img-frame` utility, index.css).
 */
import type { ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { useI18n } from "@/i18n"

/** The placeholder's tone: light on white and pale grey sections, dark on the black ones (white at low opacity). */
const skeletonVariants = cva("skeleton block shrink-0 rounded-md", {
  variants: {
    tone: {
      light: "",
      dark: "[--skeleton-base:rgb(255_255_255/0.08)] [--skeleton-shine:rgb(255_255_255/0.08)]",
    },
  },
  defaultVariants: { tone: "light" },
})

/**
 * One placeholder shape.
 * @param props.className - Size, radius and placement (e.g. "h-6 w-24", "aspect-square w-full rounded-2xl").
 * @param props.tone - light (default) or dark.
 * @returns The decorative placeholder <span> (display: block).
 */
function Skeleton({ className, tone }: { className?: string } & VariantProps<typeof skeletonVariants>) {
  return <span aria-hidden="true" data-slot="skeleton" className={cn(skeletonVariants({ tone }), className)} />
}

/**
 * Placeholder lines of text: give it the text classes of the real text (size, line height, margin) and it takes the
 * same height.
 * @param props.lines - How many lines (default 1).
 * @param props.width - The width of the last (or only) line, a Tailwind width class (default "w-3/5"; "w-full" for
 *   none shorter).
 * @param props.className - The real text's classes (e.g. "mt-5 text-lg").
 * @param props.tone - light (default) or dark.
 * @returns The decorative lines.
 */
function SkeletonText({ lines = 1, width = "w-3/5", className, tone }: { lines?: number; width?: string; className?: string } & VariantProps<typeof skeletonVariants>) {
  return (
    // A flex column, so the lines' margins never collapse into each other or into the block's own margin.
    <span aria-hidden="true" className={cn("flex flex-col", className)}>
      {Array.from({ length: lines }, (_, index) => (
        // 0.8em of ink centered in a 1lh line box: exactly the height of a line of the real text.
        <Skeleton key={index} tone={tone} className={cn("my-[calc((1lh_-_0.8em)/2)] h-[0.8em]", index === lines - 1 ? width : "w-full")} />
      ))}
    </span>
  )
}

/**
 * Placeholder form fields: each a label line over a control (the height of a compact input), e.g. the body of a
 * dialog whose values are still loading.
 * @param props.count - How many fields (default 2).
 * @param props.className - Layout classes (default: stacked 24px apart).
 * @returns The decorative fields.
 */
function SkeletonFields({ count = 2, className }: { count?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex flex-col gap-6", className)}>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="block">
          <SkeletonText className="text-sm" width={index % 2 ? "w-24" : "w-32"} />
          <Skeleton className="mt-2 h-11 w-full rounded-lg" />
        </span>
      ))}
    </span>
  )
}

/**
 * The status region around a set of skeletons: announces that something is loading, once.
 * @param props.label - What is loading, spoken by screen readers (default "Loading…").
 * @param props.className - Layout classes (the skeletons' container).
 * @param props.children - The skeletons (decorative content only).
 * @returns The <div role="status">.
 */
function SkeletonGroup({ label, className, children }: { label?: string; className?: string; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label ?? t.common.loading}</span>
      {children}
    </div>
  )
}

export { Skeleton, SkeletonFields, SkeletonGroup, SkeletonText, skeletonVariants }
