import { LuPhone } from 'react-icons/lu';
import { sensuContact } from '@/lib/contact-info';

/**
 * Dashboard SOS button (Juan 2026-06-23 — A.2). Big rose tappable card
 * sized like a primary CTA so non-tech-savvy family members (Teresa
 * Cuellar et al.) can spot it without hunting. The whole card is the
 * `tel:` target, so a finger anywhere on it places the call.
 *
 * Two ways to escalate are still surfaced on the page: the prominent
 * dial card here, and the physical SOS button on the Sensu pendant.
 * The web button reaches the same dispatch number device-SOS routes
 * to, so the call lands on the same operator queue.
 */

export function EmergencyContactCard() {
  const { tel: PHONE_TEL, display: PHONE_DISPLAY } = sensuContact.callcenter();
  return (
    <a
      href={`tel:${PHONE_TEL}`}
      data-testid="emergency-contact-card"
      role="button"
      aria-label={`Llamar al Call Center, ${PHONE_DISPLAY}`}
      className="mt-8 flex items-center gap-4 rounded-3xl bg-rose-600 px-5 py-5 text-white shadow-sm ring-1 ring-rose-700 transition-transform animate-fade-up [animation-delay:200ms] hover:-translate-y-0.5 active:scale-[0.99]"
    >
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
        <LuPhone aria-hidden className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-[0.18em] text-rose-100">
          Call Center 24/7
        </p>
        <p className="mt-0.5 text-lg font-semibold tracking-tight">
          Llamar al centro
        </p>
        <p
          className="mt-0.5 text-sm font-medium text-rose-50"
          data-testid="emergency-contact-tel"
        >
          {PHONE_DISPLAY}
        </p>
      </div>
    </a>
  );
}
