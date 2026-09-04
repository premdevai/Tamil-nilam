import {
  CURRENT_RULESET_VERSION,
  MatcherInputSchema,
  evaluatePinned,
} from '@nilam/engine';
import type { JobHelpers, TaskList } from 'graphile-worker';
import { z } from 'zod';

import { deleteAccountDocuments } from './account-cleanup.js';
import { runBulkStack } from './bulk.js';
import { generateDprDocument, generatePrintableReport } from './generate.js';
import { nextRetryAt } from './retry.js';
import { describeProjectImpact, projectImpactDiff } from './project-impact.js';
import {
  createDeliveryTransport,
  type DeliveryTransport,
} from './transports.js';

const goImpactSchema = z.object({
  schemeSlug: z.string().min(1),
  versionKey: z.string().min(1),
  summary: z.string().min(1),
  citationUrl: z.url(),
});
const vacancyImpactSchema = z.object({
  estateId: z.uuid(),
  versionKey: z.string().min(1),
  summary: z.string().min(1),
});

export function createTaskList(
  transport: DeliveryTransport = createDeliveryTransport(),
): TaskList {
  return {
    process_publication_impacts: async (_payload, helpers) => {
      const pending = await helpers.query<{
        outboxId: string;
        publicationId: string;
        entityType: string;
        entityKey: string;
        data: Record<string, unknown>;
        citationUrl: string;
      }>(
        `select po.id::text as "outboxId",
          pv.id::text as "publicationId",
          pv.entity_type as "entityType", pv.entity_key as "entityKey",
          pv.data, pv.citation_url as "citationUrl"
         from publication_outbox po
         join publication_versions pv on pv.id = po.publication_id
         where po.kind = 'calculate-impact' and po.processed_at is null
         order by po.created_at
         for update of po skip locked limit 50`,
      );
      for (const item of pending.rows) {
        if (['scheme', 'rule', 'rule_version'].includes(item.entityType)) {
          await helpers.addJob(
            'calculate_go_impact',
            {
              schemeSlug: item.entityKey,
              versionKey: item.publicationId,
              summary:
                typeof item.data.summary === 'string'
                  ? item.data.summary
                  : `A verified rule version changed for ${item.entityKey}.`,
              citationUrl: item.citationUrl,
            },
            { jobKey: `go-impact:${item.publicationId}` },
          );
        } else if (['estate', 'plot', 'vacancy'].includes(item.entityType)) {
          const estateId =
            typeof item.data.estateId === 'string'
              ? item.data.estateId
              : typeof item.data.id === 'string'
                ? item.data.id
                : undefined;
          if (estateId !== undefined && z.uuid().safeParse(estateId).success) {
            await helpers.addJob(
              'calculate_vacancy_impact',
              {
                estateId,
                versionKey: item.publicationId,
                summary:
                  typeof item.data.summary === 'string'
                    ? item.data.summary
                    : `Verified vacancy data changed for ${item.entityKey}.`,
              },
              { jobKey: `vacancy-impact:${item.publicationId}` },
            );
          }
        }
        await helpers.query(
          `update publication_outbox set processed_at = now()
           where id = $1::uuid and processed_at is null`,
          [item.outboxId],
        );
      }
    },
    scan_deadlines: async (payload, helpers) => {
      const days = z
        .object({ days: z.number().int().min(1).max(90).default(30) })
        .parse(payload ?? {}).days;
      const deadlines = await helpers.query<{
        slug: string;
        name: string;
        sunsetDate: string;
      }>(
        `select slug, name, sunset_date::text as "sunsetDate"
         from schemes
         where sunset_date between current_date and current_date + $1::int
         order by sunset_date`,
        [days],
      );
      for (const deadline of deadlines.rows) {
        await createSchemeImpact(
          helpers,
          'deadline',
          deadline.slug,
          deadline.sunsetDate,
          `Deadline approaching: ${deadline.name}`,
          `${deadline.name} currently closes on ${deadline.sunsetDate}. Recheck the cited authority before applying.`,
        );
      }
    },
    calculate_go_impact: async (payload, helpers) => {
      const impact = goImpactSchema.parse(payload);
      await createPersonalSchemeImpacts(helpers, impact);
    },
    calculate_vacancy_impact: async (payload, helpers) => {
      const impact = vacancyImpactSchema.parse(payload);
      const event = await helpers.query<{ id: string }>(
        `insert into impact_events
          (kind, entity_type, entity_id, version_key, payload)
         values ('vacancy', 'estate', $1, $2, jsonb_build_object('summary', $3::text))
         on conflict (kind, entity_type, entity_id, version_key)
         do update set payload = excluded.payload
         returning id::text`,
        [impact.estateId, impact.versionKey, impact.summary],
      );
      await helpers.query(
        `insert into notification_deliveries
          (user_id, impact_event_id, channel, kind, idempotency_key, subject, body)
         select we.user_id, $1::uuid, channel.name::notification_channel,
           'vacancy', md5(we.user_id::text || ':' || $1::text || ':' || channel.name),
           'Estate vacancy update', $3
         from watched_estates we
         join users u on u.id = we.user_id and u.deleted_at is null
         left join notification_preferences np on np.user_id = we.user_id
         cross join lateral (values ('email'), ('telegram')) channel(name)
         where we.estate_id = $2::uuid and we.vacancy_alerts
           and coalesce(np.vacancy_alerts, true)
           and ((channel.name = 'email' and coalesce(np.email_enabled, true) and u.email is not null)
             or (channel.name = 'telegram' and coalesce(np.telegram_enabled, false) and u.telegram_chat_id is not null))
         on conflict (idempotency_key) do nothing`,
        [event.rows[0]?.id, impact.estateId, impact.summary],
      );
    },
    deliver_notifications: async (_payload, helpers) => {
      for (let index = 0; index < 50; index += 1) {
        const claimed = await helpers.query<DeliveryRow>(
          `with candidate as (
            select nd.id
            from notification_deliveries nd
            where nd.status in ('queued', 'sending')
              and (nd.next_attempt_at is null or nd.next_attempt_at <= now())
              and (nd.status = 'queued' or nd.last_attempt_at < now() - interval '10 minutes')
            order by nd.created_at
            for update skip locked limit 1
          )
          update notification_deliveries nd
          set status = 'sending', attempt_count = attempt_count + 1,
            last_attempt_at = now(), updated_at = now()
          from candidate, users u
          where nd.id = candidate.id and u.id = nd.user_id
          returning nd.id::text, nd.channel, nd.subject, nd.body,
            nd.attempt_count as "attemptCount", u.email,
            u.telegram_chat_id as "telegramChatId"`,
        );
        const delivery = claimed.rows[0];
        if (delivery === undefined) break;
        const destination =
          delivery.channel === 'email'
            ? delivery.email
            : delivery.telegramChatId;
        if (destination === null) {
          await helpers.query(
            `update notification_deliveries
             set status = 'suppressed', last_error = 'Destination unavailable',
               updated_at = now()
             where id = $1::uuid`,
            [delivery.id],
          );
          continue;
        }
        try {
          const providerMessageId = await transport.send({
            channel: delivery.channel,
            destination,
            subject: delivery.subject,
            body: delivery.body,
          });
          await helpers.query(
            `update notification_deliveries
             set status = 'delivered', delivered_at = now(),
               provider_message_id = $2, last_error = null, updated_at = now()
             where id = $1::uuid`,
            [delivery.id, providerMessageId],
          );
        } catch (error) {
          const nextAttempt = nextRetryAt(delivery.attemptCount);
          await helpers.query(
            `update notification_deliveries
             set status = $2::notification_status, next_attempt_at = $3,
               last_error = $4, updated_at = now()
             where id = $1::uuid`,
            [
              delivery.id,
              nextAttempt === undefined ? 'failed' : 'queued',
              nextAttempt,
              error instanceof Error
                ? error.message.slice(0, 2_000)
                : 'Unknown delivery error',
            ],
          );
        }
      }
    },
    run_operations: async (_payload, helpers) => {
      for (let index = 0; index < 20; index += 1) {
        const claimed = await helpers.query<OperationRow>(
          `with candidate as (
            select id from operation_jobs
            where status = 'queued'
              and (next_attempt_at is null or next_attempt_at <= now())
            order by created_at for update skip locked limit 1
          )
          update operation_jobs oj
          set status = 'running', attempt_count = attempt_count + 1,
            started_at = now(), updated_at = now()
          from candidate where oj.id = candidate.id
          returning oj.id::text, oj.task, oj.payload,
            oj.attempt_count as "attemptCount", oj.max_attempts as "maxAttempts"`,
        );
        const operation = claimed.rows[0];
        if (operation === undefined) break;
        try {
          await runOperation(operation, helpers);
          await helpers.query(
            `update operation_jobs set status = 'succeeded',
              completed_at = now(), last_error = null, updated_at = now()
             where id = $1::uuid`,
            [operation.id],
          );
        } catch (error) {
          const nextAttempt =
            operation.attemptCount >= operation.maxAttempts
              ? undefined
              : nextRetryAt(operation.attemptCount);
          const message =
            error instanceof Error
              ? error.message.slice(0, 2_000)
              : 'Unknown operation error';
          await markDocumentFailure(
            operation,
            helpers,
            message,
            nextAttempt === undefined,
          );
          await helpers.query(
            `update operation_jobs
             set status = $2::operation_job_status, next_attempt_at = $3,
               last_error = $4, updated_at = now()
             where id = $1::uuid`,
            [
              operation.id,
              nextAttempt === undefined ? 'failed' : 'queued',
              nextAttempt,
              message,
            ],
          );
        }
      }
    },
  };
}

