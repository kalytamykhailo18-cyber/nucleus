import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { fetchCompanies } from '@/lib/companies';
import { logAdminAction } from '@/lib/admin-audit';
import { companyCreateSchema } from '@/lib/validation/companies';

export const dynamic = 'force-dynamic';

/**
 * Admin-side listing of every Company (Juan 2026-06-13). Used by the
 * /admin/companies UI's helper scripts (Medtronic onboarding, test-
 * seed cleanup) so they don't have to scrape the server-rendered page.
 */
export async function GET(): Promise<NextResponse> {
  await requireAdmin();
  const companies = await fetchCompanies();
  return NextResponse.json({ ok: true, companies });
}

export async function POST(req: Request): Promise<NextResponse> {
  await requireAdmin();
  const body = await req.json().catch(() => null);
  const parsed = companyCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const created = await prisma.company.create({
      data: {
        name: parsed.data.name,
        contactName: parsed.data.contactName ?? null,
        contactEmail: parsed.data.contactEmail ?? null,
        contactPhone: parsed.data.contactPhone ?? null,
        notes: parsed.data.notes ?? null,
        isActive: parsed.data.isActive ?? true,
        isManagedFleet: parsed.data.isManagedFleet ?? false,
      },
      select: { id: true, name: true },
    });
    void logAdminAction({
      action: 'company.create',
      targetType: 'Company',
      targetId: created.id,
      metadata: { name: created.name, isManagedFleet: parsed.data.isManagedFleet ?? false },
    });
    return NextResponse.json({ ok: true, id: created.id, name: created.name }, { status: 201 });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json({ error: 'name_exists' }, { status: 409 });
    }
    throw err;
  }
}
