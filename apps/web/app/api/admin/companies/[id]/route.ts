import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-audit';
import { companyUpdateSchema } from '@/lib/validation/companies';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = companyUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  try {
    const updated = await prisma.company.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.contactName !== undefined
          ? { contactName: parsed.data.contactName }
          : {}),
        ...(parsed.data.contactEmail !== undefined
          ? { contactEmail: parsed.data.contactEmail }
          : {}),
        ...(parsed.data.contactPhone !== undefined
          ? { contactPhone: parsed.data.contactPhone }
          : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.isActive !== undefined
          ? { isActive: parsed.data.isActive }
          : {}),
        ...(parsed.data.isManagedFleet !== undefined
          ? { isManagedFleet: parsed.data.isManagedFleet }
          : {}),
      },
      select: { id: true, name: true },
    });
    void logAdminAction({
      action: 'company.update',
      targetType: 'Company',
      targetId: updated.id,
      metadata: parsed.data,
    });
    return NextResponse.json({ ok: true, id: updated.id, name: updated.name });
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'P2002') {
      return NextResponse.json({ error: 'name_exists' }, { status: 409 });
    }
    if (code === 'P2025') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id } = await ctx.params;
  try {
    const deleted = await prisma.company.delete({
      where: { id },
      select: { name: true },
    });
    void logAdminAction({
      action: 'company.delete',
      targetType: 'Company',
      targetId: id,
      metadata: { name: deleted.name },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'P2025') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw err;
  }
}
