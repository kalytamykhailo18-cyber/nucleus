import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-audit';
import { hashPassword } from '@/lib/password';
import { normalizeEmail } from '@/lib/email';
import { sendWelcomeWorkerEmail } from '@/lib/emails/welcome-worker';

export const dynamic = 'force-dynamic';

/**
 * Bulk-import workers into a Company (Step 12, Juan 2026-05-28).
 *
 * Accepts a JSON array of rows. For each row the endpoint creates (or
 * reuses an existing) `User`, links it to the Company as a MEMBER via
 * `CompanyMembership`, and dispatches a welcome email containing a
 * one-time password-setup link.
 *
 * Returns a per-row outcome summary so the admin can spot which rows
 * skipped (already in the company) or errored (invalid email, etc.)
 * without having to inspect the DB.
 */

// SaaS-rail row — every worker is also an end-customer with email +
// login + welcome message.
const saasRowSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(255),
  phone: z.string().max(40).nullable().optional(),
  employeeId: z.string().max(80).nullable().optional(),
  jobTitle: z.string().max(160).nullable().optional(),
});

// Industrial-fleet row (Phase C #1 reshape, 2026-06-10) — names only;
// emails are synthesized server-side, no welcome email is sent. Used
// when Company.isManagedFleet = true.
const managedRowSchema = z.object({
  fullName: z.string().min(1).max(255),
  employeeId: z.string().max(80).nullable().optional(),
  jobTitle: z.string().max(160).nullable().optional(),
});

const bodySchema = z.object({
  rows: z.array(z.unknown()).min(1).max(500),
});

type RowOutcome = {
  // Real or synthetic email — whichever the row resolved to.
  email: string;
  status: 'created' | 'reused' | 'already_member' | 'error';
  message?: string;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id: companyId } = await ctx.params;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, isManagedFleet: true },
  });
  if (!company) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const outcomes: RowOutcome[] = [];
  let createdCount = 0;
  let reusedCount = 0;
  let alreadyMemberCount = 0;
  let errorCount = 0;

  for (const rawRow of parsed.data.rows) {
    try {
      // Branch on the company's rail. Managed fleets ship names-only
      // rows and synthesize an `@managed.sensu.internal` email so the
      // unique email constraint is satisfied without inventing real
      // inboxes. SaaS-rail flow stays bit-for-bit identical.
      if (company.isManagedFleet) {
        const rowParse = managedRowSchema.safeParse(rawRow);
        if (!rowParse.success) {
          outcomes.push({
            email: '(managed)',
            status: 'error',
            message: 'row_invalid',
          });
          errorCount += 1;
          continue;
        }
        const synthEmail = `worker-${crypto.randomUUID()}@managed.sensu.internal`;
        const created = await prisma.user.create({
          data: {
            email: synthEmail,
            passwordHash: null,
            fullName: rowParse.data.fullName,
            isActive: true,
            kind: 'MANAGED_WORKER',
            // Industrial workers carry no questionnaire — the shared
            // company roster covers their alert routing.
            questionnaireCompleted: true,
          },
          select: { id: true },
        });
        await prisma.companyMembership.create({
          data: {
            companyId,
            userId: created.id,
            role: 'MEMBER',
            employeeId: rowParse.data.employeeId ?? null,
            jobTitle: rowParse.data.jobTitle ?? null,
          },
        });
        outcomes.push({ email: synthEmail, status: 'created' });
        createdCount += 1;
        continue;
      }

      const rowParse = saasRowSchema.safeParse(rawRow);
      if (!rowParse.success) {
        outcomes.push({
          email:
            (rawRow as { email?: string })?.email ?? '(unknown)',
          status: 'error',
          message: 'row_invalid',
        });
        errorCount += 1;
        continue;
      }
      const row = rowParse.data;
      const email = normalizeEmail(row.email);
      if (!email) {
        outcomes.push({ email: row.email, status: 'error', message: 'email_invalid' });
        errorCount += 1;
        continue;
      }

      // Re-use an existing User if the email already has an account;
      // otherwise mint a new one with a throw-away password the user
      // cannot guess (forces them through the reset-link flow).
      const existing = await prisma.user.findFirst({
        where: { email },
        select: { id: true, fullName: true },
      });

      let userId: string;
      let displayName: string;
      let reused = false;
      if (existing) {
        userId = existing.id;
        displayName = existing.fullName ?? row.fullName;
        reused = true;
      } else {
        const throwaway = crypto.randomBytes(32).toString('hex');
        const created = await prisma.user.create({
          data: {
            email,
            passwordHash: hashPassword(throwaway),
            fullName: row.fullName,
            phone: row.phone ?? null,
            isActive: true,
            // Workers do not need the family questionnaire — the
            // company already filled the bulk-workforce survey. Flip
            // to `true` so the dashboard gate does not redirect them.
            questionnaireCompleted: true,
          },
          select: { id: true },
        });
        userId = created.id;
        displayName = row.fullName;
      }

      // Idempotent — re-importing the same CSV does not duplicate
      // memberships.
      const existingMembership = await prisma.companyMembership.findUnique({
        where: {
          companyId_userId: { companyId, userId },
        },
        select: { id: true },
      });
      if (existingMembership) {
        outcomes.push({ email, status: 'already_member' });
        alreadyMemberCount += 1;
        continue;
      }

      await prisma.companyMembership.create({
        data: {
          companyId,
          userId,
          role: 'MEMBER',
          employeeId: row.employeeId ?? null,
          jobTitle: row.jobTitle ?? null,
        },
      });

      void sendWelcomeWorkerEmail({
        userId,
        email,
        fullName: displayName,
        companyName: company.name,
      });

      if (reused) {
        outcomes.push({ email, status: 'reused' });
        reusedCount += 1;
      } else {
        outcomes.push({ email, status: 'created' });
        createdCount += 1;
      }
    } catch (err: unknown) {
      outcomes.push({
        email: '(error)',
        status: 'error',
        message: (err as Error).message ?? 'unknown',
      });
      errorCount += 1;
    }
  }

  void logAdminAction({
    action: 'company.import',
    targetType: 'Company',
    targetId: companyId,
    metadata: {
      total: parsed.data.rows.length,
      created: createdCount,
      reused: reusedCount,
      alreadyMember: alreadyMemberCount,
      error: errorCount,
    },
  });

  return NextResponse.json({
    ok: true,
    companyId,
    summary: {
      total: parsed.data.rows.length,
      created: createdCount,
      reused: reusedCount,
      alreadyMember: alreadyMemberCount,
      error: errorCount,
    },
    outcomes,
  });
}
