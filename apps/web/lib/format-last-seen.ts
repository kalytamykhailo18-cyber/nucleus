/**
 * Spanish relative-time formatter for device last-seen timestamps.
 *
 * Returns strings like:
 *   "hace un momento", "hace 5 minutos", "hace 1 hora", "hace 3 días"
 *
 * Works against a fixed `now` so server-rendered output is stable within a
 * single request and tests can pass a known clock.
 */
export function formatLastSeen(
  iso: string | null,
  now: Date = new Date(),
): string {
  if (!iso) return 'Sin conexión registrada';
  const then = new Date(iso);
  const deltaMs = now.getTime() - then.getTime();
  if (deltaMs < 0) return 'Hace un momento';

  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) return 'Hace un momento';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? 'Hace 1 minuto' : `Hace ${minutes} minutos`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? 'Hace 1 hora' : `Hace ${hours} horas`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return days === 1 ? 'Hace 1 día' : `Hace ${days} días`;
  }

  // Beyond 30 days, switch to absolute date so the relative ladder doesn't
  // become misleading.
  return then.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
