import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { normalizeEmail } from '@/lib/email';
import { env } from '@/lib/env';

/**
 * Idempotent seed seam: create-or-update a demo/E2E user with a known
 * email + password. Calling twice with the same email is safe — the second
 * call updates passwordHash and fullName, leaving the row id untouched.
 *
 * Gated by E2E_HOOKS_SECRET (same gate as the other /api/dev seams) so it
 * never lands as a production foot-gun.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(1024),
  fullName: z.string().min(1).max(255).nullable().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
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
      { error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 422 },
    );
  }

  const email = normalizeEmail(parsed.data.email);
  if (!email) return NextResponse.json({ error: 'Invalid email' }, { status: 422 });

  const passwordHash = hashPassword(parsed.data.password);
  const fullName = parsed.data.fullName ?? null;
  const role = parsed.data.role ?? 'USER';

  // Look up case-insensitively and upsert by id (avoids racing the unique).
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${email} LIMIT 1
  `;

  let userId: string;
  if (existing[0]) {
    userId = existing[0].id;
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, fullName, isActive: true, role },
    });
  } else {
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        isActive: true,
        // Test fixtures skip onboarding by default — Playwright is testing
        // post-onboarding behavior, not the questionnaire itself. The
        // questionnaire spec drives the false-then-true flow explicitly.
        questionnaireCompleted: true,
        role,
      },
      select: { id: true },
    });
    userId = created.id;
  }

  return NextResponse.json({ ok: true, userId, role, email });
}
