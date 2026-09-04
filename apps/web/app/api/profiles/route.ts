import { businessProfileDataSchema, hashSnapshot } from '@nilam/paid';
import { z } from 'zod';

import { authorizeRequest } from '../../../lib/authz';
import { getDatabase } from '../../../lib/db';
import { authorizeEntitlement } from '../../../lib/paid-access';
import { countOwned, planLimitsFor } from '../../../lib/quota';
import { ownedWorkspaceId } from '../../../lib/workspace';

const schema = z
  .object({
    name: z.string().trim().min(2).max(160),
    profile: businessProfileDataSchema,
    clientWorkspaceId: z.uuid().optional(),
  })
  .strict();

export async function GET() {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const entitlementError = await authorizeEntitlement(
    authorization.session.user.id,
    'profiles:write',
  );
  if (entitlementError !== undefined) return entitlementError;
  const result = await getDatabase().pool.query(
    `select id::text, name, client_workspace_id as "clientWorkspaceId",
       profile_data as "profileData", created_at as "createdAt"
     from business_profiles
     where owner_user_id = $1::uuid
     order by created_at desc`,
    [authorization.session.user.id],
  );
  return Response.json({ profiles: result.rows });
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const userId = authorization.session.user.id;
  const entitlementError = await authorizeEntitlement(userId, 'profiles:write');
  if (entitlementError !== undefined) return entitlementError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_profile' }, { status: 400 });
  }
  const pool = getDatabase().pool;
  const workspaceError = await ownedWorkspaceId(
    pool,
    parsed.data.clientWorkspaceId,
    userId,
  );
  if (workspaceError !== undefined) return workspaceError;
  const limits = await planLimitsFor(userId);
  if ((await countOwned('business_profiles', userId)) >= limits.profiles) {
    return Response.json(
      { error: 'quota_exceeded', limit: limits.profiles },
      { status: 402 },
    );
  }
  const profileHash = hashSnapshot(parsed.data.profile);
  const created = await pool.query<{ id: string }>(
    `insert into business_profiles
       (owner_user_id, client_workspace_id, name, profile_data, profile_hash)
     values ($1::uuid, $2::uuid, $3, $4::jsonb, $5)
     on conflict (owner_user_id, profile_hash) do update
       set name = excluded.name, updated_at = now()
     returning id::text`,
    [
      userId,
      parsed.data.clientWorkspaceId ?? null,
      parsed.data.name,
      JSON.stringify(parsed.data.profile),
      profileHash,
    ],
  );
  const id = created.rows[0]?.id;
  if (id === undefined) throw new Error('Business profile was not saved.');
  await pool.query(
    `insert into audit_records
       (actor_id, action, target_type, target_id, metadata)
     values ($1::uuid, 'profile.saved', 'business_profile', $2,
       jsonb_build_object('hash', $3::text))`,
    [userId, id, profileHash],
  );
  return Response.json({ id, profileHash }, { status: 201 });
}
