import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { syncContact } from '@/lib/hubspot';

/**
 * /api/contact-form (Juan 2026-06-15)
 *
 * Lightweight sales-lead capture for the public /contacto page. Three
 * fields only: name + email + phone. Writes a `ContactInquiry` row
 * (belt-and-suspenders persistence so a HubSpot outage cannot silently
 * drop a lead), then fires the same `syncContact` push every signup
 * uses so the lead lands in HubSpot tagged `signupSource = "website_contact_form"`.
 *
 * Public endpoint — no auth, no E2E-hook gate. Rate-limiting is the
 * front of nginx; if a real abuse signal shows up we add a captcha.
 */

export const dynamic = 'force-dynamic';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Nombre demasiado corto').max(120),
  email: z.string().trim().toLowerCase().email('Email inválido').max(160),
  phone: z.string().trim().min(7, 'Teléfono demasiado corto').max(40),
});

const SOURCE_TAG = 'website_contact_form';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let raw: unknown = null;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { fullName, email, phone } = parsed.data;

  try {
    await prisma.contactInquiry.create({
      data: { fullName, email, phone, source: SOURCE_TAG },
    });
  } catch (err) {
    console.error('[contact-form] inquiry write failed', err);
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }

  // Fire-and-forget HubSpot push so a slow CRM never holds the user.
  void syncContact({
    email,
    fullName,
    phone,
    signupSource: SOURCE_TAG,
    channel: SOURCE_TAG,
  });

  return NextResponse.json({ ok: true });
}
