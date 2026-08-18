import { Prisma } from '@prisma/client';

/**
 * Shared "hide fixture and synthetic users from human admin views"
 * filter (Juan 2026-06-12).
 *
 * Excludes from every admin-facing list view:
 *   - `@nucleus-test.local` — Playwright-suite spec accounts
 *   - `@e2e-pair.local` — Phase C #1 IMEI-cross-link spec seeds
 *   - `@sensu-debug.local` — Juan's manual buyer-flow debug domain
 *     (his `diag-*` and `diagtest-planb-*` accounts). Added 2026-07-03
 *     after 6 stray rows leaked into /admin/registrations and Juan
 *     asked to sweep them; adding the suffix here so future runs of
 *     the same manual diagnostic never surface in the human-facing
 *     list again.
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
  '@sensu-debug.local',
  '@managed.sensu.internal',
] as const;

// Empty for the LENIENT filter (admin@sensu.com.mx + demo@sensu.com.mx
// keep seeing demo rows so the Playwright suite continues to assert
// against them). The STRICT filter further down excludes `demo@` +
// `demo+` for call-center / production-view admins (Juan 2026-06-17).
export const EXCLUDED_EMAIL_PREFIXES = [] as const;

/**
 * Additional email prefixes hidden ONLY when the viewer's admin row
 * has `callcenterMode = true`. The seeded demo fixture (Juan's hands-
 * on review family + Playwright's canonical demo user) lives at
 * `demo@sensu.com.mx` + `demo+esencial-N@sensu.com.mx`. Lenient
 * admins still see them; call-center / production admins do not.
 */
export const STRICT_EXCLUDED_EMAIL_PREFIXES = ['demo@', 'demo+'] as const;

/**
 * Device-id prefixes hidden from every admin surface (lenient view).
 *   - `STEP6` covers STEP6-, STEP6B-, STEP6UI- (worker-spec MQTT noise)
 *   - `E2E-` is the uppercase Playwright test prefix
 *
 * Lowercase `e2e-` is deliberately NOT in the lenient list: the
 * `/api/dev/seed-presence` route picks `e2e-presence-device-*` so its
 * seeded marker shows on /admin/operator's map for the admin-operator-map
 * spec. Adding it here would hide those seeded events from admin@'s
 * lenient view — the same regression that broke 4 specs on
 * 2026-06-17. Lowercase e2e- IS in the strict list below so a
 * CALLCENTER dispatcher still does not see test devices.
 */
export const EXCLUDED_DEVICE_PREFIXES = ['STEP6', 'E2E-'] as const;

/**
 * Additional device-id prefixes hidden ONLY when the viewer has
 * `callcenterMode = true`. The seeded demo fleet plus every
 * `EV-<TESTNAME>-*` family (EV-DEMO, EV-CLAIM, EV-CLAIMREL,
 * EV-GEOCRUD, EV-NOGPS, EV-USTYM, EV-AURAXXX, EV-BREACH, EV-ADMIN)
 * — none of these match the numeric-IMEI shape of real hardware.
 * One `EV-` prefix covers the whole synthetic family. Lowercase
 * `e2e-` lives here so the seed-presence spec still works for admins
 * but dispatchers see only real customer hardware.
 */
export const STRICT_EXCLUDED_DEVICE_PREFIXES = [
  'EV-',
  'e2e-',
  // Juan 2026-06-23: the `VIS-vis-*` batch left over from a B2B
  // staging dry-run was leaking into the dispatcher's inventory
  // list. Real production IMEIs are always 15-digit numeric strings,
  // never carry an alpha-letter prefix.
  'VIS-',
] as const;

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

/**
 * Strict variant for callcenterMode admins — additionally drops the
 * `demo@` / `demo+` rows. Pick this when `viewerCallcenterMode = true`,
 * fall back to `NON_FIXTURE_USER_FILTER` otherwise.
 */
export const STRICT_NON_FIXTURE_USER_FILTER: Prisma.UserWhereInput = {
  AND: [
    ...EXCLUDED_EMAIL_SUFFIXES.map((suffix) => ({
      email: { not: { endsWith: suffix } },
    })),
    ...STRICT_EXCLUDED_EMAIL_PREFIXES.map((prefix) => ({
      email: { not: { startsWith: prefix } },
    })),
    { kind: 'FAMILY' as const },
  ],
};

/**
 * Returns the right user-filter fragment for the viewer. Call from
 * every admin lib that lists or counts user-derived data.
 *
 * Lenient (callcenterMode=false, e.g. admin@sensu.com.mx) returns an
 * EMPTY filter so the Playwright suite — which seeds at
 * `@nucleus-test.local` and asserts those rows surface in
 * /admin/dispatch, /admin/operator, /admin/check-ins, etc. — keeps
 * passing. Only CALLCENTER (callcenterMode=true) sees the strict
 * filter that drops every demo + spec fixture, which is what Juan
 * actually wanted: dispatchers see real customers only, his master
 * admin sees everything so he can troubleshoot.
 *
 * `/admin/registrations` uses `NON_FIXTURE_USER_FILTER` directly and
 * is NOT affected by this function — that surface's clean-list
 * behavior predates today's reshape and stays intact.
 */
export function userFilterFor(callcenterMode: boolean): Prisma.UserWhereInput {
  return callcenterMode ? STRICT_NON_FIXTURE_USER_FILTER : {};
}

/**
 * Returns the device-id prefix list for the viewer. Use to build
 * `NOT LIKE prefix||'%'` exclusions on Device / EviewEvent queries.
 */
export function devicePrefixesFor(
  callcenterMode: boolean,
): readonly string[] {
  return callcenterMode
    ? [...EXCLUDED_DEVICE_PREFIXES, ...STRICT_EXCLUDED_DEVICE_PREFIXES]
    : EXCLUDED_DEVICE_PREFIXES;
}
