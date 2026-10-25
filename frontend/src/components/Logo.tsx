/**
 * Logo.tsx — The UltraPet logo: the red dog-and-cat mark beside the "UltraPet" wordmark.
 *
 * Uses the optimized SVG in src/assets, traced from the official legacy/public/UltraPet_Logo.pdf
 * (about 8 KB, replacing the legacy 910 KB PNG).
 */
import { cn } from 'cn'
import logoUrl from '@/assets/logo.svg'

/**
 * Renders the logo.
 * @param props.className - Sizing classes. Set the height (e.g. "h-14"); the width follows the
 *   logo's proportions automatically.
 * @returns The logo image, with the accessible name "UltraPet".
 */
export function Logo({ className }: { className?: string }) {
  return <img src={logoUrl} alt="UltraPet" width={1350} height={323} draggable={false} className={cn('block w-auto select-none', className)} />
}
