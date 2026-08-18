import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-audit';

export const dynamic = 'force-dynamic';

/**
 * Per-rep update endpoint (Juan 2026-07-30). Supports partial edits to
 * name / email / phone / commission / notes, plus the `active` toggle
 * that retires a rep without deleting historical attribution.
 *
 * `slug` is intentionally NOT editable — reps' checkout links live in
 * marketing collateral and rotating the slug would break every printed
 * or shared link. If the slug truly needs to change, deactivate the
 * old rep row and create a new one.
 */

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().toLowerCase().email().max(255).optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  commissionBps: z.number().int().min(0).max(10_000).optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  try {
    const updated = await prisma.salesRep.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.email !== undefined
          ? { email: parsed.data.email }
          : {}),
        ...(parsed.data.phone !== undefined
          ? { phone: parsed.data.phone }
          : {}),
        ...(parsed.data.commissionBps !== undefined
          ? { commissionBps: parsed.data.commissionBps }
          : {}),
        ...(parsed.data.notes !== undefined
          ? { notes: parsed.data.notes }
          : {}),
        ...(parsed.data.active !== undefined
          ? { active: parsed.data.active }
          : {}),
      },
      select: { id: true, slug: true, name: true, active: true },
    });
    void logAdminAction({
      action: parsed.data.active === false ? 'salesRep.deactivate' : 'salesRep.update',
      targetType: 'SalesRep',
      targetId: updated.id,
      metadata: { slug: updated.slug, name: updated.name },
    });
    return NextResponse.json({ ok: true, rep: updated });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err
    ) {
      const code = (err as { code: string }).code;
      if (code === 'P2025') {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (code === 'P2002') {
        return NextResponse.json({ error: 'email_exists' }, { status: 409 });
      }
    }
    throw err;
  }
}
