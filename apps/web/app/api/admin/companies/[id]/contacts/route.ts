import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-audit';
import { companyContactCreateSchema } from '@/lib/validation/company-contacts';

/**
 * Admin-side CRUD for the shared CompanyEmergencyContact roster
 * (Phase C #1 reshape, Juan 2026-06-10).
 *
 * GET  — list the company's shared roster, priority asc.
 * POST — append a contact. priority defaults to (max(priority) + 1) so
 *        the new row lands at the bottom unless an explicit value is sent.
 *
 * Pair endpoint at [contactId]/route.ts handles PATCH + DELETE.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id: companyId } = await ctx.params;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const contacts = await prisma.companyEmergencyContact.findMany({
    where: { companyId },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json({
    ok: true,
    contacts: contacts.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      phone: c.phone,
      relationship: c.relationship,
      priority: c.priority,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id: companyId } = await ctx.params;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const parsed = companyContactCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  let priority = parsed.data.priority;
  if (priority === undefined) {
    const last = await prisma.companyEmergencyContact.findFirst({
      where: { companyId },
      orderBy: { priority: 'desc' },
      select: { priority: true },
    });
    priority = (last?.priority ?? -1) + 1;
  }

  const created = await prisma.companyEmergencyContact.create({
    data: {
      companyId,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      relationship: parsed.data.relationship ?? null,
      priority,
    },
  });
  void logAdminAction({
    action: 'company.contact.create',
    targetType: 'CompanyEmergencyContact',
    targetId: created.id,
    metadata: { companyId, fullName: created.fullName, priority: created.priority },
  });
  return NextResponse.json(
    {
      ok: true,
      contact: {
        id: created.id,
        fullName: created.fullName,
        phone: created.phone,
        relationship: created.relationship,
        priority: created.priority,
        createdAt: created.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
