import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { translateBloodType } from '@/lib/blood-type';
import { env } from '@/lib/env';

/**
 * Test-only seam: write profile fields (phone + medical) to an existing
 * User row. Idempotent — calling twice with the same payload yields the
 * same row state. Skips fields whose value is omitted (so a partial
 * update doesn't blank the rest).
 *
 * Gated by E2E_HOOKS_SECRET. Used by `scripts/seed-e2e.sh` to populate
 * the demo + admin accounts with the medical questionnaire payload that
 * makes `/profile` and `/dashboard` look "real" for client review.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  userEmail: z.string().email(),
  fullName: z.string().min(1).max(255).nullable().optional(),
  phone: z.string().max(64).nullable().optional(),
  heightCm: z.number().int().min(1).max(300).nullable().optional(),
  weightKg: z.number().min(1).max(500).nullable().optional(),
  bloodType: z.string().max(32).nullable().optional(),
  medicalConditions: z.string().max(2000).nullable().optional(),
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

  const { userEmail, ...rest } = parsed.data;
  const userRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${userEmail.toLowerCase()} LIMIT 1
  `;
  const user = userRows[0];
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Resolve human-form blood type ("O+") to canonical Prisma enum.
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v === undefined) continue;
    if (k === 'bloodType' && v !== null) {
      const canonical = translateBloodType(v as string);
      if (!canonical) {
        return NextResponse.json(
          { error: 'Validation failed', message: `Unknown bloodType "${v}"`, field: 'bloodType' },
          { status: 422 },
        );
      }
      data.bloodType = canonical;
    } else {
      data[k] = v;
    }
  }

  // If the seed call provides any profile data, the user is logically
  // past the onboarding questionnaire — flip the flag so the dashboard
  // doesn't bounce seeded fixtures back to /onboarding/questionnaire.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { ...data, questionnaireCompleted: true },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: updated.id });
}
