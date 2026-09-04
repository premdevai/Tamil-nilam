import { redirect } from 'next/navigation';

import { getSession } from './auth';
import { can, type Capability } from './roles';

export { can };

export async function requireSession() {
  const session = await getSession();
  if (session?.user === undefined) redirect('/account/sign-in');
  return session;
}

export async function requireCapability(capability: Capability) {
  const session = await requireSession();
  if (!can(session.user.role, capability)) redirect('/account?error=forbidden');
  return session;
}

export async function authorizeRequest(capability: Capability) {
  const session = await getSession();
  if (session?.user === undefined) {
    return {
      ok: false as const,
      response: Response.json({ error: 'unauthorized' }, { status: 401 }),
    };
  }
  if (!can(session.user.role, capability)) {
    return {
      ok: false as const,
      response: Response.json({ error: 'forbidden' }, { status: 403 }),
    };
  }
  return { ok: true as const, session };
}
