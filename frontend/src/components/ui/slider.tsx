/**
 * slider.tsx — The site's slider (shadcn/ui on the Radix Slider primitive, restyled for the brand): a thin grey
 * rounded track whose filled part is brand red, and a round white thumb with a red border that grows a little on hover and
 * settles on press. Each thumb is a `role="slider"` (arrow keys, Home / End, Page Up / Down; the direction follows
 * the page's, from LocaleProvider). Values are arrays, one per head: `heads={1}` (default) picks one value,
 * `heads={2}` picks a range [low, high] and the red fill runs between the two heads. Name a single head with
 * `aria-label` or `aria-labelledby`; name each head of a range with `thumbLabels`; give the value in words with
 * `aria-valuetext` / `thumbValueText` when the number alone does not say enough. `marks` draw labelled ticks under
 * the track at chosen values; with `sticky`, a head dragged near a mark snaps onto it (the arrow keys still step freely) (decorative: the heads carry the values for assistive technology); `inverted` puts
 * the lowest value at the end of the track instead of the start. The heads are always true circles.
 * Used by CatalogPdfDialog (products per page, one head) and CatalogToolbar's price range (two heads).
 */
import * as React from "react"
import { cn } from "cn"
import { Slider as SliderPrimitive } from "radix-ui"

/**
 * The slider.
 * @param props.heads - How many heads (thumbs) it has: 1 = one value, 2 = a range. The `value` / `defaultValue` array should have that many numbers.
 * @param props.thumbLabels - The accessible name of each head, in order (used instead of `aria-label`), e.g. ["Minimum price", "Maximum price"].
 * @param props.thumbValueText - The value of a head in words (e.g. a formatted price), by its number and index; used instead of `aria-valuetext`.
 * @param props.marks - Labelled ticks under the track: { value, label } (the label is shown as given, e.g. a formatted price).
 * @param props.sticky - Heads dragged within 3% of the track of a mark snap onto it, and stay until dragged clear of it.
 * @param props.className - Extra classes on the root.
 * @param props.aria-label - The thumb's accessible name.
 * @param props.aria-labelledby - The id of the element that names the thumb.
 * @param props.aria-valuetext - The value in words, read instead of the number.
 * @param props - Any other Radix Slider root props (value, defaultValue, onValueChange, min, max, step, disabled).
 * @returns The slider.
 */
function Slider({
  heads = 1,
  thumbLabels,
  thumbValueText,
  marks,
  sticky = false,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-valuetext": ariaValueText,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  heads?: 1 | 2
  thumbLabels?: string[]
  thumbValueText?: (value: number, index: number) => string
  marks?: { value: number; label: string }[]
  sticky?: boolean
}) {
  const values = props.value ?? props.defaultValue
  const { min = 0, max = 100, inverted = false, onValueChange, onKeyDown } = props
  // True while the keyboard moves a head: the arrow keys step by one and must not be pulled back onto a mark.
  const byKeyboard = React.useRef(false)

  /**
   * Passes the new values on; when sticky and dragged, a value near a mark is moved onto the mark.
   * @param next - The heads' new values.
   */
  const handleValueChange = (next: number[]) => {
    const reach = (max - min) * 0.03
    const snapped = sticky && !byKeyboard.current && marks ? next.map((value) => marks.find((mark) => Math.abs(mark.value - value) <= reach)?.value ?? value) : next
    onValueChange?.(snapped)
  }
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex h-6 w-full touch-none items-center select-none data-[disabled]:opacity-50 pointer-coarse:h-11", marks?.length && "mb-7", className)}
      {...props}
      onValueChange={handleValueChange}
      onKeyDown={(event) => {
        byKeyboard.current = true
        onKeyDown?.(event)
      }}
      onPointerDown={(event) => {
        byKeyboard.current = false
        props.onPointerDown?.(event)
      }}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-neutral-200">
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full rounded-full bg-brand-red" />
      </SliderPrimitive.Track>
      {Array.from({ length: heads }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          data-slot="slider-thumb"
          aria-label={thumbLabels?.[index] ?? ariaLabel}
          aria-labelledby={thumbLabels ? undefined : ariaLabelledBy}
          aria-valuetext={thumbValueText && values?.[index] !== undefined ? thumbValueText(values[index], index) : ariaValueText}
          className="relative block size-5 cursor-grab rounded-full [corner-shape:round] border-2 touch-target pointer-coarse:size-7 border-brand-red bg-white shadow-premium-sm transition-[scale,box-shadow] duration-300 outline-none hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red active:scale-[0.97] active:cursor-grabbing active:duration-100 data-[disabled]:cursor-not-allowed"
        />
      ))}
      {marks?.map((mark) => {
        const percent = max > min ? ((mark.value - min) / (max - min)) * 100 : 0
        const shown = inverted ? 100 - percent : percent
        return (
          <span
            key={`${mark.value}-${mark.label}`}
            aria-hidden="true"
            data-slot="slider-mark"
            // Where a head's center sits: the thumb (20px) stays inside the track.
            style={{ insetInlineStart: `calc(${shown}% + ${10 - shown * 0.2}px)` }}
            className="pointer-events-none absolute top-full flex -translate-x-1/2 flex-col items-center gap-0.5 rtl:translate-x-1/2"
          >
            <span className="h-1.5 w-px bg-brand-charcoal-muted" />
            <span className="text-2xs font-medium whitespace-nowrap text-brand-charcoal-muted tabular-nums">{mark.label}</span>
          </span>
        )
      })}
    </SliderPrimitive.Root>
  )
}

export { Slider }
