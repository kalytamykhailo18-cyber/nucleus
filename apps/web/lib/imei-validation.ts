import { z } from 'zod';

/**
 * Shared IMEI validation (2026-07-14).
 *
 * Real Eview / LocTube IMEIs are ALWAYS exactly 15 numeric digits —
 * matches the GSMA standard (14 digits + 1 Luhn check digit).
 *
 * Prior to this file, three human-facing surfaces accepted 8-64
 * characters of `[A-Za-z0-9-]`:
 *   - /api/admin/dispatch/[id]/activate-device  (call-center pairing)
 *   - lib/actions/family-signup.ts              (family watcher signup)
 *   - lib/actions/family-claim.ts               (IMEI-only signup)
 *
 * That looseness let a 16-digit typo slip past validation on
 * 2026-07-14 (Juan hit "PENDING no data" on IMEI 8616290552847401,
 * which was actually 861629052847401 with an extra 5). The Angela
 * itself was fine; LocTube rejected the invalid IMEI, so no telemetry
 * ever flowed. The fix is length + numeric strictness at the door,
 * not deeper in the pipeline.
 *
 * The schema also accepts documented **test-fixture prefixes** — the
 * same ones admin-exclusions hides from human-facing lists (EV-, E2E-,
 * STEP6, VIS-, e2e-). Playwright specs seed synthetic devices with
 * those prefixes and would otherwise break, and a human would never
 * accidentally type "EV-CLAIM-1234" into the admin activation box.
 * The typo vector we care about is numeric-length (15 vs 14 vs 16),
 * not prefix.
 *
 * We do NOT tighten `/api/dev/*` seams. Those seams seed non-real
 * hardware and stay permissive.
 */

// 15 numeric digits (real production IMEIs), OR one of the reserved
// test-fixture prefixes followed by additional characters. Kept in sync
// with EXCLUDED_DEVICE_PREFIXES + STRICT_EXCLUDED_DEVICE_PREFIXES in
// lib/admin-exclusions.ts.
const REAL_IMEI = /^\d{15}$/;
const TEST_FIXTURE_IMEI = /^(EV-|E2E-|STEP6|VIS-|e2e-)[A-Za-z0-9-]+$/;

export const strictImeiSchema = z
  .string()
  .trim()
  .refine((v) => REAL_IMEI.test(v) || TEST_FIXTURE_IMEI.test(v), {
    message: 'El IMEI debe ser exactamente 15 dígitos numéricos.',
  });

export function isValidImei(candidate: string): boolean {
  const t = candidate.trim();
  return REAL_IMEI.test(t) || TEST_FIXTURE_IMEI.test(t);
}

export function isRealImei(candidate: string): boolean {
  return REAL_IMEI.test(candidate.trim());
}
