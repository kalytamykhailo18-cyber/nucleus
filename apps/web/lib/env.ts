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
  // Seeded fixture / Sensu-internal recipient addresses that the email
  // transport refuses to deliver real Resend mail to (the EmailOutboxTest
  // row still gets written so specs can read it). Added 2026-06-17
  // after a Playwright run sent dozens of "Nuevo familiar en tu Angela"
  // notifications to demo@sensu.com.mx which forwards to Ustym's Gmail.
  get NUCLEUS_DEMO_EMAIL(): string | undefined {
    return optional('NUCLEUS_DEMO_EMAIL');
  },
  get NUCLEUS_ADMIN_EMAIL(): string | undefined {
    return optional('NUCLEUS_ADMIN_EMAIL');
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

  // Cloudinary — historical image host for avatars + landing CMS.
  // Retired 2026-06-26 after the upstream account (`dcfjvxt5h`,
  // inherited from Lovable.dev) was disabled and every asset 401'd.
  // Avatars and CMS uploads now write to the local /opt/sensu/uploads
  // mount via NUCLEUS_UPLOADS_* below; these keys remain optional so
  // env.ts does not throw if .env still carries the legacy values
  // (they are simply unread now).
  get CLOUDINARY_CLOUD_NAME(): string | undefined {
    return optional('CLOUDINARY_CLOUD_NAME');
  },
  get CLOUDINARY_API_KEY(): string | undefined {
    return optional('CLOUDINARY_API_KEY');
  },
  get CLOUDINARY_API_SECRET(): string | undefined {
    return optional('CLOUDINARY_API_SECRET');
  },

  // Self-hosted uploads (Option B, 2026-06-26). The container mounts
  // /opt/sensu/uploads at NUCLEUS_UPLOADS_DIR; nginx serves the same
  // directory at NUCLEUS_UPLOADS_PUBLIC_BASE. Routes that previously
  // POSTed to Cloudinary now write the file to disk and persist the
  // public URL on the model (User.avatarUrl, LandingItem.content.url).
  // Marketing-site cutover (Juan 2026-06-29 strategic split). When the
  // sales-managed marketing site at sensu.com.mx is live, flip this
  // flag and Nucleus collapses to a slim login/signup gateway —
  // marketing pages (/, /como-funciona, /planes, audience pages,
  // /soporte) 301 over to NUCLEUS_MARKETING_SITE_BASE_URL. Default
  // off so day-to-day behavior is unchanged until Juan's team is
  // ready to take the front door.
  get NUCLEUS_MARKETING_OFFLOADED(): boolean {
    return optional('NUCLEUS_MARKETING_OFFLOADED') === 'on';
  },
  get NUCLEUS_MARKETING_SITE_BASE_URL(): string {
    return optional('NUCLEUS_MARKETING_SITE_BASE_URL') ?? 'https://sensu.com.mx';
  },
  // Slim-landing toggle (Juan 2026-07-02): render the 3-card gateway
  // on `/` regardless of whether the marketing-site redirects have
  // been enabled. Split from NUCLEUS_MARKETING_OFFLOADED so Juan can
  // shrink the Nucleus front door BEFORE Lovable's custom-domain
  // claim is finished — flipping NUCLEUS_MARKETING_OFFLOADED early
  // would 301 users to a broken sensu.com.mx, but flipping just this
  // one is safe. When marketing-offloaded is later turned on, the
  // slim landing's "Crear cuenta nueva" card follows suit and links
  // out to sensu.com.mx/planes instead of Nucleus's own /planes.
  get NUCLEUS_SLIM_LANDING(): boolean {
    return (
      optional('NUCLEUS_SLIM_LANDING') === 'on' ||
      optional('NUCLEUS_MARKETING_OFFLOADED') === 'on'
    );
  },

  get NUCLEUS_UPLOADS_DIR(): string {
    return optional('NUCLEUS_UPLOADS_DIR') ?? '/app/uploads';
  },
  get NUCLEUS_UPLOADS_PUBLIC_BASE(): string {
    // ABSOLUTE URL required: the profilePatchSchema (and other
    // server-side validators) reject anything that isn't `https://...`
    // because the DB column historically stored Cloudinary's
    // secure_url. A relative `/uploads` default would pass the upload
    // round-trip but blow up the next PATCH /api/auth/me as 422.
    return optional('NUCLEUS_UPLOADS_PUBLIC_BASE') ?? 'https://sensu.com.mx/uploads';
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

  // Plan-picker (Plan A vs Plan B) experiment. Juan 2026-06-18 asked for
  // two checkout options offered side-by-side: A = $2,461 initial fee +
  // existing $638 monthly recurring, B = $10,117 single annual charge in
  // 6 MSI. Default off — flag goes to 'on' the moment Juan confirms the
  // UI copy. NEXT_PUBLIC_ so the picker renders client-side without a
  // server round-trip.
  get NEXT_PUBLIC_PLAN_PICKER_ENABLED(): boolean {
    return optional('NEXT_PUBLIC_PLAN_PICKER_ENABLED') === 'on';
  },

  // Pricing-split for Plan A (Juan / commercial director 2026-06-19).
  // When enabled, /checkout's Plan A path drops the first month from
  // the upfront charge (so the buyer pays only Dispositivo + Envío
  // today, about $2,711 gross), and the renewal worker bills the
  // first $638 monthly cycle a few days later off the saved card.
  // Default off so the existing single-charge Plan A keeps working
  // until Juan greenlights the new shape.
  get NUCLEUS_PRICING_SPLIT_ENABLED(): boolean {
    return optional('NUCLEUS_PRICING_SPLIT_ENABLED') === 'on';
  },

  // Gap (in days) between the initial fee charge and the first monthly
  // cycle when the pricing split is on. Defaults to 3 per Juan's
  // initial sketch; the value is read at webhook time so changing the
  // env var without a rebuild is enough to tune the window.
  get ASSISTED_FIRST_MONTH_DELAY_DAYS(): number {
    const raw = optional('ASSISTED_FIRST_MONTH_DELAY_DAYS');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 && parsed < 30 ? parsed : 3;
  },

  // Free-shipping promo window (Juan 2026-06-24). When the current
  // UTC time is BEFORE the configured ISO datetime, the checkout
  // breakdown drops the Envío line to zero and Stripe is charged
  // accordingly. Flip the env value to extend or kill the promo
  // without a rebuild. Unset / parse-failure → no free shipping.
  get NUCLEUS_FREE_SHIPPING_UNTIL_ISO(): string | null {
    return optional('NUCLEUS_FREE_SHIPPING_UNTIL_ISO') ?? null;
  },

  // Digital Asset Links body for the Android TWA (Ustym 2026-08-11).
  // Verbatim JSON string served at /.well-known/assetlinks.json —
  // Chrome parses this on TWA launch to prove the Android app is
  // legitimately linked to app.sensu.com.mx. Empty string returns
  // `[]` (safe default before the Play Console upload key exists).
  // Package name changed 2026-08-18 from `com.sensu.app` to
  // `com.sensu.angela` — the original package was already burned on
  // Juan's Play Console developer account under a different upload
  // key from an earlier attempt, and Google Play reserves package
  // names permanently once published. The new package goes into a
  // brand-new store listing under the current keystore. Once the
  // Play Console publish is live, add the Google-managed app-signing
  // key SHA-256 alongside the upload-key fingerprint so app updates
  // never break the assetlinks verification.
  get NUCLEUS_ANDROID_ASSETLINKS_JSON(): string | undefined {
    return optional('NUCLEUS_ANDROID_ASSETLINKS_JSON');
  },

  // Apple App Site Association body for iOS Universal Links + App
  // Clip verification. Verbatim JSON string served at
  // /.well-known/apple-app-site-association. Empty until Juan hands
  // over the Apple Developer Team ID from App Store Connect (the
  // Bundle ID is `com.sensu.app` to match the Android package name);
  // route returns `{}` so iOS fails the check gracefully instead of
  // 500-ing. Populated shape looks like
  //   {"applinks":{"details":[{"appIDs":["TEAMID.com.sensu.app"],
  //    "components":[{"/":"*"}]}]}}
  get NUCLEUS_IOS_APPLE_APP_SITE_ASSOCIATION(): string | undefined {
    return optional('NUCLEUS_IOS_APPLE_APP_SITE_ASSOCIATION');
  },

  // Assisted-sales pipeline (Juan 2026-06-20). When enabled, the
  // Stripe webhook treats incoming payment_intent.succeeded events
  // whose metadata carries `assistedSale=true` as standalone WhatsApp
  // sales: it mints a User + Subscription on the fly from the
  // metadata, generates a one-shot PasswordReset token, and emails
  // the buyer a "configura tu contraseña + completa el cuestionario"
  // link. Default off so the standard /checkout signup path is the
  // only one creating Users until the admin-side Payment Link tooling
  // ships.
  get NUCLEUS_ASSISTED_SALES_ENABLED(): boolean {
    return optional('NUCLEUS_ASSISTED_SALES_ENABLED') === 'on';
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
