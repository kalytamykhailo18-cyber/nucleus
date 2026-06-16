import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only sweep (Juan 2026-06-15).
 *
 * Deletes every Company whose name matches the Playwright run-suffix
 * pattern (` <cuid>` where the suffix is `Date.now().toString(36)`).
 * Lets `scripts/seed-e2e.sh` run after every redeploy without piling
 * up dozens of stale "Acme Industrial mqcd9ppt" rows in /admin/companies
 * that bury real client rows like Medtronic / Pemex.
 *
 * Preserves anything in the body's `preserve` list (case-insensitive
 * exact name match). Defaults preserve to ['Medtronic'] so the live
 * client row is always safe even if the caller forgets to pass it.
 *
 * Gated by E2E_HOOKS_SECRET like every other /api/dev/* endpoint.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  preserve: z.array(z.string().min(1).max(120)).optional(),
});

const DEFAULT_PRESERVE = ['Medtronic'];

// Same regex pattern as tests/e2e/medtronic_hr_login_and_cleanup.mjs —
// a trailing space + Date.now().toString(36) cuid (≥8 chars, alphanum).
const TEST_NAME_RE = / m[a-z0-9]{7,}$/i;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) {
    return new NextResponse('not found', { status: 404 });
  }

  let raw: unknown = {};
  try {
    raw = (await request.json()) ?? {};
  } catch {
    raw = {};
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  }

  const preserveSet = new Set(
    (parsed.data.preserve?.length ? parsed.data.preserve : DEFAULT_PRESERVE).map(
      (n) => n.toLowerCase(),
    ),
  );

  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
  });

  let deleted = 0;
  const kept: string[] = [];
  for (const c of companies) {
    if (preserveSet.has(c.name.toLowerCase())) {
      kept.push(c.name);
      continue;
    }
    if (!TEST_NAME_RE.test(c.name)) {
      kept.push(c.name);
      continue;
    }
    await prisma.company.delete({ where: { id: c.id } });
    deleted++;
  }

  return NextResponse.json({ ok: true, deleted, keptCount: kept.length });
}
