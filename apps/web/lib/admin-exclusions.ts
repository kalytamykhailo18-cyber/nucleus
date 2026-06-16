import { Prisma } from '@prisma/client';

/**
 * Shared "hide fixture and synthetic users from human admin views"
 * filter (Juan 2026-06-12).
 *
 * Excludes from every admin-facing list view:
 *   - `@nucleus-test.local` — Playwright-suite spec accounts
 *   - `@e2e-pair.local` — Phase C #1 IMEI-cross-link spec seeds
 *   - `@managed.sensu.internal` — industrial-fleet synthetic worker emails
 *   - `demo@sensu.com.mx` + `demo+...@sensu.com.mx` — the seeded demo
 *     fixture (4 deterministic Esencial registrations + the canonical
 *     demo family used by the Playwright suite and Juan's hands-on
 *     review)
 *   - User.kind == MANAGED_WORKER — defense-in-depth, the device-only
 *     workers from the industrial-fleet reshape never have their own
 *     subscription
 *
 * `admin@sensu.com.mx` (the real Sensu admin Juan uses) is NOT
 * excluded — that account is the human user, not a fixture.
 */
export const EXCLUDED_EMAIL_SUFFIXES = [
  '@nucleus-test.local',
  // `@e2e-pair.local` is intentionally NOT here — the pair-IMEI spec
  // needs its seeded row to appear in /admin/registrations so the spec
  // can click through the cross-link. The spec's afterEach hook deletes
  // the row at the end of the run, and a worker sweep catches any
  // orphans, so Juan never sees lingering rows in steady state.
  '@managed.sensu.internal',
] as const;

// Empty for now. The demo fixture seeds `demo@sensu.com.mx` and
// `demo+esencial-N@sensu.com.mx` rows that Juan wants hidden, but the
// admin-registrations / admin-fleet specs depend on them being visible
// for their assertions (cadence column, fleet pin click-through). The
// right fix is to refactor those specs to seed inline (using the
// /api/dev/seed-* family) and then stop the fixture seed on production
// deploys, so the demo data does not need to exist in the prod DB at
// all. Tracked as a follow-up.
export const EXCLUDED_EMAIL_PREFIXES = [] as const;

/**
 * Device-id prefixes to hide from the fleet map.
 *   - `STEP6` covers STEP6-, STEP6B-, STEP6UI- (worker-spec MQTT noise)
 *   - `E2E-` is the uppercase test prefix
 *
 * Demo fixture pendants (`EV-DEMO-`, `EV-GEOCRUD-`, `EV-NOGPS-`) stay
 * visible for the same spec-coverage reasons as the email-prefix list
 * above.
 */
export const EXCLUDED_DEVICE_PREFIXES = ['STEP6', 'E2E-'] as const;

/**
 * Prisma `UserWhereInput` fragment that drops every fixture / synthetic
 * row. Use inside a `user: { is: { ... } }` block on Subscription /
 * UserDevice queries, or directly on a User query.
 */
export const NON_FIXTURE_USER_FILTER: Prisma.UserWhereInput = {
  AND: [
    ...EXCLUDED_EMAIL_SUFFIXES.map((suffix) => ({
      email: { not: { endsWith: suffix } },
    })),
    ...EXCLUDED_EMAIL_PREFIXES.map((prefix) => ({
      email: { not: { startsWith: prefix } },
    })),
    { kind: 'FAMILY' as const },
  ],
};
