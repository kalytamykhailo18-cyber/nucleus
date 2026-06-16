import { FaWhatsapp } from 'react-icons/fa6';

/**
 * Floating WhatsApp CTA button — fixed-position bottom-right corner,
 * green brand color, opens WhatsApp pre-filled with "Hola" via the
 * standard `wa.me` deep link. Mounted globally via the root layout and
 * hidden on auth / admin / app surfaces by `HideOnPaths`, so it only
 * surfaces for visitors on the marketing routes (landing, audience
 * pages, /como-funciona, /planes, /soporte).
 *
 * The phone number is the Sensu Mexico business mobile that Lovable's
 * existing WhatsApp buttons already route to. Brand icon comes from
 * react-icons/fa6 (deviation from the project-wide Lucide rule
 * justified here because the WhatsApp glyph is a recognized brand mark
 * — a generic message bubble would not communicate the same affordance).
 */
export function FloatingWhatsApp(): React.ReactElement {
  return (
    <a
      href="https://wa.me/message/VJ7TT2KIEFTYH1"
      target="_blank"
      rel="noopener noreferrer"
      data-testid="floating-whatsapp"
      aria-label="Contáctanos por WhatsApp"
      className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_rgba(37,211,102,0.45)] ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 active:scale-95 sm:bottom-6 sm:right-6"
    >
      <FaWhatsapp aria-hidden className="h-7 w-7" />
    </a>
  );
}
