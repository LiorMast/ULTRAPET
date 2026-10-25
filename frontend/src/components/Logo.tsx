/**
 * Logo.tsx — The UltraPet logo: the red dog-and-cat mark beside the "UltraPet" wordmark.
 *
 * Uses the optimized SVGs in src/assets, traced from the official legacy/public/UltraPet_Logo.pdf
 * (about 8 KB each, replacing the legacy 910 KB PNG). Both color versions are stacked and cross-faded,
 * so switching tone — e.g. when the header turns from transparent to white on scroll — is smooth and
 * never flashes while an image loads.
 */
import { cn } from 'cn'
import logoUrl from '@/assets/logo.svg'
import logoWhiteUrl from '@/assets/logo-white.svg'

/**
 * Renders the logo.
 * @param props.tone - "dark" = charcoal "Ultra" for light backgrounds (default);
 *   "light" = white "Ultra" for dark backgrounds.
 * @param props.className - Sizing classes. Set the height (e.g. "h-10"); the width follows the
 *   logo's proportions automatically.
 * @returns The logo, with the accessible name "UltraPet".
 */
export function Logo({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  return (
    <span className={cn('relative inline-block aspect-[1350/323] select-none', className)}>
      <img
        src={logoUrl}
        alt="UltraPet"
        draggable={false}
        className={cn('absolute inset-0 size-full transition-opacity duration-500', tone === 'light' && 'opacity-0')}
      />
      <img
        src={logoWhiteUrl}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={cn('absolute inset-0 size-full transition-opacity duration-500', tone === 'dark' && 'opacity-0')}
      />
    </span>
  )
}
