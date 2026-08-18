import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireFamilyApiAuth } from '@/lib/admin';
import {
  ensureFamilyShare,
  isMasterUser,
  rotateShareCode,
} from '@/lib/family-share';

export const dynamic = 'force-dynamic';

type GateResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; body: { error: string } };

async function requireMasterUserId(): Promise<GateResult> {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return gate;
  if (!(await isMasterUser(gate.userId))) {
    return { ok: false, status: 403, body: { error: 'not_master' } };
  }
  return gate;
}

export async function GET(): Promise<NextResponse> {
  const gate = await requireMasterUserId();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { userId } = gate;
  const share = await ensureFamilyShare(userId);
  // Juan 2026-06-26: include the Master's first paired device IMEI so
  // the /profile QR can encode a pre-filled /signup/familiar link.
  // Watcher signup needs (imei, clientId, shareCode); without the IMEI
  // here the QR would still force the relative to type it in.
  const primary = await prisma.userDevice.findFirst({
    where: { userId, role: 'MASTER' },
    orderBy: { isPrimary: 'desc' },
    select: { eviewDeviceId: true },
  });
  return NextResponse.json({
    ...share,
    deviceId: primary?.eviewDeviceId ?? null,
  });
}

export async function POST(): Promise<NextResponse> {
  // POST rotates the share password while keeping the Client ID stable.
  const gate = await requireMasterUserId();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { userId } = gate;
  const share = await rotateShareCode(userId);
  // Same shape as GET so the client can refresh the QR without a
  // second roundtrip.
  const primary = await prisma.userDevice.findFirst({
    where: { userId, role: 'MASTER' },
    orderBy: { isPrimary: 'desc' },
    select: { eviewDeviceId: true },
  });
  return NextResponse.json({
    ...share,
    deviceId: primary?.eviewDeviceId ?? null,
  });
}
