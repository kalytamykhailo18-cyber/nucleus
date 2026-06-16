/**
 * Classify an Eview MQTT message into the Nucleus event_type the row
 * gets stored under. Mirrors `sensu-api/eview/{mqtt_service,alarm_parser}.py`
 * — same bit positions, same string-form names, same priorities.
 *
 * Two payload shapes coexist on the broker today:
 *
 *   - "Simplified": `data.alarmType` is a string like `sosKey` / `fallDown` /
 *     `geo1`. Most modern firmware uses this.
 *   - "Bitmask": legacy firmware sets `data.generalData.alarmCode` (32-bit).
 *     We test bits in priority order — fall (2) before SOS (12) before
 *     geofence (4..7) before battery (0).
 *
 * Heartbeat (`trackerRealTime`) events are skipped. They land thousands of
 * times per device per day and aren't user-facing alerts.
 */

export interface ClassifiedEvent {
  /** Final eventType string written to EviewEvent.eventType */
  eventType: string;
  /** Whether this row should be persisted at all (false for heartbeats / SOS-end) */
  persist: boolean;
  /** Optional buttonType label (mirrors Python's parse_button_type result) */
  buttonType: string | null;
}

const ALARM_TYPE_TO_EVENT: Record<string, string> = {
  sosKey: 'sos',
  sosEnd: 'sos_ending',
  sosStop: 'sos_stop',
  // EV-12 emits a generic `alarmEnd` when any active alarm (fall, SOS) clears
  // — Lucas, Eview FAE, 2026-05-09. Status update, never a user alert.
  alarmEnd: 'alarm_ending',
  // Note: sideKey1 / sideKey2 are EC01-only ("welfare check in/out", per
  // Lucas 2026-05-15). Our fleet (EV-04 / EV-12 / MX037) never emits them,
  // so they aren't mapped here. If a future device ever does, classify()
  // falls through to `topicEventType` and the row is persisted as raw
  // trackerAlarm rather than mis-classified as a button press.
  fallDown: 'fall_detection',
  batteryLow: 'battery_low',
};

const ALARM_TYPE_TO_BUTTON: Record<string, string> = {
  sosKey: 'SOS Button',
  sosEnd: 'SOS Ending',
  sosStop: 'SOS Stop',
};

const GEO_TYPES: Record<string, number> = {
  geo1: 1,
  geo2: 2,
  geo3: 3,
  geo4: 4,
};

// Bitmask positions on the legacy alarmCode integer.
const BIT_BATTERY_LOW = 0;
const BIT_FALL_DETECTION = 2;
const BIT_GEO_FIRST = 4; // bits 4..7 are zones 1..4
const BIT_SOS = 12;
const BIT_GEO_DIRECTION_OFFSET = 22; // direction bit for zone N is at (BIT_GEO_FIRST + zone-1) + 22

// Side Call Button 1/2 (bits 13/14) are EC01-only ("welfare check in/out"
// per Lucas, 2026-05-15) — our fleet never sets them. Keeping them out of
// this table means a stray test payload won't synthesize a phantom button
// press on EV-04 / EV-12 devices.
const BUTTON_BITS: Array<[number, string]> = [
  [12, 'SOS Button'],
  [17, 'SOS Ending'],
  [11, 'SOS Stop'],
];

function bitSet(code: number, bit: number): boolean {
  return (code & (1 << bit)) !== 0;
}

export function parseButtonType(alarmCode: number | null | undefined): string | null {
  if (alarmCode == null || alarmCode === 0) return null;
  for (const [bit, name] of BUTTON_BITS) {
    if (bitSet(alarmCode, bit)) return name;
  }
  return null;
}

