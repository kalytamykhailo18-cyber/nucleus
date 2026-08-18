/**
 * Sensu Family App — RICH alert-push payload builder.
 *
 * Pure function so both the family and the operator dispatchers land
 * on identical output for identical input. Every notification the SW
 * ever shows for an alert lands here first.
 *
 * Tier mapping (per implementation plan Step 4):
 *   sos, fall_detection             → critical (loud tone, requireInteraction)
 *   battery_critical, battery_low   → standard (silent / subtle)
 *   geofence_exit, offline          → standard (medium tone)
 *
 * Audience shapes the deep-link URL + the action buttons:
 *   family   → /app/family?alert=<id>, actions: Ya vi + Llamar centro
 *   operator → /admin/operator?alert=<id>, actions: Reconocer + Abrir
 */

export type AlertType =
  | 'sos'
  | 'fall_detection'
  | 'battery_critical'
  | 'battery_low'
  | 'geofence_exit'
  | 'geofence_enter'
  | 'offline'
  | 'button_press'
  | (string & {});

export type AlertTier = 'critical' | 'standard';
export type AlertAudience = 'family' | 'operator';

export interface BuildAlertPayloadInput {
  type: AlertType;
  alertId: string;
  deviceId: string;
  audience: AlertAudience;
  seniorName?: string | null;
  locationLabel?: string | null;
}

export interface RichAlertPayload {
  type: string;
  tier: AlertTier;
  alertId: string;
  deviceId: string;
  title: string;
  body: string;
  url: string;
  actions: Array<{ action: string; title: string }>;
  tag: string;
  requireInteraction: boolean;
  vibrate?: number[];
  /** When true, the OS is asked to render the notification without any
   *  sound. Set on standard-tier alerts (Juan 2026-08-07) so a routine
   *  battery-low ping never mimics the alarm reserved for SOS + fall.
   *  Chromium honours this fully; iOS Safari respects it on 16.4+ but
   *  the OS default sound may still play on some devices — the native
   *  App Store build gets true per-category sound control. */
  silent?: boolean;
}

const CRITICAL_TYPES = new Set<AlertType>(['sos', 'fall_detection']);

const VIBRATE_CRITICAL = [200, 100, 200, 100, 400];
const VIBRATE_STANDARD = [80];

/** Localized title copy for the alert. When we have the senior's name
 *  we prefix it so the family recognizes their loved one immediately.
 *  Operator titles carry more identifying context up front. */
function titleFor(input: BuildAlertPayloadInput): string {
  const { type, seniorName, audience, deviceId, locationLabel } = input;
  const senior = seniorName?.trim() || null;
  const familyBase = ((): string => {
    switch (type) {
      case 'sos':
        return senior ? `${senior} presionó SOS` : 'SOS activado';
      case 'fall_detection':
        return senior
          ? `${senior} · posible caída`
          : 'Posible caída detectada';
      case 'battery_critical':
        return senior
          ? `Batería crítica en el pendant de ${senior}`
          : 'Batería crítica';
      case 'battery_low':
        return senior
          ? `Batería baja en el pendant de ${senior}`
          : 'Batería baja';
      case 'geofence_exit':
        return senior
          ? `${senior} salió de una zona segura`
          : 'Salió de una zona segura';
      case 'geofence_enter':
        return senior
          ? `${senior} entró en una zona segura`
          : 'Entró en una zona segura';
      case 'offline':
        return senior
          ? `Sin señal del pendant de ${senior}`
          : 'Pendant sin conexión';
      case 'button_press':
        return senior ? `${senior} usó el botón lateral` : 'Botón lateral';
      default:
        return 'Nueva alerta de Sensu';
    }
  })();

  if (audience === 'operator') {
    const label = locationLabel ? ` · ${locationLabel}` : '';
    const seniorTag = senior ? ` · ${senior}` : ` · ${deviceId}`;
    switch (type) {
      case 'sos':
        return `SOS${seniorTag}${label}`;
      case 'fall_detection':
        return `Caída detectada${seniorTag}${label}`;
      default:
        return `${familyBase}${label}`;
    }
  }
  return familyBase;
}

function bodyFor(input: BuildAlertPayloadInput): string {
  const { type, audience, locationLabel } = input;
  const locationSuffix = locationLabel ? ` · ${locationLabel}` : '';
  if (audience === 'operator') {
    return 'Toca para abrir el despacho';
  }
  switch (type) {
    case 'sos':
    case 'fall_detection':
      return `Toca para ver ubicación y llamar al centro${locationSuffix}`;
    case 'battery_critical':
      return 'Menos del 10% de batería en el pendant';
    case 'battery_low':
      return '20% o menos de batería en el pendant';
    case 'geofence_exit':
      return `El pendant cruzó una zona segura${locationSuffix}`;
    case 'geofence_enter':
      return `El pendant entró a una zona segura${locationSuffix}`;
    case 'offline':
      return 'Sin señal del pendant por más de 30 minutos';
    case 'button_press':
      return 'El pendant reportó el botón lateral';
    default:
      return 'Abre el panel para ver el detalle';
  }
}

function actionsFor(audience: AlertAudience): Array<{ action: string; title: string }> {
  if (audience === 'family') {
    return [
      { action: 'ack', title: 'Ya lo estoy investigando' },
      { action: 'call_center', title: 'Llamar centro' },
    ];
  }
  return [
    { action: 'operator_ack', title: 'Reconocer' },
    { action: 'open', title: 'Abrir' },
  ];
}

function urlFor(input: BuildAlertPayloadInput): string {
  const encoded = encodeURIComponent(input.alertId);
  if (input.audience === 'operator') {
    return `/admin/operator?alert=${encoded}`;
  }
  return `/app/family?alert=${encoded}`;
}

/**
 * Silent-ack payload (Step 6). Fired to every OTHER subscription on
 * the same alert when a peer acknowledges. The SW recognizes the
 * `type: 'silent_ack'` marker, skips `showNotification`, and closes
 * any active notification with the matching tag so the second phone
 * stops buzzing the moment the first phone taps "Ya vi".
 *
 * `audience` limits the fanout on the server side but the SW handles
 * both variants identically — the field is preserved for outbox
 * assertions.
 */
export interface SilentAckPayload {
  type: 'silent_ack';
  alertId: string;
  ackSource: 'family' | 'operator';
  tag: string;
}

export function buildSilentAckPayload(
  alertId: string,
  ackSource: 'family' | 'operator',
): SilentAckPayload {
  return {
    type: 'silent_ack',
    alertId,
    ackSource,
    tag: alertId,
  };
}

/**
 * Build the RICH payload the SW will receive over the wire. Never
 * throws — malformed inputs still return a valid payload structure
 * with generic copy so a bad seed does not silently drop a real alert.
 */
export function buildAlertPayload(input: BuildAlertPayloadInput): RichAlertPayload {
  const tier: AlertTier = CRITICAL_TYPES.has(input.type as AlertType)
    ? 'critical'
    : 'standard';
  const requireInteraction = tier === 'critical';
  const vibrate = tier === 'critical' ? VIBRATE_CRITICAL : VIBRATE_STANDARD;

  return {
    type: input.type,
    tier,
    alertId: input.alertId,
    deviceId: input.deviceId,
    title: titleFor(input),
    body: bodyFor(input),
    url: urlFor(input),
    actions: actionsFor(input.audience),
    tag: input.alertId,
    requireInteraction,
    vibrate,
    silent: tier !== 'critical',
  };
}
