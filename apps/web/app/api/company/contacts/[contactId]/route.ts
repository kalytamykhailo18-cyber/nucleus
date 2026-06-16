import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { companyContactUpdateSchema } from '@/lib/validation/company-contacts';

/**
 * Customer-side PATCH + DELETE for a single CompanyEmergencyContact row
 * (Phase C #1 reshape, Juan 2026-06-10). Gates on the session user
 * holding a CompanyMembership with role=ADMIN; the contact must belong
 * to that same company.
 */

export const dynamic = 'force-dynamic';

async function resolveCompanyId(): Promise<string | NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const adminMembership = await prisma.companyMembership.findFirst({
    where: { userId, role: 'ADMIN' },
    orderBy: { createdAt: 'desc' },
    select: { companyId: true },
  });
  if (!adminMembership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return adminMembership.companyId;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ contactId: string }> },
): Promise<NextResponse> {
  const resolved = await resolveCompanyId();
  if (typeof resolved !== 'string') return resolved;
  const { contactId } = await ctx.params;

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
      where: { id: contactId, companyId: resolved },
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
  ctx: { params: Promise<{ contactId: string }> },
): Promise<NextResponse> {
  const resolved = await resolveCompanyId();
  if (typeof resolved !== 'string') return resolved;
  const { contactId } = await ctx.params;
  try {
    await prisma.companyEmergencyContact.delete({
      where: { id: contactId, companyId: resolved },
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
