import { z } from 'zod';

import { authorizeRequest } from '../../../lib/authz';
import { getDatabase } from '../../../lib/db';
import { authorizeEntitlement } from '../../../lib/paid-access';
import { countOwned, planLimitsFor } from '../../../lib/quota';

const schema = z
  .object({
    name: z.string().trim().min(2).max(160),
    contactEmail: z.string().trim().email().max(240).optional(),
    externalReference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2_000).optional(),
  })
  .strict();

export async function GET() {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const entitlementError = await authorizeEntitlement(
    authorization.session.user.id,
    'clients:write',
  );
  if (entitlementError !== undefined) return entitlementError;
  const result = await getDatabase().pool.query(
    `select id::text, name, contact_email as "contactEmail",
       external_reference as "externalReference", notes,
       archived_at as "archivedAt", created_at as "createdAt"
     from client_workspaces
     where consultant_user_id = $1::uuid
     order by created_at desc`,
    [authorization.session.user.id],
  );
  return Response.json({ clients: result.rows });
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const userId = authorization.session.user.id;
  const entitlementError = await authorizeEntitlement(userId, 'clients:write');
  if (entitlementError !== undefined) return entitlementError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_client' }, { status: 400 });
  }
  const limits = await planLimitsFor(userId);
  if ((await countOwned('client_workspaces', userId)) >= limits.clients) {
    return Response.json(
      { error: 'quota_exceeded', limit: limits.clients },
      { status: 402 },
    );
  }
  const created = await getDatabase().pool.query<{ id: string }>(
    `insert into client_workspaces
       (consultant_user_id, name, contact_email, external_reference, notes)
     values ($1::uuid, $2, $3, $4, $5)
     returning id::text`,
    [
      userId,
      parsed.data.name,
      parsed.data.contactEmail ?? null,
      parsed.data.externalReference ?? null,
      parsed.data.notes ?? null,
    ],
  );
  const id = created.rows[0]?.id;
  if (id === undefined) throw new Error('Client workspace was not created.');
  await getDatabase().pool.query(
    `insert into audit_records
       (actor_id, action, target_type, target_id, metadata)
     values ($1::uuid, 'client.created', 'client_workspace', $2,
       jsonb_build_object('name', $3::text))`,
    [userId, id, parsed.data.name],
  );
  return Response.json({ id, name: parsed.data.name }, { status: 201 });
}
