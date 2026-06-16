import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import authConfig from './auth.config';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { normalizeEmail } from '@/lib/email';

const credentialsSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(1).max(1024),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = normalizeEmail(parsed.data.email);
        if (!email) return null;

        // Case-insensitive lookup so legacy mixed-case rows still match.
        const rows = await prisma.$queryRaw<
          {
            id: string;
            email: string;
            passwordHash: string | null;
            isActive: boolean;
            fullName: string | null;
            role: 'USER' | 'ADMIN';
          }[]
        >`SELECT id, email, "passwordHash", "isActive", "fullName", role FROM "User" WHERE LOWER(email) = ${email} LIMIT 1`;
        const user = rows[0];
        if (!user || !user.isActive || !user.passwordHash) return null;

        const ok = verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          });
        } catch {
          // best-effort
        }

        return {
          id: user.id,
          email: user.email,
          name: user.fullName ?? null,
          // Carried into the JWT in auth.config.ts → exposed on
          // session.user.role so server components can role-gate chrome
          // (e.g. AppHeader's admin tabs).
          role: user.role,
        };
      },
    }),
  ],
});
