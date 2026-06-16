import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only sweep (Juan 2026-06-12).
 *
 * Deletes User rows whose email matches a spec-seed pattern, along
 * with all dependent rows (Subscription, UserDevice, EmergencyContact,
 * etc.) via the cascading FK rules. Lets the pair-IMEI spec clean up
 * after itself, and lets the worker / a manual ops call sweep orphans
 * that the spec failed to delete (e.g., after a crashed run).
 *
 * Body accepts an optional list of email suffixes. Defaults to
 * `@e2e-pair.local` since that is the one domain pair-IMEI uses today
 * that is intentionally NOT in the admin-exclusions filter.
 *
 * Gated by E2E_HOOKS_SECRET like every other /api/dev/* endpoint.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  emailSuffixes: z.array(z.string().min(2).max(64)).optional(),
});

const DEFAULT_SUFFIXES = ['@e2e-pair.local'];

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

  const suffixes = parsed.data.emailSuffixes?.length
    ? parsed.data.emailSuffixes
    : DEFAULT_SUFFIXES;

  let deletedUsers = 0;
  let deletedSubscriptions = 0;
  for (const suffix of suffixes) {
    // Subscription has no `onDelete: Cascade` on the User FK, so we
    // must drop the dependent rows first. Every other User relation
    // (UserDevice, EmergencyContact, AlertRead, PasswordReset,
    // CompanyMembership, etc.) does cascade.
    const userIds = await prisma.user.findMany({
      where: { email: { endsWith: suffix } },
      select: { id: true },
    });
    if (userIds.length === 0) continue;
    const ids = userIds.map((u) => u.id);
    const subResult = await prisma.subscription.deleteMany({
      where: { userId: { in: ids } },
    });
    deletedSubscriptions += subResult.count;
    const userResult = await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
    deletedUsers += userResult.count;
  }

  return NextResponse.json({
    ok: true,
    deletedUsers,
    deletedSubscriptions,
    suffixes,
  });
}
