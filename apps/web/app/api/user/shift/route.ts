import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { logAdminAction } from '@/lib/admin-audit';

export const dynamic = 'force-dynamic';

/**
 * Call-center shift toggle (Juan 2026-08-04, MVP Step 5).
 *
 * Only the CALLCENTER role can flip its own `onShift` boolean.
 * `false` suppresses standard-tier alerts (battery, geofence,
 * offline) for that operator; critical-tier alerts (sos,
 * fall_detection) always deliver regardless, safety-first override
 * enforced in the push dispatcher.
 *
 * Every toggle writes an AdminAuditLog row so a supervisor can see
 * who was on shift when a specific alert fired — that is the paper
 * trail the call-center manager will ask for the first time a
 * standard-tier alert is missed.
 */

const bodySchema = z.object({
  onShift: z.boolean(),
});

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string; role?: 'USER' | 'ADMIN' | 'CALLCENTER' | 'SALES' }
    | undefined;

  if (!user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (user.role !== 'CALLCENTER') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { onShift: parsed.data.onShift },
    select: { id: true, onShift: true },
  });

  void logAdminAction({
    action: parsed.data.onShift ? 'callcenter.shift_on' : 'callcenter.shift_off',
    targetType: 'User',
    targetId: user.id,
    metadata: { email: user.email ?? null },
  });

  return NextResponse.json({ ok: true, onShift: updated.onShift });
}
