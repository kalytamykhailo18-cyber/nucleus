import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { logAdminAction } from '@/lib/admin-audit';

/**
 * Admin-only edit of Device.phoneNumber. The call-center uses this to
 * backfill the pendant's SIM number on devices that were activated
 * before the field existed (notably the EV-12 fleet). Surfaced from the
 * caller-ID modal as an inline edit control so the operator can stamp
 * the number without leaving the screen they were already triaging.
 *
 * Inline auth (not requireAdmin) so we return a JSON 401/403 instead of
 * a /dashboard redirect — the modal calls this via fetch() and needs an
 * outcome it can render, not a redirect HTML response.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[+()\d\s-]+$/, 'Phone may contain digits, spaces, +, -, ( )')
    .nullable(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ deviceId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  // ADMIN + CALLCENTER both allowed (Juan 2026-06-23 — C.1 review
  // item). Dispatchers are the ones who actually stamp the pendant
  // SIM number during the activation call, so blocking CALLCENTER
  // here meant the operators saw a permission error in the inline
  // edit modal exactly when they needed to type the number.
  if (!user || (user.role !== 'ADMIN' && user.role !== 'CALLCENTER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { deviceId } = await context.params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', message: parsed.error.issues[0]?.message ?? 'Invalid' },
      { status: 422 },
    );
  }

  const existing = await prisma.device.findUnique({
    where: { deviceId },
    select: { deviceId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const updated = await prisma.device.update({
    where: { deviceId },
    data: { phoneNumber: parsed.data.phoneNumber },
    select: { deviceId: true, phoneNumber: true },
  });
  void logAdminAction({
    action: 'device.phone_update',
    targetType: 'Device',
    targetId: deviceId,
    metadata: { phoneNumber: parsed.data.phoneNumber },
  });
  return NextResponse.json(updated);
}
