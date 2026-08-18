import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam (Juan 2026-08-07, MVP Step 5). Sets the onShift
 * boolean on any CALLCENTER user without requiring a session. Used
 * by push-dispatch-fanning.spec.ts to seed on-shift / off-shift
 * states across the shared fixture without driving the operator
 * home UI for every state change.
 *
 * Gated by E2E_HOOKS_SECRET — disabled in production. Silently 404s
 * when the secret is missing so callers cannot probe for the seam.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().min(1),
  onShift: z.boolean(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await prisma.user.updateMany({
    where: { id: parsed.data.userId, role: 'CALLCENTER' },
    data: { onShift: parsed.data.onShift },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { error: 'not_callcenter_user' },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, onShift: parsed.data.onShift });
}
