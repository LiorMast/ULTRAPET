/**
 * TabBar.tsx — The app's bottom tab bar on phones and tablets (below xl, where the header has no menu): the main
 * destinations within the thumb's reach, like a phone app's. Rendered once by routes/__root.tsx, on every page.
 *
 * Five equal tabs, each an icon over a short label: the pages of TAB_BAR (src/config.ts: Home, Products, Where to
 * buy), then the account tab, which depends on who is signed in (a visitor: Log in; a business customer: the cart,
 * with its count badge, opening the cart panel, CartDrawer; staff: Admin), then Menu, which opens the full menu
 * drawer (MobileMenu). The tab of the current page is brand red and aria-current="page".
 *
 * Look: the header's translucent material (material-bar) with a hairline above, 64px tall plus the phone's home-bar
 * safe area (in a short window, a phone in landscape: 48px, each icon beside its label); pages keep its height free at
 * their end (--tabbar-h in index.css), and the page scrolls a focused control clear of it (scroll-padding-bottom). From
 * xl it is gone.
 */
import type { ComponentProps, ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Menu, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import type { ProductCategory } from '@/api'
import { useAuth } from '@/auth'
import { CartBadge, CartDrawer } from '@/components/CartDrawer'
import { MobileMenu } from '@/components/MobileMenu'
import { mainNav, TAB_ADMIN, TAB_BAR, TAB_LOGIN, type TabItem } from '@/config'
import { useI18n } from '@/i18n'

/**
 * The look of one tab (a link or a button): the icon over its label, the whole cell a target; brand red when it is the
 * current page, a quick shrink while pressed.
 */
const TAB_CLASS =
  'relative flex size-full flex-col items-center justify-center gap-1 rounded-lg short:flex-row short:gap-2 font-heading text-xs font-medium text-neutral-600 outline-none transition-[color,scale] duration-150 select-none hover:text-brand-charcoal active:scale-95 active:duration-100 focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-inset aria-[current=page]:text-brand-red'

/**
 * The bottom tab bar.
 * @param props.categories - The catalog categories, for the menu drawer's Products group (loaded by the root route).
 * @param props.tabs - The page tabs before the account and Menu tabs; defaults to TAB_BAR from src/config.ts.
 * @returns The fixed <nav> (hidden from xl).
 */
export function TabBar({ categories = [], tabs = TAB_BAR }: { categories?: ProductCategory[]; tabs?: TabItem[] }) {
  const { t, locale } = useI18n()
  const { user } = useAuth()
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <nav
      aria-label={t.tabBar.label}
      data-tab-bar=""
      className="material-bar safe-x fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--color-neutral-200)] xl:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-2xl grid-cols-5 px-1 short:h-12">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <TabLink tab={tab} active={tab.active(pathname)} />
          </li>
        ))}
        <li>
          {user?.kind === 'business' ? (
            <CartDrawer
              renderTrigger={({ label, icon, count, popKey, targetProps }) => (
                <TabButton label={t.tabBar.cart} aria-label={label}>
                  <span {...targetProps} className="relative">
                    {icon}
                    <CartBadge count={count} popKey={popKey} className="-end-2.5 -top-1.5" />
                  </span>
                </TabButton>
              )}
            />
          ) : (
            <TabLink tab={user?.kind === 'staff' ? TAB_ADMIN : TAB_LOGIN} active={(user?.kind === 'staff' ? TAB_ADMIN : TAB_LOGIN).active(pathname)} />
          )}
        </li>
        <li>
          <MobileMenu
            items={mainNav(categories, locale)}
            trigger={
              <TabButton label={t.tabBar.menu}>
                <Menu size={24} strokeWidth={1.75} aria-hidden="true" />
              </TabButton>
            }
          />
        </li>
      </ul>
    </nav>
  )
}

/**
 * A page tab: a link with its icon and label.
 * @param props.tab - The tab (label, icon, link).
 * @param props.active - Whether it is the current page (red, aria-current="page").
 * @returns The link.
 */
function TabLink({ tab, active }: { tab: TabItem; active: boolean }) {
  const { t } = useI18n()
  const Icon: LucideIcon = tab.icon
  return (
    // Exact matching: TanStack marks a link it finds active itself (aria-current), so the tab's own rule (`active`, e.g.
    // Products on a product page) decides the rest.
    <Link {...tab.link} activeOptions={{ exact: true, includeHash: false, includeSearch: false }} aria-current={active ? 'page' : undefined} className={TAB_CLASS}>
      <Icon size={24} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
      {tab.label(t)}
    </Link>
  )
}

/**
 * A tab that opens a panel (the cart, the menu): a <button> with its icon and label. It spreads the other props it is
 * given (a Radix trigger's onClick, aria-expanded, ref ...) onto the button.
 * @param props.label - The visible label (part of the accessible name).
 * @param props.children - The icon (with its badge, if any).
 * @param props - Other <button> props.
 * @returns The button.
 */
function TabButton({ label, children, className, ...props }: { label: string; children: ReactNode } & ComponentProps<'button'>) {
  return (
    <button type="button" className={cn(TAB_CLASS, className)} {...props}>
      {children}
      {label}
    </button>
  )
}