export function classify(
  topicEventType: string,
  payload: Record<string, unknown>,
): ClassifiedEvent {
  // Heartbeats: skip entirely. They aren't alerts.
  if (topicEventType === 'trackerRealTime') {
    return { eventType: topicEventType, persist: false, buttonType: null };
  }

  const data = (payload.data as Record<string, unknown> | undefined) ?? {};
  const generalData = (data.generalData as Record<string, unknown> | undefined) ?? {};
  const alarmType = data.alarmType as string | undefined;

  // 1) Simplified payload: string alarmType wins.
  if (alarmType) {
    const mapped = ALARM_TYPE_TO_EVENT[alarmType];
    if (mapped) {
      // SOS end / stop and the generic alarm-ended signal are status updates,
      // not alerts. Don't store.
      if (mapped === 'sos_ending' || mapped === 'sos_stop' || mapped === 'alarm_ending') {
        return { eventType: mapped, persist: false, buttonType: ALARM_TYPE_TO_BUTTON[alarmType] ?? null };
      }
      return {
        eventType: mapped,
        persist: true,
        buttonType: ALARM_TYPE_TO_BUTTON[alarmType] ?? null,
      };
    }
    if (alarmType in GEO_TYPES) {
      // Device sends SMS on exit; default to exit when only the type bit is set.
      return { eventType: 'geofence_exit', persist: true, buttonType: null };
    }
  }

  // 2) Bitmask payload: alarmCode either at root or inside generalData.
  //
  // EV-12 publishes JSON over MQTT where the bitmask rides on `statusCode`
  // inside `generalData` rather than on `alarmCode`. Lucas, Eview FAE,
  // 2026-05-09: "the statusCode field in the JSON payload uses the exact
  // same 32-bit mapping as defined in the private protocol documentation."
  // Safe to read because this branch only runs when topicEventType ===
  // 'trackerAlarm' — heartbeats (trackerRealTime) where statusCode means
  // GPS/charging/battery bits are filtered above.
  const alarmCode =
    (payload.alarmCode as number | undefined) ??
    (generalData.alarmCode as number | undefined) ??
    (generalData.statusCode as number | undefined) ??
    0;

  if (topicEventType === 'trackerAlarm' && alarmCode) {
    if (bitSet(alarmCode, BIT_FALL_DETECTION)) {
      return { eventType: 'fall_detection', persist: true, buttonType: parseButtonType(alarmCode) };
    }
    if (bitSet(alarmCode, BIT_SOS)) {
      return { eventType: 'sos', persist: true, buttonType: parseButtonType(alarmCode) };
    }
    for (let bit = BIT_GEO_FIRST; bit < BIT_GEO_FIRST + 4; bit++) {
      if (bitSet(alarmCode, bit)) {
        const dirBit = bit + BIT_GEO_DIRECTION_OFFSET; // 26..29
        const isEnter = bitSet(alarmCode, dirBit);
        return {
          eventType: isEnter ? 'geofence_enter' : 'geofence_exit',
          persist: true,
          buttonType: parseButtonType(alarmCode),
        };
      }
    }
    if (bitSet(alarmCode, BIT_BATTERY_LOW)) {
      return { eventType: 'battery_low', persist: true, buttonType: parseButtonType(alarmCode) };
    }
  }

  // 3) Generic event from the topic — keep as-is. Covers location-update
  // (`trackerLocation`) and any future event types we forward verbatim.
  return {
    eventType: topicEventType,
    persist: true,
    buttonType: parseButtonType(alarmCode || null),
  };
}

/**
 * Topic format: `/device/{productId}/{deviceId}/message/event/{eventType}`
 * Returns nulls for malformed topics — caller logs and skips.
 */
export function parseTopic(topic: string): {
  productId: string | null;
  deviceId: string | null;
  eventType: string | null;
} {
  const parts = topic.split('/');
  const idx = parts.indexOf('device');
  if (idx === -1) return { productId: null, deviceId: null, eventType: null };
  return {
    productId: parts[idx + 1] ?? null,
    deviceId: parts[idx + 2] ?? null,
    eventType: parts[parts.length - 1] ?? null,
  };
}
