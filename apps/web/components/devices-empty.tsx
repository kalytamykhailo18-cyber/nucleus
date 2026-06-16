import { LuPackageOpen } from 'react-icons/lu';

/**
 * Empty state for the dashboard's "Tus dispositivos" section.
 * Shown when the signed-in user has zero UserDevice rows.
 */
export function DevicesEmpty() {
  return (
    <div
      data-testid="dashboard-devices-empty"
      className="card-surface rounded-3xl p-8 animate-rise"
    >
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
        <LuPackageOpen aria-hidden className="h-4 w-4 text-sensu-500" />
        Sin dispositivos
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-zinc-900">
        Aún no tienes una Angela asignada a tu cuenta.
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        Cuando recibas tu Angela por mensajería, el call center la activa
        a tu nombre y aparecerá aquí — con su batería, su última conexión y
        las alertas que haya enviado.
      </p>
    </div>
  );
}
