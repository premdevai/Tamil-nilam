import { z } from 'zod';

import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';
import { authorizeEntitlement } from '../../../../lib/paid-access';

const schema = z.object({ archived: z.boolean() }).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const entitlementError = await authorizeEntitlement(
    authorization.session.user.id,
    'clients:write',
  );
  if (entitlementError !== undefined) return entitlementError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_client_update' }, { status: 400 });
  }
  const { id } = await context.params;
  const updated = await getDatabase().pool.query<{ id: string }>(
    `update client_workspaces
     set archived_at = case when $3 then now() else null end, updated_at = now()
     where id = $1::uuid and consultant_user_id = $2::uuid
     returning id::text`,
    [id, authorization.session.user.id, parsed.data.archived],
  );
  if (updated.rows[0] === undefined) {
    return Response.json({ error: 'client_not_found' }, { status: 404 });
  }
  return Response.json({ id, archived: parsed.data.archived });
}
