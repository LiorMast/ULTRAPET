/**
 * ui/dropdown-menu.tsx — Accessible dropdown menu (shadcn/ui on Radix DropdownMenu).
 *
 * Used by the Navbar's Products menu and by LanguageSwitcher. Radix handles opening (click,
 * Enter / Space / ArrowDown), arrow-key navigation, typeahead, Escape, returning focus to the trigger,
 * and right-to-left layouts (the direction comes from the Direction.Provider in src/i18n/index.tsx).
 * Each part below wraps the Radix part of the same name and adds the default styles; pass `className`
 * to adjust them.
 */
import * as React from "react"
import { cn } from "cn"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { CheckIcon, ChevronRightIcon } from "lucide-react"

/**
 * Root of a dropdown menu; holds the open/closed state.
 * @param props - Radix DropdownMenu.Root props (open, onOpenChange, modal, ...).
 * @returns The menu root.
 */
function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

/**
 * Renders the menu content at the end of <body>, above the page.
 * @param props - Radix DropdownMenu.Portal props.
 * @returns The portal.
 */
function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

/**
 * The button that opens the menu; it gets aria-expanded and aria-haspopup automatically.
 * @param props - Radix DropdownMenu.Trigger props; `asChild` renders your own element instead of a button.
 * @returns The trigger.
 */
function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

/**
 * The floating menu panel, positioned next to the trigger and rendered in a portal.
 * @param props.align - Alignment against the trigger: "start" (default), "center" or "end". Logical, so it flips in RTL.
 * @param props.sideOffset - Gap between the trigger and the panel, in px (default 4).
 * @param props.className - Extra classes, merged over the defaults.
 * @param props - Other Radix DropdownMenu.Content props.
 * @returns The menu panel.
 */
function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        className={cn("z-50 max-h-(--radix-dropdown-menu-content-available-height) w-(--radix-dropdown-menu-trigger-width) min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

/**
 * Groups related items.
 * @param props - Radix DropdownMenu.Group props.
 * @returns The group.
 */
function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

/**
 * One menu entry (role="menuitem"). With `asChild`, a link becomes the entry.
 * @param props.inset - Indent the entry to line up with entries that have an icon.
 * @param props.variant - "destructive" colors the entry red.
 * @param props.className - Extra classes, merged over the defaults.
 * @param props - Other Radix DropdownMenu.Item props (onSelect, disabled, asChild, ...).
 * @returns The menu entry.
 */
function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:ps-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      {...props}
    />
  )
}

/**
 * A menu entry with a check mark that toggles.
 * @param props.checked - Whether the entry is checked.
 * @param props.inset - Indent the entry to line up with entries that have an icon.
 * @param props.children - The entry's label.
 * @param props - Other Radix DropdownMenu.CheckboxItem props (onCheckedChange, ...).
 * @returns The checkbox entry.
 */
function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pe-8 ps-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:ps-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span
        className="pointer-events-none absolute end-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon
          />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

/**
 * Groups radio entries, of which only one can be selected.
 * @param props - Radix DropdownMenu.RadioGroup props (value, onValueChange).
 * @returns The radio group.
 */
function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

/**
 * A selectable option inside a radio group, showing a check mark when selected.
 * @param props.inset - Indent the entry to line up with entries that have an icon.
 * @param props.children - The option's label.
 * @param props - Other Radix DropdownMenu.RadioItem props (value, ...).
 * @returns The radio entry.
 */
function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pe-8 ps-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:ps-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute end-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon
          />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

/**
 * A non-interactive heading inside the menu.
 * @param props.inset - Indent the label to line up with entries that have an icon.
 * @param props - Other Radix DropdownMenu.Label props.
 * @returns The label.
 */
function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground data-inset:ps-8",
        className
      )}
      {...props}
    />
  )
}

/**
 * A thin line between groups of entries.
 * @param props.className - Extra classes (e.g. margins), merged over the defaults.
 * @param props - Other Radix DropdownMenu.Separator props.
 * @returns The separator.
 */
function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

/**
 * Hint text at the end of an entry, such as a keyboard shortcut.
 * @param props - <span> props.
 * @returns The hint.
 */
function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ms-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

/**
 * Root of a nested submenu.
 * @param props - Radix DropdownMenu.Sub props.
 * @returns The submenu root.
 */
function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

/**
 * The entry that opens a submenu; its arrow points the right way in RTL.
 * @param props.inset - Indent the entry to line up with entries that have an icon.
 * @param props.children - The entry's label.
 * @param props - Other Radix DropdownMenu.SubTrigger props.
 * @returns The submenu trigger.
 */
function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:ps-8 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="rtl:rotate-180 ms-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

/**
 * The panel of a nested submenu.
 * @param props.className - Extra classes, merged over the defaults.
 * @param props - Other Radix DropdownMenu.SubContent props.
 * @returns The submenu panel.
 */
function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn("z-50 min-w-[96px] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