async function createPersonalSchemeImpacts(
  helpers: JobHelpers,
  impact: z.infer<typeof goImpactSchema>,
) {
  let afterId: string | null = null;
  for (;;) {
    const candidates: { rows: ProjectCandidate[] } =
      await helpers.query<ProjectCandidate>(
        `select ss.id::text, ss.user_id::text as "userId", ss.inputs,
         ss.result_snapshot as "resultSnapshot"
       from saved_stacks ss
       join users u on u.id = ss.user_id and u.deleted_at is null
       where ss.user_id is not null
         and ($1::uuid is null or ss.id > $1::uuid)
       order by ss.id limit 200`,
        [afterId],
      );
    if (candidates.rows.length === 0) break;
    for (const project of candidates.rows) {
      const input = MatcherInputSchema.safeParse(project.inputs);
      if (!input.success) continue;
      const current = evaluatePinned(input.data, CURRENT_RULESET_VERSION, {
        asOf: new Date().toISOString().slice(0, 10),
      });
      const diffs = projectImpactDiff(
        project.resultSnapshot,
        current,
        impact.schemeSlug,
      );
      if (diffs.length === 0) continue;
      const body = `${describeProjectImpact(
        impact.schemeSlug,
        diffs,
        impact.citationUrl,
      )} Verified summary: ${impact.summary}`;
      const event = await helpers.query<{ id: string }>(
        `insert into impact_events
           (kind, entity_type, entity_id, version_key, payload)
         values (
           'project_change',
           'saved_stack',
           $1,
           $2,
           jsonb_build_object(
             'schemeSlug', $3::text,
             'summary', $4::text,
             'citationUrl', $5::text,
             'diffs', $6::jsonb
           )
         )
         on conflict (kind, entity_type, entity_id, version_key)
         do update set payload = excluded.payload
         returning id::text`,
        [
          project.id,
          impact.versionKey,
          impact.schemeSlug,
          body,
          impact.citationUrl,
          JSON.stringify(diffs),
        ],
      );
      const impactEventId = event.rows[0]?.id;
      if (impactEventId === undefined) continue;
      await helpers.query(
        `insert into notification_deliveries
           (user_id, impact_event_id, channel, kind, idempotency_key,
            subject, body)
         select u.id, $1::uuid, channel.name::notification_channel,
           'project_change',
           md5(u.id::text || ':' || $1::text || ':' || channel.name),
           $3, $4
         from users u
         left join notification_preferences np on np.user_id = u.id
         cross join lateral (values ('email'), ('telegram')) channel(name)
         where u.id = $2::uuid and u.deleted_at is null
           and coalesce(np.go_change_alerts, true)
           and (
             (channel.name = 'email' and coalesce(np.email_enabled, true)
               and u.email is not null)
             or
             (channel.name = 'telegram'
               and coalesce(np.telegram_enabled, false)
               and u.telegram_chat_id is not null)
           )
         on conflict (idempotency_key) do nothing`,
        [
          impactEventId,
          project.userId,
          `Verified change affects ${impact.schemeSlug}`,
          body,
        ],
      );
    }
    afterId = candidates.rows.at(-1)?.id ?? null;
    if (candidates.rows.length < 200) break;
  }
}

