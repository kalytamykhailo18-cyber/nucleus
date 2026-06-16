import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam: create a Company + optional CompanyMembership rows
 * for the given user emails. Lets the Step 10 spec assert the data
 * model wires User ↔ Company correctly without driving the (future)
 * admin UI. Idempotent on company name — re-seeding the same name
 * keeps the same Company row and refreshes its metadata.
 *
 * Gated by E2E_HOOKS_SECRET — production deploys leave the env unset
 * and every request 404s.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(1).max(255),
  contactName: z.string().max(255).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  adminEmails: z.array(z.string().email()).optional().default([]),
  memberEmails: z.array(z.string().email()).optional().default([]),
});

export async function POST(request: NextRequest) {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'invalid' },
      { status: 422 },
    );
  }

  const company = await prisma.company.upsert({
    where: { name: parsed.data.name },
    create: {
      name: parsed.data.name,
      contactName: parsed.data.contactName ?? null,
      contactEmail: parsed.data.contactEmail ?? null,
      contactPhone: parsed.data.contactPhone ?? null,
      notes: parsed.data.notes ?? null,
    },
    update: {
      contactName: parsed.data.contactName ?? null,
      contactEmail: parsed.data.contactEmail ?? null,
      contactPhone: parsed.data.contactPhone ?? null,
      notes: parsed.data.notes ?? null,
    },
    select: { id: true, name: true },
  });

  const linkUser = async (email: string, role: 'ADMIN' | 'MEMBER'): Promise<string | null> => {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    if (!user) return null;
    await prisma.companyMembership.upsert({
      where: {
        companyId_userId: { companyId: company.id, userId: user.id },
      },
      create: { companyId: company.id, userId: user.id, role },
      update: { role },
    });
    return user.id;
  };

  const adminUserIds: string[] = [];
  for (const e of parsed.data.adminEmails) {
    const id = await linkUser(e, 'ADMIN');
    if (id) adminUserIds.push(id);
  }
  const memberUserIds: string[] = [];
  for (const e of parsed.data.memberEmails) {
    const id = await linkUser(e, 'MEMBER');
    if (id) memberUserIds.push(id);
  }

  return NextResponse.json({
    ok: true,
    companyId: company.id,
    name: company.name,
    adminUserIds,
    memberUserIds,
  });
}
