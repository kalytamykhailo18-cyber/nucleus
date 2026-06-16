import { LuCircleCheck, LuMail, LuPackage } from 'react-icons/lu';

/**
 * Post-purchase confirmation card shown on the dashboard when:
 *   - the family has paid (subscription is ACTIVE),
 *   - they have completed the senior questionnaire,
 *   - and they do not yet have a device assigned to their account.
 *
 * Sets expectations for the gap between "I just registered" and "the
 * call-center activated my Sensu". Auto-disappears the moment the
 * call-center assigns a device, since the gating condition flips.
 */
export function WelcomePendingDevice() {
  return (
    <section
      data-testid="welcome-pending-device"
      className="mt-8 rounded-3xl bg-emerald-50 ring-1 ring-emerald-200 p-6 animate-fade-up [animation-delay:200ms]"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <LuCircleCheck aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg">
            ¡Tu registro está confirmado!
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700">
            Estamos preparando tu Angela. Te llega en los próximos dos días
            hábiles.
          </p>
        </div>
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        <li className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-emerald-100">
          <LuPackage aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-zinc-700">
            Cuando recibas la Angela, el call-center la activa a nombre de tu
            familiar en pocos minutos.
          </p>
        </li>
        <li className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-emerald-100">
          <LuMail aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-zinc-700">
            Te avisamos por correo y WhatsApp cuando puedas monitorearla
            desde esta plataforma.
          </p>
        </li>
      </ul>
    </section>
  );
}
