import { prisma } from '@/lib/db';
import { auth } from '@/auth';

/**
 * Admin-action audit logger (Phase C #4, 2026-06-15).
 *
 * Call from inside any admin route handler / server action that
 * mutates state. Captures who did it (from the current session),
 * what they did (`<resource>.<verb>`), and a metadata blob — usually
 * the request body so we keep the change provenance even after the
 * target row is deleted.
 *
 * Fire-and-forget at the caller (`void logAdminAction(...)`); errors
 * are caught + console.error'd so an audit hiccup never breaks the
 * action the dispatcher was trying to do.
 */

export interface AdminAuditInput {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: unknown;
  /** Override the actor when the calling code has explicit context
   * (e.g. webhook handlers where there is no session). */
  actorUserId?: string | null;
  actorEmail?: string | null;
}

export async function logAdminAction(input: AdminAuditInput): Promise<void> {
  try {
    let actorUserId = input.actorUserId ?? null;
    let actorEmail = input.actorEmail ?? null;
    if (actorUserId === null && actorEmail === null) {
      const session = await auth();
      actorUserId = (session?.user as { id?: string } | undefined)?.id ?? null;
      actorEmail =
        (session?.user as { email?: string } | undefined)?.email ?? null;
    }
    await prisma.adminAuditLog.create({
      data: {
        actorUserId,
        actorEmail,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        ...(input.metadata === undefined
          ? {}
          : {
              metadata: JSON.parse(JSON.stringify(input.metadata)) as never,
            }),
      },
    });
  } catch (err) {
    console.error('[admin-audit] write failed', input.action, err);
  }
}

export interface AdminAuditRow {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface AdminAuditQuery {
  page?: number;
  pageSize?: number;
  actorEmail?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
}

export async function fetchAdminAuditLog(
  q: AdminAuditQuery = {},
): Promise<{
  rows: AdminAuditRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const pageSize = Math.min(Math.max(q.pageSize ?? 50, 1), 200);
  const page = Math.max(q.page ?? 1, 1);

  const where: Record<string, unknown> = {};
  if (q.actorEmail) where.actorEmail = { contains: q.actorEmail, mode: 'insensitive' };
  if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
  if (q.targetType) where.targetType = q.targetType;
  if (q.targetId) where.targetId = q.targetId;

  const [total, rowsRaw] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
  ]);

  return {
    rows: rowsRaw.map((r) => ({
      id: r.id,
      actorUserId: r.actorUserId,
      actorEmail: r.actorEmail,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}
