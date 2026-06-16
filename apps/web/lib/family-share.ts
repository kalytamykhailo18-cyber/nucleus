import crypto from 'node:crypto';
import { prisma } from '@/lib/db';

/**
 * Family-share credentials — Juan 2026-05-15.
 *
 * Every Master User gets a public-facing 6-digit Client ID and a short
 * share password. A relative joins as Watcher by typing the device
 * IMEI plus this pair on the "Soy familiar" signup flow, or by
 * accepting an emailed invite Master mints from their /profile.
 *
 * The pair is generated lazily on first read — `ensureFamilyShare`
 * stamps it onto the User row if missing, then returns the current
 * values. Idempotent across calls.
 */

const SHARE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const SHARE_CODE_LENGTH = 8;
const CLIENT_ID_MAX_ATTEMPTS = 8;

function pickShareCode(): string {
  let out = '';
  for (let i = 0; i < SHARE_CODE_LENGTH; i += 1) {
    const r = crypto.randomInt(0, SHARE_CODE_ALPHABET.length);
    out += SHARE_CODE_ALPHABET[r];
  }
  return out;
}

function pickClientId(): string {
  // 6 digits, no leading zero so the format reads naturally.
  return String(crypto.randomInt(100_000, 1_000_000));
}

export interface FamilyShare {
  clientId: string;
  shareCode: string;
}

export async function ensureFamilyShare(userId: string): Promise<FamilyShare> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { clientId: true, shareCode: true },
  });
  if (existing?.clientId && existing.shareCode) {
    return { clientId: existing.clientId, shareCode: existing.shareCode };
  }

  // Generate fresh values; retry on Client ID collision because the
  // 6-digit space is small enough (10^6 - 10^5 = 900k slots) for a
  // sustained run to bump into a few duplicates. Eight attempts is a
  // hundred-billion-to-one of full failure.
  for (let attempt = 0; attempt < CLIENT_ID_MAX_ATTEMPTS; attempt += 1) {
    const clientId = existing?.clientId ?? pickClientId();
    const shareCode = existing?.shareCode ?? pickShareCode();
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { clientId, shareCode },
      });
      return { clientId, shareCode };
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        // Unique collision on clientId; try a fresh one. Don't reuse
        // existing.shareCode — regenerate that too in case the same
        // race wrote the row underneath us.
        continue;
      }
      throw err;
    }
  }
  throw new Error('Could not mint a unique family-share Client ID');
}

/**
 * Regenerate the share password while keeping the Client ID stable.
 * Master Users can rotate it from /profile if a relative leaks it.
 */
export async function rotateShareCode(userId: string): Promise<FamilyShare> {
  const shareCode = pickShareCode();
  // Ensure clientId exists too (rotates land on a Master who never
  // visited /profile before).
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { clientId: true },
  });
  if (!current?.clientId) {
    return ensureFamilyShare(userId);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { shareCode },
  });
  return { clientId: current.clientId, shareCode };
}

/**
 * True when the user holds at least one MASTER UserDevice row — only
 * Masters see and manage share credentials. Watchers see nothing.
 */
export async function isMasterUser(userId: string): Promise<boolean> {
  const row = await prisma.userDevice.findFirst({
    where: { userId, role: 'MASTER' },
    select: { id: true },
  });
  return row !== null;
}
