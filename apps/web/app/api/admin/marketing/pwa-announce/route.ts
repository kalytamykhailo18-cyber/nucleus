import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-audit';
import { sendPwaAnnouncementEmail } from '@/lib/emails/pwa-announcement';

/**
 * POST /api/admin/marketing/pwa-announce
 *
 * One-time blast announcing the PWA install option to existing
 * customers (Juan 2026-06-16). Three audience modes:
 *
 *   - "test"   — only admin@sensu.com.mx, for live-fire verification
 *   - "active" — every ACTIVE-subscription owner (default; the
 *                paying customer base)
 *   - "all"    — every family-side User row, regardless of plan
 *                status (PENDING_PAYMENT, CANCELLED, etc.)
 *
 * Always excludes:
 *   - synthetic worker emails (`@managed.sensu.internal`)
 *   - test fixture emails (`@nucleus-test.local`, `@e2e-pair.local`)
 *   - users with no email
 *   - role=ADMIN (except in "test" mode)
 *
 * Logged via AdminAuditLog so we know who fired the blast and how
 * many people it reached.
 */

export const dynamic = 'force-dynamic';

const schema = z.object({
  audience: z.enum(['test', 'active', 'all']).default('active'),
});

const EXCLUDED_EMAIL_SUFFIXES = [
  '@managed.sensu.internal',
  '@nucleus-test.local',
  '@e2e-pair.local',
];

// Spec / demo-fixture rows on Sensu's own domain. The admin pages keep
// them visible because Playwright asserts on them; the marketing blast
// should never reach them.
const EXCLUDED_EMAIL_PREFIXES = ['demo@', 'demo+'];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 422 });
  }
  const audience = parsed.data.audience;

  let users: Array<{ id: string; email: string; fullName: string | null }> = [];
  if (audience === 'test') {
    const me = await prisma.user.findUnique({
      where: { id: admin.id },
      select: { id: true, email: true, fullName: true },
    });
    if (me) users = [me];
  } else if (audience === 'active') {
    const subs = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: {
        user: { select: { id: true, email: true, fullName: true, role: true } },
      },
      distinct: ['userId'],
    });
    users = subs
      .map((s) => s.user)
      .filter((u) => u && u.role !== 'ADMIN')
      .map((u) => ({ id: u.id, email: u.email, fullName: u.fullName }));
  } else {
    // "all"
    const all = await prisma.user.findMany({
      where: { role: 'USER', kind: 'FAMILY' },
      select: { id: true, email: true, fullName: true },
    });
    users = all;
  }

  // De-dupe by email (defensive — distinct in the query handles most).
  const seen = new Set<string>();
  users = users.filter((u) => {
    const key = u.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  for (const u of users) {
    const lower = u.email.toLowerCase();
    if (
      !lower ||
      EXCLUDED_EMAIL_SUFFIXES.some((s) => lower.endsWith(s)) ||
      EXCLUDED_EMAIL_PREFIXES.some((p) => lower.startsWith(p))
    ) {
      skipped++;
      continue;
    }
    try {
      await sendPwaAnnouncementEmail({
        email: u.email,
        fullName: u.fullName,
      });
      sent++;
    } catch (err) {
      console.error('[pwa-announce] send failed', u.email, err);
      errors++;
    }
  }

  void logAdminAction({
    action: 'marketing.pwa_announce',
    metadata: {
      audience,
      candidates: users.length,
      sent,
      skipped,
      errors,
    },
  });

  return NextResponse.json({
    ok: true,
    audience,
    candidates: users.length,
    sent,
    skipped,
    errors,
  });
}
