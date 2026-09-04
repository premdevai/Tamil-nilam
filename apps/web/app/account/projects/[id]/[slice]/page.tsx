import {
  MatcherInputSchema,
  getRuleset,
  type MatcherInput,
} from '@nilam/engine';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  ExecutionTracker,
  OutcomeRecorder,
  ReadinessForm,
} from '../../../../../components/project-companion-forms';
import { BilingualHeading } from '../../../../../components/public-shell';
import { requireSession } from '../../../../../lib/authz';
import type { CompanionSlice } from '../../../../../lib/companion-flags';
import type { ProjectReadinessInput } from '../../../../../lib/project-companion';
import { evaluateMatcherSurface } from '../../../../../lib/matcher-surfaces';
import {
  loadDocumentChecklist,
  loadOwnedProject,
} from '../../../../../lib/project-memory';
import { getDatabase } from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

const CHILD_SLICES = [
  'readiness',
  'execution',
  'impact',
  'outcomes',
] as const satisfies readonly CompanionSlice[];

export default async function ProjectSlicePage({
  params,
}: {
  readonly params: Promise<{ id: string; slice: string }>;
}) {
  const session = await requireSession();
  const { id, slice: rawSlice } = await params;
  if (!CHILD_SLICES.includes(rawSlice as (typeof CHILD_SLICES)[number])) {
    notFound();
  }
  const slice = rawSlice as (typeof CHILD_SLICES)[number];
  const project = await loadOwnedProject(id, session.user.id);
  if (project === null) notFound();

  const input = MatcherInputSchema.safeParse(project.inputs);
  const evaluation = input.success
    ? evaluateProject(input.data, project.rulesetVersion)
    : null;
  const eligible = Array.isArray(project.resultSnapshot.eligibleSchemeSlugs)
    ? project.resultSnapshot.eligibleSchemeSlugs.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];
  const checklist =
    slice === 'readiness' ? await loadDocumentChecklist(eligible) : [];
  const readiness = readinessInput(project, checklist);
  const firstAction = evaluation?.sequence[0];
  const firstRecord =
    firstAction === undefined || evaluation === null
      ? undefined
      : getRuleset(project.rulesetVersion).records.find(
          (record) =>
            record.status === 'published' &&
            firstAction.schemeIds.includes(record.id),
        );
  const firstCitation =
    firstRecord?.status === 'published' ? firstRecord.citations[0] : undefined;
  const impacts =
    slice === 'impact'
      ? await getDatabase().pool.query<{
          id: string;
          payload: Record<string, unknown>;
          occurredAt: Date;
          deliveryStatus: string | null;
        }>(
          `select ie.id::text, ie.payload, ie.occurred_at as "occurredAt",
             max(nd.status::text) as "deliveryStatus"
           from impact_events ie
           left join notification_deliveries nd
             on nd.impact_event_id = ie.id and nd.user_id = $2::uuid
           where ie.entity_type = 'saved_stack' and ie.entity_id = $1
           group by ie.id
           order by ie.occurred_at desc`,
          [id, session.user.id],
        )
      : undefined;

  return (
    <section className="content-page account-page">
      <BilingualHeading
        eyebrow={`${project.name} · ${slice}`}
        title={sliceTitle(slice)}
        titleTa="திட்ட செயலாக்கம்"
      >
        <p className="lede">
          Every write is scoped to this signed-in owner and keeps official
          evidence beside the recorded state.
        </p>
      </BilingualHeading>
      <p>
        <Link href={`/account/projects/${id}`}>← Project overview</Link>
      </p>

      {slice === 'readiness' ? (
        <>
          <ReadinessForm
            projectId={id}
            initial={readiness}
            assumptions={project.assumptions}
          />
          <p className="notice">
            <Link href={`/account/dpr?project=${id}`}>
              Prefill the guided DPR from this reusable project profile
            </Link>
            .
          </p>
        </>
      ) : null}

      {slice === 'execution' ? (
        <ExecutionTracker
          projectId={id}
          tasks={project.companion.tasks}
          {...(firstAction === undefined || firstCitation === undefined
            ? {}
            : {
                suggested: {
                  title: firstAction.title,
                  organisation: firstAction.organisation,
                  officialUrl: firstCitation.url,
                },
              })}
        />
      ) : null}

      {slice === 'impact' ? (
        <section className="account-card">
          <h2>Verified personal changes</h2>
          {impacts?.rows.length === 0 ? (
            <p>
              No verified rule publication has materially changed this project’s
              eligibility, amount, deadline or first action.
            </p>
          ) : (
            <ul className="history-list">
              {impacts?.rows.map((impact) => (
                <li key={`${impact.id}-${impact.deliveryStatus ?? 'none'}`}>
                  <strong>{String(impact.payload.summary ?? 'Change')}</strong>
                  <span>
                    {impact.occurredAt.toLocaleDateString('en-IN')} · delivery{' '}
                    {impact.deliveryStatus ?? 'not requested'}
                  </span>
                  {typeof impact.payload.citationUrl === 'string' ? (
                    <a
                      href={impact.payload.citationUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Official evidence
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {slice === 'outcomes' ? (
        <>
          <OutcomeRecorder projectId={id} />
          <section className="account-card">
            <h2>Official outcome history</h2>
            {project.companion.outcomes.length === 0 ? (
              <p>No submission or official outcome recorded.</p>
            ) : (
              <ul className="history-list">
                {project.companion.outcomes.map((outcome) => (
                  <li key={outcome.id}>
                    <strong>{outcome.status}</strong>
                    <span>
                      {outcome.officialReference} · {outcome.recordedOn}
                    </span>
                    <a href={outcome.evidenceUrl}>Official evidence</a>
                    {outcome.status === 'rejected' ? (
                      <small>{outcome.rejectionReason}</small>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

function readinessInput(
  project: Awaited<ReturnType<typeof loadOwnedProject>>,
  checklist: readonly string[],
): ProjectReadinessInput {
  if (project === null) throw new Error('Project is required.');
  if (project.companion.readiness !== undefined) {
    return {
      profileFacts: project.companion.readiness.profileFacts,
      documents: project.companion.readiness.documents,
      blockers: project.companion.readiness.blockers,
      confirmedAssumptions: project.companion.readiness.confirmedAssumptions,
    };
  }
  const labels =
    checklist.length > 0
      ? checklist
      : [
          'Udyam registration',
          'Promoter identity and address proof',
          'Project cost quotations',
        ];
  return {
    profileFacts: {
      ...project.inputs,
      businessName: '',
      promoterName: '',
    },
    documents: labels.map((label, index) => ({
      key: `document-${index + 1}`,
      label,
      required: true,
      status: 'missing',
      expiresOn: null,
    })),
    blockers: [],
    confirmedAssumptions: [],
  };
}

function evaluateProject(input: MatcherInput, ruleset: string) {
  try {
    getRuleset(ruleset);
    return evaluateMatcherSurface(input, ruleset);
  } catch {
    return null;
  }
}

function sliceTitle(slice: (typeof CHILD_SLICES)[number]): string {
  if (slice === 'readiness') return 'Application readiness';
  if (slice === 'execution') return 'Execution timeline';
  if (slice === 'impact') return 'Personal change impact';
  return 'Official outcomes';
}
