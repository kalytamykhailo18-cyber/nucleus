import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { normalizeProfileKeys } from '@/lib/profile-aliases';
import { profilePatchSchema } from '@/lib/validation/profile';

export const dynamic = 'force-dynamic';

const SELECT_FIELDS = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  dateOfBirth: true,
  gender: true,
  curp: true,
  userPhone: true,
  address: true,
  housingType: true,
  livesAlone: true,
  heightCm: true,
  weightKg: true,
  bloodType: true,
  medicalConditions: true,
  insuranceInfo: true,
  checkInEnabled: true,
  checkInDay: true,
  checkInTimeOfDay: true,
  profileImageUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function requireSessionUserId(): Promise<string | null> {
  const session = await auth();
  // Auth.js stores our id on the session.user shape we set in auth.ts.
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function GET() {
  const userId = await requireSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Emergency contacts are saved during the questionnaire (and editable
  // later through this same endpoint's PATCH). Returning them inline on
  // the profile read keeps /profile from issuing a second request just to
  // render the contacts section. Sorted by priority so the buyer's own
  // entry (priority 0, auto-prefilled) lands first.
  const [user, emergencyContacts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: SELECT_FIELDS,
    }),
    prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: { priority: 'asc' },
      select: { id: true, fullName: true, phone: true, relationship: true, priority: true },
    }),
  ]);
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ...user, emergencyContacts });
}

export async function PATCH(request: NextRequest) {
  const userId = await requireSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const normalized = normalizeProfileKeys(raw);
  const parsed = profilePatchSchema.safeParse(normalized);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: 'Validation failed',
        field: issue?.path.join('.') ?? null,
        message: issue?.message ?? 'Invalid input',
      },
      { status: 422 },
    );
  }

  // Build the Prisma update payload, dropping undefined keys so we never
  // accidentally overwrite a field the client did not include in the PATCH.
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) data[k] = v;
  }
  if (Object.keys(data).length === 0) {
    // No-op PATCH — return current state instead of touching updatedAt.
    // Same shape as the success path (with emergencyContacts) so the
    // client never finds a section missing from its model after a Save.
    const [current, emergencyContacts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: SELECT_FIELDS,
      }),
      prisma.emergencyContact.findMany({
        where: { userId },
        orderBy: { priority: 'asc' },
        select: { id: true, fullName: true, phone: true, relationship: true, priority: true },
      }),
    ]);
    return NextResponse.json({ ...current, emergencyContacts });
  }

  const [updated, emergencyContacts] = await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data,
      select: SELECT_FIELDS,
    }),
    // Same shape as GET so the client never finds itself with the
    // contacts section unmounted after a Save — the profile-form
    // reads contacts off this response and would crash on
    // .length without it.
    prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: { priority: 'asc' },
      select: { id: true, fullName: true, phone: true, relationship: true, priority: true },
    }),
  ]);
  return NextResponse.json({ ...updated, emergencyContacts });
}
