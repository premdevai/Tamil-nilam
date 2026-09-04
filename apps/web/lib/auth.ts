import { DrizzleAdapter } from '@auth/drizzle-adapter';
import {
  auditRecords,
  authAccounts,
  authAuthenticators,
  authSessions,
  authVerificationTokens,
  consentRecords,
  users,
} from '@nilam/db';
import { eq } from 'drizzle-orm';
import type { NextAuthOptions } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import { getServerSession } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { z } from 'zod';

import { sendMagicLink } from './auth-mail';
import { getDatabase } from './db';
import type { SessionRole } from './roles';

let resolvedAdapter: Adapter | undefined;

function getAuthAdapter(): Adapter {
  resolvedAdapter ??= DrizzleAdapter(getDatabase().db, {
    usersTable: users,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: authVerificationTokens,
    authenticatorsTable: authAuthenticators,
  }) as unknown as Adapter;
  return resolvedAdapter;
}

const adapterMethodNames = [
  'createUser',
  'getUser',
  'getUserByEmail',
  'getUserByAccount',
  'updateUser',
  'deleteUser',
  'linkAccount',
  'unlinkAccount',
  'createSession',
  'getSessionAndUser',
  'updateSession',
  'deleteSession',
  'createVerificationToken',
  'useVerificationToken',
  'getAccount',
  'createAuthenticator',
  'getAuthenticator',
  'listAuthenticatorsByUserId',
  'updateAuthenticatorCounter',
] as const;

// NextAuth v4 enumerates adapter methods before wrapping them with error
// handling. A Proxy with no own keys therefore becomes an empty adapter.
const adapter = Object.fromEntries(
  adapterMethodNames.map((name) => [
    name,
    (...arguments_: unknown[]) => {
      const method = Reflect.get(getAuthAdapter(), name) as
        ((...values: unknown[]) => unknown) | undefined;
      if (method === undefined) {
        throw new Error(`Auth adapter method ${name} is unavailable`);
      }
      return method(...arguments_);
    },
  ]),
) as Adapter;

function authSecret(): string {
  const configured = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (configured !== undefined) return configured;
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return 'nilam-build-only-secret-never-used-at-runtime';
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is required in production');
  }
  return 'nilam-local-development-secret-change-before-production';
}

const persistedUserId = z.uuid();

/** NextAuth uses `{ id: email }` as a placeholder until the user row exists. */
export function isPersistedUserId(id: string | undefined): id is string {
  return persistedUserId.safeParse(id).success;
}

const useSecureCookies = process.env.NODE_ENV === 'production';

export const authOptions: NextAuthOptions = {
  adapter,
  secret: authSecret(),
  useSecureCookies,
  session: { strategy: 'database' },
  cookies: {
    sessionToken: {
      name: useSecureCookies
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
  },
  providers: [
    EmailProvider({
      from: process.env.AUTH_EMAIL_FROM ?? 'NILAM <no-reply@localhost>',
      maxAge: 15 * 60,
      async sendVerificationRequest({ identifier, url, expires }) {
        await sendMagicLink({ identifier, url, expires });
      },
    }),
  ],
  pages: {
    signIn: '/account/sign-in',
    verifyRequest: '/account/verify',
  },
  callbacks: {
    async signIn({ user }) {
      if (!isPersistedUserId(user.id)) return true;
      const [record] = await getDatabase()
        .db.select({ deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      return record?.deletedAt === null;
    },
    session({ session, user }) {
      if (session.user !== undefined) {
        session.user.id = user.id;
        session.user.role =
          (user as typeof user & { role?: SessionRole }).role ?? 'user';
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id === undefined) return;
      const now = new Date();
      const database = getDatabase().db;
      await database
        .update(users)
        .set({ consentedAt: now, updatedAt: now })
        .where(eq(users.id, user.id));
      await database.insert(consentRecords).values({
        userId: user.id,
        kind: 'terms_and_privacy',
        version: process.env.CONSENT_VERSION ?? '2026-08-21',
        granted: true,
        source: 'email_magic_link',
      });
      await database.insert(auditRecords).values({
        actorId: user.id,
        action: 'account.created',
        targetType: 'user',
        targetId: user.id,
      });
    },
    async signIn({ user }) {
      if (user.id === undefined) return;
      await getDatabase().db.insert(auditRecords).values({
        actorId: user.id,
        action: 'account.signed_in',
        targetType: 'user',
        targetId: user.id,
      });
    },
    async signOut({ session }) {
      const userId = (session as unknown as { userId: string }).userId;
      await getDatabase().db.insert(auditRecords).values({
        actorId: userId,
        action: 'account.signed_out',
        targetType: 'user',
        targetId: userId,
      });
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}

export type { SessionRole } from './roles';