async function createSchemeImpact(
  helpers: JobHelpers,
  kind: 'deadline' | 'go_change',
  schemeSlug: string,
  versionKey: string,
  subject: string,
  body: string,
) {
  const event = await helpers.query<{ id: string }>(
    `insert into impact_events
      (kind, entity_type, entity_id, version_key, payload)
     values ($1, 'scheme', $2, $3, jsonb_build_object('summary', $4::text))
     on conflict (kind, entity_type, entity_id, version_key)
     do update set payload = excluded.payload
     returning id::text`,
    [kind, schemeSlug, versionKey, body],
  );
  await helpers.query(
    `insert into notification_deliveries
      (user_id, impact_event_id, channel, kind, idempotency_key, subject, body)
     select distinct ss.user_id, $1::uuid, channel.name::notification_channel,
       $2, md5(ss.user_id::text || ':' || $1::text || ':' || channel.name),
       $4, $5
     from saved_stacks ss
     join users u on u.id = ss.user_id and u.deleted_at is null
     left join notification_preferences np on np.user_id = ss.user_id
     cross join lateral (values ('email'), ('telegram')) channel(name)
     where ss.result_snapshot -> 'eligibleSchemeSlugs' ? $3
       and (($2 = 'deadline' and coalesce(np.deadline_reminders, true))
         or ($2 = 'go_change' and coalesce(np.go_change_alerts, true)))
       and ((channel.name = 'email' and coalesce(np.email_enabled, true) and u.email is not null)
         or (channel.name = 'telegram' and coalesce(np.telegram_enabled, false) and u.telegram_chat_id is not null))
     on conflict (idempotency_key) do nothing`,
    [event.rows[0]?.id, kind, schemeSlug, subject, body],
  );
}

