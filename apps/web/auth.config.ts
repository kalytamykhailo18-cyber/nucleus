import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe Auth.js config. No DB client, no Node crypto, no providers list.
 * Used by middleware (which runs on the Edge runtime). The full config in
 * auth.ts merges this with the Credentials provider for route handlers and
 * server components.
 */
const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.role =
          (user as { role?: 'USER' | 'ADMIN' | 'CALLCENTER' }).role ?? 'USER';
        // Carry the real display name on the token. Explicitly write
        // null when fullName is missing so Next-Auth's default
        // shim doesn't fall back to the email for `session.user.name`
        // — that produced "Hola, foo@bar.com" greetings on fresh
        // signups.
        token.name = (user as { name?: string | null }).name ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as { id?: string; role?: 'USER' | 'ADMIN' | 'CALLCENTER' }).id =
          token.userId as string;
        (session.user as { role?: 'USER' | 'ADMIN' | 'CALLCENTER' }).role =
          (token.role as 'USER' | 'ADMIN' | 'CALLCENTER' | undefined) ?? 'USER';
        // Mirror jwt's defensive null. Without this, when token.name
        // is null and session.user.email is set, Next-Auth's
        // default session shim copies email into name.
        (session.user as { name?: string | null }).name =
          (token.name as string | null | undefined) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
