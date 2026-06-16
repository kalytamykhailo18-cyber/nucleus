import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { companyInvoiceCreateSchema } from '@/lib/validation/company-invoices';

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
  if (!company) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const invoices = await prisma.companyInvoice.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({
    ok: true,
    invoices: invoices.map((i) => ({
      id: i.id,
      label: i.label,
      grossCentavos: i.grossCentavos,
      status: i.status,
      dueAt: i.dueAt?.toISOString() ?? null,
      sentAt: i.sentAt?.toISOString() ?? null,
      paidAt: i.paidAt?.toISOString() ?? null,
      paymentReference: i.paymentReference,
      notes: i.notes,
      createdAt: i.createdAt.toISOString(),
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
  if (!company) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = companyInvoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const created = await prisma.companyInvoice.create({
    data: {
      companyId,
      label: parsed.data.label,
      grossCentavos: parsed.data.grossCentavos,
      status: parsed.data.status ?? 'DRAFT',
      dueAt: parsed.data.dueAt ?? null,
      sentAt: parsed.data.sentAt ?? null,
      paidAt: parsed.data.paidAt ?? null,
      paymentReference: parsed.data.paymentReference ?? null,
      notes: parsed.data.notes ?? null,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
