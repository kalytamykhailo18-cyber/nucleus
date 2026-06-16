import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { companyInvoiceUpdateSchema } from '@/lib/validation/company-invoices';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; invoiceId: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id: companyId, invoiceId } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = companyInvoiceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const updated = await prisma.companyInvoice.update({
      where: { id: invoiceId, companyId },
      data: {
        ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
        ...(parsed.data.grossCentavos !== undefined
          ? { grossCentavos: parsed.data.grossCentavos }
          : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.dueAt !== undefined ? { dueAt: parsed.data.dueAt } : {}),
        ...(parsed.data.sentAt !== undefined ? { sentAt: parsed.data.sentAt } : {}),
        ...(parsed.data.paidAt !== undefined ? { paidAt: parsed.data.paidAt } : {}),
        ...(parsed.data.paymentReference !== undefined
          ? { paymentReference: parsed.data.paymentReference }
          : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'P2025') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; invoiceId: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id: companyId, invoiceId } = await ctx.params;
  try {
    await prisma.companyInvoice.delete({
      where: { id: invoiceId, companyId },
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
