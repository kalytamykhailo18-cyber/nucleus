/**
 * Single source of truth for runtime environment values.
 *
 * Required entries throw on access if the env var is missing — fail fast,
 * never fall back to a literal default that masks misconfiguration.
 *
 * Optional entries return `undefined` so callers can branch explicitly.
 *
 * Lazy property getters keep `next build` happy: env vars need only be
 * present at runtime when the value is actually read, not at module load.
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

export const env = {
  // Required at runtime.
  get DATABASE_URL(): string {
    return need('DATABASE_URL');
  },
  get AUTH_SECRET(): string {
    return need('AUTH_SECRET');
  },
  get AUTH_URL(): string {
    return need('AUTH_URL');
  },
  get RESEND_FROM(): string {
    return need('RESEND_FROM');
  },
  get STRIPE_SECRET_KEY(): string {
    return need('STRIPE_SECRET_KEY');
  },
  get STRIPE_WEBHOOK_SECRET(): string {
    return need('STRIPE_WEBHOOK_SECRET');
  },
  get NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY(): string {
    return need('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  },

  // Optional — feature is disabled if missing.
  get E2E_HOOKS_SECRET(): string | undefined {
    return optional('E2E_HOOKS_SECRET');
  },
  get RESEND_API_KEY(): string | undefined {
    return optional('RESEND_API_KEY');
  },
  // 'live' (default) → emails go through Resend's HTTP API.
  // 'dev'  → Resend HTTP call is skipped so dev / verification traffic
  //           does not count against the production Resend quota; the
  //           EmailOutboxTest row is still written so E2E assertions
  //           that recover reset links keep working. Flip to 'live' the
  //           moment real customers start arriving.
  get RESEND_MODE(): 'live' | 'dev' {
    const raw = optional('RESEND_MODE');
    return raw === 'dev' ? 'dev' : 'live';
  },
  // HubSpot one-way sync (Phase A+ #2, 2026-06-10). Optional so a missing
  // key turns the integration into a silent no-op rather than crashing
  // signup — identical posture to RESEND_API_KEY. Flip the key in .env
  // to wire Nucleus into the production HubSpot portal.
  get HUBSPOT_API_KEY(): string | undefined {
    return optional('HUBSPOT_API_KEY');
  },
  // 'live' (default) → contacts POST to HubSpot's API.
  // 'dev'  → the HTTP call is skipped (still writes HubSpotOutboxTest
  //           when E2E_HOOKS_SECRET is set, so specs can assert payload).
  get HUBSPOT_MODE(): 'live' | 'dev' {
    const raw = optional('HUBSPOT_MODE');
    return raw === 'dev' ? 'dev' : 'live';
  },
  // Web Push — public key is exposed to the browser so it can subscribe.
  // Step 9: only the public side is read in the web app; the worker owns
  // the private key for signing dispatches.
  get VAPID_PUBLIC_KEY(): string | undefined {
    return optional('NUCLEUS_VAPID_PUBLIC_KEY');
  },
  // Call-center lookup token. /api/callcenter/lookup is gated by header
  // `x-callcenter-token` matching this value — the call-center's dispatch
  // system POSTs the inbound deviceId or caller phone and gets the family
  // roster back so the dispatcher knows whom to phone next.
  get CALLCENTER_API_TOKEN(): string | undefined {
    return optional('CALLCENTER_API_TOKEN');
  },
  // Aura (CIMA / pf360.mx) API integration. Optional — until Aura ships
  // the X-Token for our account, the client lib treats every call as a
  // no-op so the rest of the dispatch chain (web push, call-center
  // lookup) still works. Set AURA_X_TOKEN and we flip the integration
  // on with no code change.
  get AURA_X_TOKEN(): string | undefined {
    return optional('AURA_X_TOKEN');
  },
  get AURA_BASE_URL(): string {
    return optional('AURA_BASE_URL') ?? 'https://apicustomers.pf360.mx';
  },
  // Aura's published number for the Sensu call-center to phone when an
  // operator decides an event warrants Aura's assistance chain. Surfaced
  // as a tel: link in the caller-ID modal at /admin/operator. Configurable
  // so we can flip it without a redeploy if Aura changes the line.
  get AURA_CALL_CENTER_NUMBER(): string {
    return need('AURA_CALL_CENTER_NUMBER');
  },

  // Cloudinary — avatar uploads land here, DB stores the secure_url.
  // Server-side signed upload from /api/profile/avatar.
  get CLOUDINARY_CLOUD_NAME(): string {
    return need('CLOUDINARY_CLOUD_NAME');
  },
  get CLOUDINARY_API_KEY(): string {
    return need('CLOUDINARY_API_KEY');
  },
  get CLOUDINARY_API_SECRET(): string {
    return need('CLOUDINARY_API_SECRET');
  },

  // Public contact info — rendered in client surfaces (CTAs, emails,
  // emergency-contact card). NEXT_PUBLIC_* so they survive client
  // bundling. Required: every render path needs a real number/email,
  // never a stale literal.
  get NEXT_PUBLIC_CALLCENTER_PHONE(): string {
    return need('NEXT_PUBLIC_CALLCENTER_PHONE');
  },
  get NEXT_PUBLIC_WHATSAPP_PHONE(): string {
    return need('NEXT_PUBLIC_WHATSAPP_PHONE');
  },
  get NEXT_PUBLIC_SUPPORT_EMAIL(): string {
    return need('NEXT_PUBLIC_SUPPORT_EMAIL');
  },
};

/**
 * Third-party service constants. Not environment-dependent — these never
 * change between dev/staging/prod — but kept here so source files don't
 * sprinkle URLs and magic strings throughout.
 */
export const constants = {
  RESEND_API_URL: 'https://api.resend.com/emails',
  HUBSPOT_API_URL: 'https://api.hubapi.com',
} as const;
