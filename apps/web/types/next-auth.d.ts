import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'user' | 'consultant' | 'reviewer' | 'admin';
    } & DefaultSession['user'];
  }

  interface User {
    role?: 'user' | 'consultant' | 'reviewer' | 'admin';
    deletedAt?: Date | null;
  }
}
