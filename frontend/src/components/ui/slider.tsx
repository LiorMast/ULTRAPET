/**
 * slider.tsx — The site's slider (shadcn/ui on the Radix Slider primitive, restyled for the brand): a thin grey
 * track whose filled part is brand red, and a square white thumb with a red border that grows a little on hover and
 * settles on press. Each thumb is a `role="slider"` (arrow keys, Home / End, Page Up / Down; the direction follows
 * the page's, from LocaleProvider). Values are arrays, one thumb per value. Name the thumb with `aria-label` or
 * `aria-labelledby`, and give `aria-valuetext` when the number alone does not say enough.
 * Used by CatalogPdfDialog (products per page).
 */
import * as React from "react"
import { cn } from "cn"
import { Slider as SliderPrimitive } from "radix-ui"

/**
 * The slider.
 * @param props.className - Extra classes on the root.
 * @param props.aria-label - The thumb's accessible name.
 * @param props.aria-labelledby - The id of the element that names the thumb.
 * @param props.aria-valuetext - The value in words, read instead of the number.
 * @param props - Any other Radix Slider root props (value, defaultValue, onValueChange, min, max, step, disabled).
 * @returns The slider.
 */
function Slider({
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-valuetext": ariaValueText,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const thumbs = (props.value ?? props.defaultValue ?? [props.min ?? 0]).length
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex h-6 w-full touch-none items-center select-none data-[disabled]:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-1.5 w-full grow bg-neutral-300">
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-brand-red" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbs }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          data-slot="slider-thumb"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-valuetext={ariaValueText}
          className="block size-5 cursor-grab border-2 border-brand-red bg-white shadow-premium-sm transition-[scale,box-shadow] outline-none hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red active:scale-[0.97] active:cursor-grabbing active:duration-100 data-[disabled]:cursor-not-allowed"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
