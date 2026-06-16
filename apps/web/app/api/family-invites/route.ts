import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/email-transport';
import {
  InviteError,
  createFamilyInvite,
  listInvitesForMaster,
} from '@/lib/family-invite';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  email: z
    .string()
    .email()
    .max(255)
    .optional()
    .nullable()
    .transform((v) => (v && v.trim().length > 0 ? v.trim().toLowerCase() : null)),
  eviewDeviceId: z.string().min(1).max(64),
});

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function GET(): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const invites = await listInvitesForMaster(userId);
  return NextResponse.json({ invites });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await createFamilyInvite({
      masterUserId: userId,
      eviewDeviceId: parsed.data.eviewDeviceId,
      email: parsed.data.email,
    });

    const inviteUrl = `${env.AUTH_URL.replace(/\/$/, '')}/invite/${result.code}`;
    if (parsed.data.email) {
      const subject = 'Te invitaron a ver una Angela';
      const text = `Hola,\n\nTu familiar te invitó a ver la Angela desde la app.\n\nAcepta la invitación aquí:\n${inviteUrl}\n\nEl enlace vence el ${result.expiresAt.toLocaleDateString(
        'es-MX',
        { day: '2-digit', month: 'long', year: 'numeric' },
      )}.\n\n— Sensu`;
      const html = `<p>Hola,</p><p>Tu familiar te invitó a ver la Angela desde la app.</p><p><a href="${inviteUrl}">Acepta la invitación aquí</a></p><p>El enlace vence el ${result.expiresAt.toLocaleDateString(
        'es-MX',
        { day: '2-digit', month: 'long', year: 'numeric' },
      )}.</p><p>— Sensu</p>`;
      await sendEmail({ to: parsed.data.email, subject, text, html });
    }

    return NextResponse.json(
      {
        code: result.code,
        url: inviteUrl,
        expiresAt: result.expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof InviteError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.code === 'forbidden' ? 403 : 400 },
      );
    }
    throw err;
  }
}
