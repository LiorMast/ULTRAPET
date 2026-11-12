/**
 * switch.tsx — The site's on/off toggle switch (shadcn/ui on the Radix Switch primitive, restyled for the brand):
 * a square track that turns brand red when on, with a white thumb that slides to the inline end on the shared
 * spring (the right way in RTL and LTR; reduced motion drops the slide). It is a `role="switch"` button, so Space
 * toggles it; name it with a <label htmlFor> on its `id`. Used by DiscountDialog ("Global discount").
 */
import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

/**
 * The toggle switch.
 * @param props.className - Extra classes on the track.
 * @param props - Any other Radix Switch root props (checked, onCheckedChange, id, disabled, aria-*).
 * @returns The switch button.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center border border-transparent bg-neutral-300 p-0.5 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red active:duration-100 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-brand-red",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 bg-white shadow-premium-sm transition-[translate] duration-300 data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
