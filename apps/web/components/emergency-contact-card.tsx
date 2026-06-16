import { LuPhone } from 'react-icons/lu';
import { sensuContact } from '@/lib/contact-info';

/**
 * Dashboard SOS reminder.
 *
 * Renders on /dashboard for families with at least one device. The line
 * is what Juan asked for verbatim: tell the family how to escalate when
 * they themselves notice their senior needs help — press the physical
 * SOS button on the Sensu, or call the app-side dispatch number from
 * any phone. The number is rendered as a `tel:` link so a tap on mobile
 * places the call directly.
 *
 * We do NOT render a web-side SOS button on purpose. The pendant button
 * is the alarm; a web button would invite false positives and would
 * trigger the dispatch chain from the wrong place.
 */

export function EmergencyContactCard() {
  const { tel: PHONE_TEL, display: PHONE_DISPLAY } = sensuContact.callcenter();
  return (
    <section
      data-testid="emergency-contact-card"
      role="region"
      aria-label="Contacto de emergencia"
      className="mt-8 rounded-3xl bg-rose-50 ring-1 ring-rose-200 p-5 animate-fade-up [animation-delay:200ms]"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <LuPhone aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0 text-sm leading-relaxed text-zinc-800">
          <p className="font-semibold tracking-tight text-zinc-900">
            ¿Tu familiar necesita ayuda en este momento?
          </p>
          <p className="mt-1">
            Presiona el botón SOS en su Sensu, o llama al{' '}
            <a
              href={`tel:${PHONE_TEL}`}
              data-testid="emergency-contact-tel"
              className="font-semibold text-rose-700 underline underline-offset-2 hover:text-rose-800"
            >
              {PHONE_DISPLAY}
            </a>{' '}
            desde tu teléfono.
          </p>
        </div>
      </div>
    </section>
  );
}
