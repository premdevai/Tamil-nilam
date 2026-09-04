import { getDatabase } from './db';

export type OperationsSnapshot = {
  sourceHealth: {
    agency: string;
    lastRetrievedAt: Date | null;
    documentCount: number;
  }[];
  staleRules: {
    id: string;
    scheme: string;
    version: number;
    verifiedOn: string;
  }[];
  reviewQueue: {
    id: string;
    entityType: string;
    entityKey: string;
    status: string;
    createdAt: Date;
    fieldDiff: unknown;
  }[];
  publishPreviews: {
    id: string;
    entityType: string;
    entityKey: string;
    proposedData: unknown;
  }[];
  rulesetDiffs: {
    scheme: string;
    fromVersion: number;
    toVersion: number;
    changelog: string;
  }[];
  failedJobs: {
    id: string;
    task: string;
    attempts: number;
    error: string | null;
    updatedAt: Date;
  }[];
  impactPreviews: {
    id: string;
    kind: string;
    entityType: string;
    entityId: string;
    recipientCount: number;
  }[];
  correctiveVersions: {
    id: string;
    entityKey: string;
    originalVersion: number;
    status: string;
    reason: string;
    createdAt: Date;
  }[];
};

export async function getOperationsSnapshot(): Promise<OperationsSnapshot> {
  const pool = getDatabase().pool;
  const [
    sourceHealth,
    staleRules,
    reviewQueue,
    publishPreviews,
    rulesetDiffs,
    failedJobs,
    impactPreviews,
    correctiveVersions,
  ] = await Promise.all([
    pool.query<{
      agency: string;
      lastRetrievedAt: Date | null;
      documentCount: string;
    }>(`select a.name as agency, max(sd.retrieved_at) as "lastRetrievedAt",
        count(sd.id)::text as "documentCount"
      from agencies a left join source_documents sd on sd.agency_id = a.id
      group by a.id, a.name order by max(sd.retrieved_at) nulls first`),
    pool.query<{
      id: string;
      scheme: string;
      version: number;
      verifiedOn: string;
    }>(`select rv.id::text, s.name as scheme, rv.version,
        rv.verified_on::text as "verifiedOn"
      from rule_versions rv join schemes s on s.id = rv.scheme_id
      where rv.effective_to is null
        and rv.verified_on < current_date - interval '180 days'
      order by rv.verified_on`),
    pool.query<OperationsSnapshot['reviewQueue'][number]>(
      `select id::text, entity_type as "entityType", entity_key as "entityKey",
        status, created_at as "createdAt", field_diff as "fieldDiff"
      from staging.review_queue
      where status in ('pending', 'needs_changes')
      order by created_at limit 50`,
    ),
    pool.query<OperationsSnapshot['publishPreviews'][number]>(
      `select rq.id::text, rq.entity_type as "entityType",
        rq.entity_key as "entityKey",
        coalesce(rq.reviewed_data, rq.proposed_data) as "proposedData"
      from staging.review_queue rq
      left join publication_versions pv on pv.review_item_id = rq.id
      where rq.status = 'approved' and pv.id is null
      order by rq.reviewed_at limit 50`,
    ),
    pool.query<OperationsSnapshot['rulesetDiffs'][number]>(
      `with ranked as (
        select rv.*, row_number() over (
          partition by rv.scheme_id order by rv.version desc
        ) as rank
        from rule_versions rv
      )
      select s.name as scheme, previous.version as "fromVersion",
        current.version as "toVersion", current.changelog_md as changelog
      from ranked current
      join ranked previous on previous.scheme_id = current.scheme_id
        and previous.rank = 2
      join schemes s on s.id = current.scheme_id
      where current.rank = 1 order by s.name`,
    ),
    pool.query<OperationsSnapshot['failedJobs'][number]>(
      `select id::text, task, attempt_count as attempts,
        last_error as error, updated_at as "updatedAt"
      from operation_jobs where status = 'failed'
      order by updated_at desc limit 50`,
    ),
    pool.query<OperationsSnapshot['impactPreviews'][number]>(
      `select ie.id::text, ie.kind, ie.entity_type as "entityType",
        ie.entity_id as "entityId", count(nd.id)::int as "recipientCount"
      from impact_events ie
      left join notification_deliveries nd on nd.impact_event_id = ie.id
      group by ie.id order by ie.occurred_at desc limit 50`,
    ),
    pool.query<OperationsSnapshot['correctiveVersions'][number]>(
      `select cv.id::text, pv.entity_key as "entityKey",
        pv.version as "originalVersion", cv.status, cv.reason,
        cv.created_at as "createdAt"
      from corrective_versions cv
      join publication_versions pv on pv.id = cv.publication_id
      order by cv.created_at desc limit 50`,
    ),
  ]);

  return {
    sourceHealth: sourceHealth.rows.map((row) => ({
      ...row,
      documentCount: Number(row.documentCount),
    })),
    staleRules: staleRules.rows,
    reviewQueue: reviewQueue.rows,
    publishPreviews: publishPreviews.rows,
    rulesetDiffs: rulesetDiffs.rows,
    failedJobs: failedJobs.rows,
    impactPreviews: impactPreviews.rows,
    correctiveVersions: correctiveVersions.rows,
  };
}

export async function getRoleDirectory() {
  const result = await getDatabase().pool.query<{
    id: string;
    email: string | null;
    name: string | null;
    role: 'user' | 'consultant' | 'reviewer' | 'admin';
  }>(
    `select id::text, email, name, role
     from users where deleted_at is null
     order by created_at desc limit 100`,
  );
  return result.rows;
}
