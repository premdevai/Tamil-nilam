import type { Pool } from 'pg';

export async function ownedWorkspaceId(
  pool: Pool,
  workspaceId: string | undefined,
  userId: string,
): Promise<Response | undefined> {
  if (workspaceId === undefined) return undefined;
  const workspace = await pool.query(
    `select 1 from client_workspaces
     where id = $1::uuid and consultant_user_id = $2::uuid
       and archived_at is null`,
    [workspaceId, userId],
  );
  if (workspace.rowCount === 0) {
    return Response.json({ error: 'client_not_found' }, { status: 404 });
  }
  return undefined;
}
