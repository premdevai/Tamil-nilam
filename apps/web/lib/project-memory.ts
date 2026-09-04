import { MatcherInputSchema } from '@nilam/engine';

import { getDatabase } from './db';
import { getNilamAssumptions } from './nilam-truth';
import {
  emptyProjectCompanion,
  parseProjectCompanion,
  type ProjectCompanion,
} from './project-companion';

export type OwnedProject = {
  readonly id: string;
  readonly name: string;
  readonly inputs: Record<string, unknown>;
  readonly resultSnapshot: Record<string, unknown>;
  readonly resultHash: string;
  readonly rulesetVersion: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly companion: ProjectCompanion;
  readonly assumptions: readonly {
    field: string;
    label: string;
    value: string;
    highImpact: boolean;
  }[];
};

export async function loadOwnedProject(
  projectId: string,
  userId: string,
): Promise<OwnedProject | null> {
  const result = await getDatabase().pool.query<{
    id: string;
    name: string;
    inputs: Record<string, unknown>;
    resultSnapshot: Record<string, unknown>;
    resultHash: string;
    rulesetVersion: string;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `select id::text, name, inputs, result_snapshot as "resultSnapshot",
       result_hash as "resultHash", ruleset_version as "rulesetVersion",
       created_at as "createdAt", updated_at as "updatedAt"
     from saved_stacks
     where id = $1::uuid and user_id = $2::uuid`,
    [projectId, userId],
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  const parsedInput = MatcherInputSchema.safeParse(row.inputs);
  return {
    ...row,
    companion: parseProjectCompanion(row.resultSnapshot),
    assumptions: parsedInput.success
      ? getNilamAssumptions(parsedInput.data).map((assumption) => ({
          ...assumption,
          field: assumption.field,
        }))
      : [],
  };
}

export function projectSnapshotWithCompanion(
  snapshot: Record<string, unknown>,
  companion: ProjectCompanion = emptyProjectCompanion(),
): Record<string, unknown> {
  return { ...snapshot, project: companion };
}

export async function loadDocumentChecklist(
  eligibleSchemeSlugs: readonly string[],
): Promise<readonly string[]> {
  if (eligibleSchemeSlugs.length === 0) return [];
  const result = await getDatabase().pool.query<{ checklist: string[] }>(
    `select docs_checklist as checklist from schemes where slug = any($1::text[])`,
    [eligibleSchemeSlugs],
  );
  return [...new Set(result.rows.flatMap((row) => row.checklist))];
}

export async function recordProjectMilestone(
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: unknown[]; rowCount?: number | null }>,
  {
    userId,
    projectId,
    kind,
    metadata = {},
  }: {
    readonly userId: string;
    readonly projectId: string;
    readonly kind:
      | 'qualified_project_created'
      | 'pursue_skip_decision'
      | 'assumption_confirmed'
      | 'first_next_action_completed'
      | 'application_ready'
      | 'submitted'
      | 'official_outcome';
    readonly metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await query(
    `insert into audit_records
       (actor_id, action, target_type, target_id, metadata)
     values ($1::uuid, $2, 'saved_stack', $3, $4::jsonb)`,
    [
      userId,
      `milestone.${kind}`,
      projectId,
      JSON.stringify({ ...metadata, recordedAt: new Date().toISOString() }),
    ],
  );
}
