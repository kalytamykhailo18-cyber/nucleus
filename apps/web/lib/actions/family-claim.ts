'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { normalizeEmail } from '@/lib/email';
import { sendNewMemberJoinedEmail } from '@/lib/emails/new-member-joined';

/**
 * Flat IMEI-only signup — Juan 2026-05-07 doc.
 *
 * Anyone with the IMEI printed on the Angela box can create their own
 * account by visiting /signup/claim. No Master/Watcher hierarchy, no
 * invitation gate, no shared secret beyond the IMEI itself: equal
 * access for every family member who joins.
 *
 * The Master-User chain (paying customer + email invites + IMEI +
 * Client-Id + share-password signup) keeps working in parallel — this
 * is an additional acquisition path, not a replacement.
 *
 * Safety net (per Juan's doc):
 *   - Device must already exist in our DB and be active (Sensu pre-
 *     registers the IMEI when shipping the device). Unknown / inactive
 *     IMEIs are rejected so a stolen-box scenario can be cut off from
 *     the admin panel by flipping `Device.isActive` to false.
 *   - Every successful claim fires an email to ALL prior accounts on
 *     the same IMEI: "[name] just joined — recognize them? If not, ask
 *     us to deactivate." That preserves family awareness of who has
 *     access.
 */

export interface FamilyClaimState {
  ok: boolean;
  error?: string;
}

const claimSchema = z.object({
  email: z.string().email('Email no válido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(1024),
  fullName: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(255)
    .optional()
    .nullable(),
  imei: z
    .string()
    .trim()
    .min(8, 'IMEI debe tener al menos 8 caracteres')
    .max(64)
    .regex(/^[A-Za-z0-9-]+$/, 'IMEI sólo admite letras, números y guiones'),
});

export async function familyClaimAction(
  _prevState: FamilyClaimState,
  formData: FormData,
): Promise<FamilyClaimState> {
  const parsed = claimSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName') ?? null,
    imei: formData.get('imei'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Datos no válidos',
    };
  }

  const email = normalizeEmail(parsed.data.email);
  if (!email) return { ok: false, error: 'Email no válido' };
  const imei = parsed.data.imei.toUpperCase();

  // The device must already be registered + active. If Sensu hasn't
  // shipped this IMEI yet (or has flipped it inactive after a misuse
  // report), the claim is rejected with the same neutral message —
  // no enumeration leak about which IMEIs exist.
  const device = await prisma.device.findUnique({
    where: { deviceId: imei },
    select: { isActive: true },
  });
  if (!device || !device.isActive) {
    return {
      ok: false,
      error:
        'IMEI no reconocido. Verifica el número impreso en la caja de la Angela.',
    };
  }

  // Email uniqueness — same case-insensitive collation as auth.
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${email} LIMIT 1
  `;
  if (existing.length > 0) {
    return { ok: false, error: 'Este email ya está registrado' };
  }

  // Snapshot the existing claimants BEFORE we add the new account, so
  // the notification email targets the people who were already there.
  const priorClaimants = await prisma.userDevice.findMany({
    where: { eviewDeviceId: imei },
    select: { user: { select: { email: true, fullName: true } } },
  });

  let newUserId: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash: hashPassword(parsed.data.password),
          fullName: parsed.data.fullName ?? null,
          isActive: true,
          // Flat-claim users skip the questionnaire — the Sensu admin
          // already entered the senior's data when pre-registering the
          // IMEI. Each claimant manages their own profile separately.
          questionnaireCompleted: true,
        },
        select: { id: true },
      });
      await tx.userDevice.create({
        data: {
          userId: created.id,
          eviewDeviceId: imei,
          // MASTER everywhere — no hierarchy in the flat model. Every
          // claimant has equal admin power (geofences, share creds,
          // revoke other claimants). The existing role-check in helpers
          // like family-share / geofences naturally accepts them all.
          role: 'MASTER',
          isPrimary: priorClaimants.length === 0,
        },
      });
      return created;
    });
    newUserId = result.id;
  } catch (err) {
    console.error('familyClaimAction transaction failed', err);
    return { ok: false, error: 'No se pudo crear la cuenta. Inténtalo de nuevo.' };
  }

  // Fire-and-forget notifications to every PRIOR claimant. Failure here
  // doesn't roll back the signup — the account exists, the family will
  // see the new member appear in the watcher list either way.
  void notifyPriorClaimants(
    imei,
    parsed.data.fullName ?? email,
    priorClaimants.map((p) => ({ email: p.user.email, fullName: p.user.fullName })),
  );

  return { ok: true };
}

async function notifyPriorClaimants(
  imei: string,
  newMember: string,
  prior: Array<{ email: string; fullName: string | null }>,
): Promise<void> {
  for (const recipient of prior) {
    void sendNewMemberJoinedEmail({
      to: recipient.email,
      recipientFirstName:
        recipient.fullName?.split(' ')[0]?.trim() || 'Hola',
      newMemberName: newMember,
      imei,
    });
  }
}
