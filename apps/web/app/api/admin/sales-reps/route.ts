import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-audit';

export const dynamic = 'force-dynamic';

/**
 * Admin CRUD for the direct-sales rep roster (Juan 2026-07-30 pivot).
 * Each SalesRep row is a person who sells subscriptions under the
 * commission model Guillermo is running. Reps get a URL-safe `slug`
 * that shows up in their public checkout links (?rep=<slug>); every
 * signup that arrives with a matching slug lands attributed to the
 * rep for commission reporting.
 *
 * `active = false` retires a rep without deleting their historical
 * attribution — their slug simply stops attributing new signups.
 */

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: 'slug must be lowercase letters, digits and hyphens only',
  });

const createSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().max(32).optional().nullable(),
  commissionBps: z.number().int().min(0).max(10_000).optional(),
  notes: z.string().trim().max(2_000).optional().nullable(),
});

export async function GET(): Promise<NextResponse> {
  await requireAdmin();
  const reps = await prisma.salesRep.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      email: true,
      phone: true,
      commissionBps: true,
      active: true,
      notes: true,
      createdAt: true,
      _count: { select: { subscriptions: true } },
    },
  });
  return NextResponse.json({ ok: true, reps });
}

export async function POST(req: Request): Promise<NextResponse> {
  await requireAdmin();
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  try {
    const created = await prisma.salesRep.create({
      data: {
        slug: parsed.data.slug,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        commissionBps: parsed.data.commissionBps ?? 2000,
        notes: parsed.data.notes ?? null,
        active: true,
      },
      select: { id: true, slug: true, name: true },
    });
    void logAdminAction({
      action: 'salesRep.create',
      targetType: 'SalesRep',
      targetId: created.id,
      metadata: { slug: created.slug, name: created.name },
    });
    return NextResponse.json(
      { ok: true, id: created.id, slug: created.slug },
      { status: 201 },
    );
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'slug_or_email_exists' },
        { status: 409 },
      );
    }
    throw err;
  }
}
