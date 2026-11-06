/**
 * WhatsAppButton.tsx — The floating WhatsApp circle fixed to the bottom corner of every page.
 * Rendered once by routes/__root.tsx; it opens a chat with the customer-service number (the setting contact_whatsapp,
 * which the root route loads with fetchContact).
 */
import whatsappLogo from '@/assets/whatsapp.svg'
import { Popover } from '@/components/Popover'
import { whatsappUrl } from '@/config'
import { useI18n } from '@/i18n'

/**
 * A 64px round link that opens a WhatsApp chat in a new tab and shows a Popover label on hover/focus. Sits at the end corner (right in LTR, left in RTL).
 * @param props.phone - The WhatsApp number, international (e.g. "+972 52-214-2410"; only its digits are used).
 * @returns The fixed circular link, or nothing when no number is set.
 */
export function WhatsAppButton({ phone }: { phone: string }) {
  const { t } = useI18n()
  if (!phone.replace(/\D/g, '')) return null
  return (
    <a
      href={whatsappUrl(phone)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${t.header.whatsappLabel} – WhatsApp`}
      className="group fixed bottom-5 end-5 z-40 flex size-16 items-center justify-center rounded-full bg-[#21c063] text-white shadow-premium transition-[background-color,box-shadow,scale] hover:bg-[#1aa854] active:scale-[0.97] active:duration-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#21c063]/40 lg:bottom-8 lg:end-8"
    >
      {/* 52px: the bubble's tail tip (the logo's farthest point from its center) touches the 64px circle's edge. */}
      <img src={whatsappLogo} alt="" width={52} height={52} className="size-13" />
      <Popover
        message={t.header.whatsappLabel}
        color="#1A1A1A"
        className="absolute end-full top-1/2 me-3 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </a>
  )
}
