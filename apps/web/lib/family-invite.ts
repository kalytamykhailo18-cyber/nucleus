import crypto from 'node:crypto';
import { prisma } from '@/lib/db';

/**
 * Family-invite helpers — Juan 2026-05-15.
 *
 * The Master User mints an invite for a relative on /profile. The
 * invite carries a unique opaque code; the relative opens
 * /invite/<code>, signs in (or signs up), and consumes the invite.
 * Consumption upserts a WATCHER UserDevice row on the Master's device
 * for the new user and marks the invite consumed so the same link
 * can't be used twice.
 */

const INVITE_CODE_LENGTH = 16;
const INVITE_TTL_DAYS = 7;

export interface CreateInviteInput {
  masterUserId: string;
  eviewDeviceId: string;
  email?: string | null;
}

export interface InviteSummary {
  code: string;
  email: string | null;
  expiresAt: string;
  consumedAt: string | null;
  consumedByEmail: string | null;
  deviceLabel: string;
  createdAt: string;
}

function mintInviteCode(): string {
  return crypto.randomBytes(INVITE_CODE_LENGTH).toString('base64url').slice(0, INVITE_CODE_LENGTH);
}

/**
 * Throws if the user is not a Master on the device. Otherwise creates
 * an invite row and returns the new code.
 */
export async function createFamilyInvite(
  input: CreateInviteInput,
): Promise<{ code: string; expiresAt: Date }> {
  const ownership = await prisma.userDevice.findFirst({
    where: {
      userId: input.masterUserId,
      eviewDeviceId: input.eviewDeviceId,
      role: 'MASTER',
    },
    select: { id: true },
  });
  if (!ownership) {
    throw new InviteError('forbidden', 'Solo el usuario principal puede invitar');
  }

  const code = mintInviteCode();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.familyInvite.create({
    data: {
      code,
      masterUserId: input.masterUserId,
      eviewDeviceId: input.eviewDeviceId,
      email: input.email ?? null,
      expiresAt,
    },
  });
  return { code, expiresAt };
}

/**
 * Public view of an invite — used by /invite/<code> to render the
 * "Tu familiar ${name} te invitó a ver el Sensu ${label}" headline.
 * Returns null for unknown / expired / consumed invites so the page
 * can render a single "este enlace ya no es válido" state without
 * leaking which case it hit.
 */
export interface PublicInviteView {
  code: string;
  masterFirstName: string;
  deviceLabel: string;
  email: string | null;
  expiresAt: string;
}

export async function getPublicInvite(
  code: string,
): Promise<PublicInviteView | null> {
  const row = await prisma.familyInvite.findUnique({
    where: { code },
    select: {
      code: true,
      email: true,
      expiresAt: true,
      consumedAt: true,
      masterUser: { select: { fullName: true, email: true } },
      device: { select: { deviceName: true } },
      eviewDeviceId: true,
    },
  });
  if (!row) return null;
  if (row.consumedAt) return null;
  if (row.expiresAt < new Date()) return null;

  const masterFirstName =
    row.masterUser.fullName?.split(' ')[0] ??
    row.masterUser.email.split('@')[0]!;
  const deviceLabel = row.device.deviceName ?? row.eviewDeviceId;
  return {
    code: row.code,
    masterFirstName,
    deviceLabel,
    email: row.email,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export type ConsumeResult =
  | { ok: true; deviceId: string }
  | { ok: false; reason: 'not_found' | 'expired' | 'consumed' | 'already_member' };

/**
 * Consume an invite for a signed-in user. Creates a WATCHER UserDevice
 * row tying the user to the Master's device, stamps the invite
 * consumed. Idempotent on (userId, deviceId): if the user already has
 * a row on that device, marks the invite consumed but returns
 * `already_member`.
 */
export async function consumeFamilyInvite(
  code: string,
  userId: string,
): Promise<ConsumeResult> {
  const invite = await prisma.familyInvite.findUnique({
    where: { code },
    select: {
      id: true,
      eviewDeviceId: true,
      expiresAt: true,
      consumedAt: true,
    },
  });
  if (!invite) return { ok: false, reason: 'not_found' };
  if (invite.consumedAt) return { ok: false, reason: 'consumed' };
  if (invite.expiresAt < new Date()) return { ok: false, reason: 'expired' };

  const existing = await prisma.userDevice.findFirst({
    where: { userId, eviewDeviceId: invite.eviewDeviceId },
    select: { id: true },
  });
  if (existing) {
    await prisma.familyInvite.update({
      where: { id: invite.id },
      data: { consumedAt: new Date(), consumedByUserId: userId },
    });
    return { ok: false, reason: 'already_member' };
  }

  await prisma.$transaction([
    prisma.userDevice.create({
      data: {
        userId,
        eviewDeviceId: invite.eviewDeviceId,
        role: 'WATCHER',
      },
    }),
    prisma.familyInvite.update({
      where: { id: invite.id },
      data: { consumedAt: new Date(), consumedByUserId: userId },
    }),
  ]);
  return { ok: true, deviceId: invite.eviewDeviceId };
}

export async function listInvitesForMaster(
  masterUserId: string,
): Promise<InviteSummary[]> {
  const rows = await prisma.familyInvite.findMany({
    where: { masterUserId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      code: true,
      email: true,
      expiresAt: true,
      consumedAt: true,
      createdAt: true,
      eviewDeviceId: true,
      consumedByUser: { select: { email: true } },
      device: { select: { deviceName: true } },
    },
  });
  return rows.map((r) => ({
    code: r.code,
    email: r.email,
    expiresAt: r.expiresAt.toISOString(),
    consumedAt: r.consumedAt?.toISOString() ?? null,
    consumedByEmail: r.consumedByUser?.email ?? null,
    deviceLabel: r.device.deviceName ?? r.eviewDeviceId,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function revokeInvite(
  code: string,
  masterUserId: string,
): Promise<boolean> {
  const result = await prisma.familyInvite.deleteMany({
    where: { code, masterUserId, consumedAt: null },
  });
  return result.count > 0;
}

export class InviteError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
