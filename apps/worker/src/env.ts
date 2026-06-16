/**
 * Single source of truth for the worker's runtime environment.
 *
 * Required values throw on access if missing — fail fast, no defaults that
 * silently mask misconfiguration. Optional values return `undefined`.
 *
 * Lazy getters so module load doesn't blow up in CI environments where
 * only a subset of vars are set.
 */
function need(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v : undefined;
}

function needInt(name: string): number {
  const raw = need(name);
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) {
    throw new Error(`Env var ${name} is not a valid integer: ${raw}`);
  }
  return n;
}

export const env = {
  get DATABASE_URL(): string {
    return need('DATABASE_URL');
  },
  get EVIEW_MQTT_HOST(): string {
    return need('EVIEW_MQTT_HOST');
  },
  get EVIEW_MQTT_PORT(): number {
    return needInt('EVIEW_MQTT_PORT');
  },
  get EVIEW_MQTT_USERNAME(): string | undefined {
    return optional('EVIEW_MQTT_USERNAME');
  },
  get EVIEW_MQTT_PASSWORD(): string | undefined {
    return optional('EVIEW_MQTT_PASSWORD');
  },
  get EVIEW_MQTT_CLIENT_ID(): string {
    return need('EVIEW_MQTT_CLIENT_ID');
  },
  get EVIEW_PRODUCT_ID(): string {
    return need('EVIEW_PRODUCT_ID');
  },

  // VAPID — required for any real web push delivery. The dispatcher is a
  // no-op when these are missing, which keeps local dev (no keys) cheap.
  get VAPID_PUBLIC_KEY(): string | undefined {
    return optional('NUCLEUS_VAPID_PUBLIC_KEY');
  },
  get VAPID_PRIVATE_KEY(): string | undefined {
    return optional('NUCLEUS_VAPID_PRIVATE_KEY');
  },
  get VAPID_SUBJECT(): string | undefined {
    return optional('NUCLEUS_VAPID_SUBJECT');
  },

  // Optional E2E hook — when present, the dispatcher captures every push
  // attempt to PushOutboxTest so Playwright can assert without round-
  // tripping a real push service.
  get E2E_HOOKS_SECRET(): string | undefined {
    return optional('E2E_HOOKS_SECRET');
  },

  // Aura (CIMA / pf360.mx) — optional until Juan delivers the token.
  // When set, every SOS / fall_detection MQTT event auto-dispatches to
  // Aura's /api/sos endpoint alongside the existing web-push and
  // call-center caller-ID enrichment paths. Empty value = no-op.
  get AURA_X_TOKEN(): string | undefined {
    return optional('AURA_X_TOKEN');
  },
  get AURA_BASE_URL(): string {
    return optional('AURA_BASE_URL') ?? 'https://apicustomers.pf360.mx';
  },
};
