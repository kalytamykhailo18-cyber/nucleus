import { prisma } from '@/lib/db';

/**
 * Canonical "where does this user belong" landing URL.
 *   - global ADMIN → `/` (inline-CMS landing surface)
 *   - global CALLCENTER → `/admin/operator` (dispatcher hub)
 *   - CompanyMembership.role=ADMIN with no global role → `/company`
 *   - everyone else → `/dashboard`
 *
 * Used by the login form, by /checkout's bounce, and by the /dashboard
 * company-admin redirect so all three agree on the same answer.
 */
export async function resolveLandingPath(args: {
  userId?: string | null;
  role?: 'USER' | 'ADMIN' | 'CALLCENTER' | null;
}): Promise<'/' | '/admin/operator' | '/company' | '/dashboard'> {
  if (args.role === 'ADMIN') return '/';
  if (args.role === 'CALLCENTER') return '/admin/operator';
  if (args.userId) {
    const companyAdmin = await prisma.companyMembership.findFirst({
      where: { userId: args.userId, role: 'ADMIN' },
      select: { id: true },
    });
    if (companyAdmin) return '/company';
  }
  return '/dashboard';
}
