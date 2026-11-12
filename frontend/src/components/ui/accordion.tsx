/**
 * ui/accordion.tsx — Expandable panels (shadcn/ui on Radix Accordion), restyled for UltraPet.
 *
 * Used by the home page FAQ section (Faq.tsx); built to serve any list of collapsible panels (product details,
 * admin help, policies). Radix gives the WAI-ARIA accordion pattern: each question is a button inside a heading
 * (h3), with aria-expanded / aria-controls, Arrow Up/Down + Home/End move between the questions, and the reading
 * direction comes from LocaleProvider. `type="single"` keeps one panel open (add `collapsible` so it can be closed
 * again); `type="multiple"` lets any number stay open.
 *
 * Variants (on the root, shared with the parts through context): "line" (default) = rows divided by hairlines,
 * "card" = separate white boxes that lift with a shadow while open.
 *
 * Motion (the site's spring, --ease-spring): a panel grows to its measured height (Radix's
 * --radix-accordion-content-height) while its text fades in and settles from 8px above; closing collapses it faster,
 * the text fading first. The chevron turns to point up while the panel is open. Reduced motion (index.css): panels
 * open and close without resizing or turning the chevron, the text still fades.
 */
import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "cn"
import { Accordion as AccordionPrimitive } from "radix-ui"
import { ChevronDownIcon } from "lucide-react"

/** The visual style of an accordion: hairline-divided rows, or separate boxes. */
type AccordionVariant = "line" | "card"

/** Lets the items, triggers and panels follow the variant chosen on the root. */
const VariantContext = React.createContext<AccordionVariant>("line")

const rootVariants = cva("", { variants: { variant: { line: "", card: "space-y-3" } } })

const itemVariants = cva("", {
  variants: {
    variant: {
      line: "border-b border-neutral-200 first:border-t",
      card: "border border-neutral-200 bg-white transition-[border-color,box-shadow] duration-300 hover:border-brand-red/30 data-[state=open]:border-brand-red/30 data-[state=open]:shadow-premium-sm",
    },
  },
})

const triggerVariants = cva(
  "group/trigger flex flex-1 items-center justify-between gap-6 text-start text-base font-semibold text-brand-charcoal transition-colors duration-300 outline-none hover:text-brand-red focus-visible:ring-2 focus-visible:ring-brand-red/40 disabled:pointer-events-none disabled:opacity-50 lg:text-lg",
  { variants: { variant: { line: "py-6", card: "p-6" } } }
)

/* pe-16 keeps the answer clear of the icon column (size-10 icon + gap-6). */
const panelVariants = cva("text-brand-charcoal-muted", { variants: { variant: { line: "pe-16 pb-6", card: "px-6 pe-16 pb-6" } } })

/**
 * The accordion root: holds the items and decides which may be open.
 * @param props.variant - "line" (default, rows divided by hairlines) or "card" (separate boxes).
 * @param props.type - "single" (one open panel) or "multiple" (any number), from Radix.
 * @param props.className - Extra classes for the wrapper.
 * @param props - Every other Radix Accordion.Root prop: `collapsible`, `value` / `defaultValue`, `onValueChange` ...
 * @returns The accordion element.
 */
function Accordion({ variant = "line", className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Root> & { variant?: AccordionVariant }) {
  return (
    <VariantContext.Provider value={variant}>
      <AccordionPrimitive.Root data-slot="accordion" data-variant={variant} className={cn(rootVariants({ variant }), className)} {...props} />
    </VariantContext.Provider>
  )
}

/**
 * One panel of the accordion: a trigger and its content.
 * @param props.value - The item's unique key (what `value` / `defaultValue` on the root refer to).
 * @param props.className - Extra classes for the item.
 * @param props - Every other Radix Accordion.Item prop (e.g. `disabled`).
 * @returns The item element.
 */
function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  const variant = React.useContext(VariantContext)
  return <AccordionPrimitive.Item data-slot="accordion-item" className={cn(itemVariants({ variant }), className)} {...props} />
}

/**
 * The clickable header of a panel (a button inside an h3) with a chevron that turns to point up while open.
 * @param props.children - The label, e.g. the question.
 * @param props.className - Extra classes for the button.
 * @param props - Every other Radix Accordion.Trigger prop.
 * @returns The heading with the trigger button.
 */
function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  const variant = React.useContext(VariantContext)
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger data-slot="accordion-trigger" className={cn(triggerVariants({ variant }), className)} {...props}>
        <span>{children}</span>
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center bg-neutral-100 text-brand-charcoal transition-[background-color,color,scale] duration-300 group-hover/trigger:bg-brand-red-muted group-hover/trigger:text-brand-red group-active/trigger:scale-[0.92] group-active/trigger:duration-100 group-data-[state=open]/trigger:bg-brand-red group-data-[state=open]/trigger:text-white"
        >
          <ChevronDownIcon className="size-5 transition-[rotate] duration-500 group-data-[state=open]/trigger:rotate-180" />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

/**
 * The collapsible part of a panel. It animates its height (outer element) while the text fades and settles (inner
 * element, which also carries the padding, so Radix measures the full height).
 * @param props.children - The panel content, e.g. the answer.
 * @param props.className - Extra classes for the inner content box.
 * @param props - Every other Radix Accordion.Content prop (e.g. `forceMount`).
 * @returns The animated region.
 */
function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  const variant = React.useContext(VariantContext)
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="group/content overflow-hidden ease-spring data-[state=closed]:animate-accordion-up data-[state=closed]:duration-300 data-[state=open]:animate-accordion-down data-[state=open]:duration-500"
      {...props}
    >
      <div
        className={cn(
          panelVariants({ variant }),
          "ease-spring group-data-[state=closed]/content:animate-out group-data-[state=closed]/content:fade-out-0 group-data-[state=closed]/content:fill-mode-forwards group-data-[state=closed]/content:duration-200 group-data-[state=open]/content:animate-in group-data-[state=open]/content:fade-in-0 group-data-[state=open]/content:slide-in-from-top-2 group-data-[state=open]/content:duration-500",
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