async function runOperation(operation: OperationRow, helpers: JobHelpers) {
  if (operation.task === 'generate_dpr') {
    await generateDprDocument(operation.payload, helpers);
    return;
  }
  if (operation.task === 'generate_printable_report') {
    await generatePrintableReport(operation.payload, helpers);
    return;
  }
  if (operation.task === 'run_bulk_stack') {
    await runBulkStack(operation.payload, helpers);
    return;
  }
  if (operation.task !== 'delete_account') {
    throw new Error(`Unsupported operation task: ${operation.task}`);
  }
  const payload = z
    .object({ userId: z.uuid(), dataRequestId: z.uuid() })
    .parse(operation.payload);
  await helpers.query('begin');
  try {
    await helpers.query(
      `update account_data_requests set status = 'processing', updated_at = now()
       where id = $1::uuid and user_id = $2::uuid`,
      [payload.dataRequestId, payload.userId],
    );
    await deleteAccountDocuments(helpers.query, payload.userId);
    await helpers.query(`delete from auth_sessions where user_id = $1::uuid`, [
      payload.userId,
    ]);
    await helpers.query(`delete from auth_accounts where user_id = $1::uuid`, [
      payload.userId,
    ]);
    await helpers.query(
      `delete from impact_events
       where entity_type = 'saved_stack'
         and entity_id in (
           select id::text from saved_stacks where user_id = $1::uuid
         )`,
      [payload.userId],
    );
    await helpers.query(`delete from saved_stacks where user_id = $1::uuid`, [
      payload.userId,
    ]);
    await helpers.query(
      `delete from watched_estates where user_id = $1::uuid`,
      [payload.userId],
    );
    await helpers.query(
      `delete from user_playbook_progress where user_id = $1::uuid`,
      [payload.userId],
    );
    await helpers.query(
      `delete from printable_reports where user_id = $1::uuid`,
      [payload.userId],
    );
    await helpers.query(`delete from generated_dprs where user_id = $1::uuid`, [
      payload.userId,
    ]);
    await helpers.query(
      `delete from bulk_stack_runs where owner_user_id = $1::uuid`,
      [payload.userId],
    );
    await helpers.query(
      `delete from business_profiles where owner_user_id = $1::uuid`,
      [payload.userId],
    );
    await helpers.query(
      `delete from client_workspaces where consultant_user_id = $1::uuid`,
      [payload.userId],
    );
    await helpers.query(`delete from entitlements where user_id = $1::uuid`, [
      payload.userId,
    ]);
    await helpers.query(`delete from usage_ledger where user_id = $1::uuid`, [
      payload.userId,
    ]);
    await helpers.query(
      `delete from notification_deliveries where user_id = $1::uuid`,
      [payload.userId],
    );
    await helpers.query(
      `delete from notification_preferences where user_id = $1::uuid`,
      [payload.userId],
    );
    await helpers.query(
      `update users set email = 'deleted+' || id::text || '@nilam.invalid',
        name = null, image = null, telegram_chat_id = null,
        consented_at = null, deleted_at = now(), updated_at = now()
       where id = $1::uuid`,
      [payload.userId],
    );
    await helpers.query(
      `update account_data_requests
       set status = 'completed', completed_at = now(), updated_at = now()
       where id = $1::uuid`,
      [payload.dataRequestId],
    );
    await helpers.query('commit');
  } catch (error) {
    await helpers.query('rollback');
    throw error;
  }
}

