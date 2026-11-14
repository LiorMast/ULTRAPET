/**
 * NavText.tsx — The look of the header's menu entries, shared by everything that shows header menu links: the
 * main menu (Navbar: links and the Products dropdown trigger) and the admin drawer (SubNavDrawer). One style, so
 * every header link looks and reacts the same.
 */

/**
 * Text style of the header's menu entries: sentence case, medium weight, in a pill whose soft grey background fades
 * in on hover (and while its dropdown is open); the active page (TanStack's data-status="active") sits on the light
 * brand red with dark red text. The sizes are the text-nav* tokens of index.css (a step larger in Hebrew) at the base
 * / 2xl / 1920px widths; don't pass this through cn() (tailwind-merge would drop text-nav as a second text color).
 */
export const NAV_TEXT =
  'group relative whitespace-nowrap rounded-full px-3 py-2 font-heading text-nav font-medium 2xl:px-3.5 2xl:text-nav-lg min-[1920px]:text-nav-xl text-neutral-700 transition-[color,background-color] duration-300 outline-none hover:bg-neutral-100 hover:text-brand-charcoal focus-visible:ring-2 focus-visible:ring-brand-red data-[state=open]:bg-neutral-100 data-[state=open]:text-brand-charcoal data-[status=active]:bg-brand-red-muted data-[status=active]:text-brand-red-dark'
