import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { companyContactCreateSchema } from '@/lib/validation/company-contacts';

/**
 * Customer-side companion to /api/admin/companies/[id]/contacts for the
 * HR / Safety lead (Phase C #1 reshape, Juan 2026-06-10). The session
 * user must hold a CompanyMembership with role=ADMIN; the company id
 * is derived from that membership (no companyId path param needed).
 *
 * GET — return the company's shared roster.
 * POST — append a contact, same priority defaulting as the admin route.
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

export async function GET(): Promise<NextResponse> {
  const resolved = await resolveCompanyId();
  if (typeof resolved !== 'string') return resolved;
  const contacts = await prisma.companyEmergencyContact.findMany({
    where: { companyId: resolved },
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

export async function POST(req: Request): Promise<NextResponse> {
  const resolved = await resolveCompanyId();
  if (typeof resolved !== 'string') return resolved;
  const companyId = resolved;

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