async function markDocumentFailure(
  operation: OperationRow,
  helpers: JobHelpers,
  message: string,
  terminal: boolean,
) {
  const status = terminal ? 'failed' : 'queued';
  if (operation.task === 'generate_dpr') {
    const parsed = z.object({ dprId: z.uuid() }).safeParse(operation.payload);
    if (!parsed.success) return;
    await helpers.query(
      `update generated_dprs
       set status = $2::dpr_status, error = $3, updated_at = now()
       where id = $1::uuid and status = 'generating'`,
      [parsed.data.dprId, status, message],
    );
    return;
  }
  if (operation.task === 'generate_printable_report') {
    const parsed = z
      .object({ reportId: z.uuid() })
      .safeParse(operation.payload);
    if (!parsed.success) return;
    await helpers.query(
      `update printable_reports
       set status = $2::dpr_status, error = $3, updated_at = now()
       where id = $1::uuid and status = 'generating'`,
      [parsed.data.reportId, status, message],
    );
    return;
  }
  if (operation.task === 'run_bulk_stack') {
    const parsed = z.object({ runId: z.uuid() }).safeParse(operation.payload);
    if (!parsed.success) return;
    await helpers.query(
      `update bulk_stack_runs
       set status = $2::bulk_run_status, error = $3, updated_at = now()
       where id = $1::uuid and status = 'running'`,
      [parsed.data.runId, terminal ? 'failed' : 'queued', message],
    );
  }
}

type DeliveryRow = {
  id: string;
  channel: 'email' | 'telegram';
  subject: string;
  body: string;
  attemptCount: number;
  email: string | null;
  telegramChatId: string | null;
};

type OperationRow = {
  id: string;
  task: string;
  payload: unknown;
  attemptCount: number;
  maxAttempts: number;
};

type ProjectCandidate = {
  id: string;
  userId: string;
  inputs: Record<string, unknown>;
  resultSnapshot: Record<string, unknown>;
};
