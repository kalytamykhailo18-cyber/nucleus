import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-audit';
import { companyContactUpdateSchema } from '@/lib/validation/company-contacts';

/**
 * Admin-side PATCH + DELETE for a single CompanyEmergencyContact row
 * (Phase C #1 reshape, Juan 2026-06-10).
 */

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; contactId: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id: companyId, contactId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = companyContactUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  try {
    const updated = await prisma.companyEmergencyContact.update({
      where: { id: contactId, companyId },
      data: {
        ...(parsed.data.fullName !== undefined
          ? { fullName: parsed.data.fullName }
          : {}),
        ...(parsed.data.phone !== undefined
          ? { phone: parsed.data.phone }
          : {}),
        ...(parsed.data.relationship !== undefined
          ? { relationship: parsed.data.relationship }
          : {}),
        ...(parsed.data.priority !== undefined
          ? { priority: parsed.data.priority }
          : {}),
      },
    });
    void logAdminAction({
      action: 'company.contact.update',
      targetType: 'CompanyEmergencyContact',
      targetId: updated.id,
      metadata: { companyId, changes: parsed.data },
    });
    return NextResponse.json({
      ok: true,
      contact: {
        id: updated.id,
        fullName: updated.fullName,
        phone: updated.phone,
        relationship: updated.relationship,
        priority: updated.priority,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; contactId: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id: companyId, contactId } = await ctx.params;
  try {
    await prisma.companyEmergencyContact.delete({
      where: { id: contactId, companyId },
    });
    void logAdminAction({
      action: 'company.contact.delete',
      targetType: 'CompanyEmergencyContact',
      targetId: contactId,
      metadata: { companyId },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw err;
  }
}
