import {
  MatcherInputSchema,
  getRuleset,
  type MatcherInput,
} from '@nilam/engine';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProjectDecisionForm } from '../../../../components/project-companion-forms';
import { BilingualHeading } from '../../../../components/public-shell';
import { buildApplicationPackets } from '../../../../lib/application-packets';
import { requireSession } from '../../../../lib/authz';
import { evaluateMatcherSurface } from '../../../../lib/matcher-surfaces';
import { loadOwnedProject } from '../../../../lib/project-memory';
import { landForDistrict } from '../../../../lib/tansidco-estates';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const project = await loadOwnedProject(id, session.user.id);
  if (project === null) notFound();
  const input = MatcherInputSchema.safeParse(project.inputs);
  const evaluation = input.success
    ? evaluateProject(input.data, project.rulesetVersion)
    : null;
  const firstAction = evaluation?.sequence[0];
  const firstScheme =
    firstAction === undefined || evaluation === null
      ? undefined
      : getRuleset(project.rulesetVersion).records.find(
          (record) =>
            record.status === 'published' &&
            firstAction.schemeIds.includes(record.id),
        );
  const citation =
    firstScheme?.status === 'published' ? firstScheme.citations[0] : undefined;
  const packets =
    evaluation === null ? [] : buildApplicationPackets(evaluation);
  const land =
    input.success === true
      ? landForDistrict(input.data.district).slice(0, 5)
      : [];

  return (
    <section className="content-page account-page">
      <BilingualHeading
        eyebrow={`Project · ruleset ${project.rulesetVersion}`}
        title={project.name}
        titleTa="திட்ட நினைவகம்"
      >
        <p className="lede">
          This project freezes the canonical matcher facts and evidence version.
          Companion tools update only this owned project.
        </p>
      </BilingualHeading>

      <section className="account-card">
        <h2>Project facts</h2>
        <div className="fact-grid">
          {Object.entries(project.inputs).map(([key, value]) => (
            <div key={key}>
              <span>{key.replaceAll(/([A-Z])/g, ' $1')}</span>
              <strong>{String(value)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="account-card">
        <h2>Unconfirmed assumptions</h2>
        {project.assumptions.length === 0 ? (
          <p>All canonical matcher facts are explicit.</p>
        ) : (
          <ul className="history-list">
            {project.assumptions.map((assumption) => (
              <li key={assumption.field}>
                <strong>{assumption.label}</strong>
                <span>
                  {assumption.value}
                  {assumption.highImpact ? ' · high impact' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="account-card">
        <h2>Application packets</h2>
        <p>
          Calculated rows use the published rule engine. Official doors are live
          portals whose cash is not calculated here. Tick submitted, queried or
          sanctioned on Outcomes after you apply.
        </p>
        {packets.length === 0 ? (
          <p>No packet is available for this frozen profile.</p>
        ) : (
          packets.map((packet) => (
            <article className="evidence-card" key={packet.schemeId}>
              <span
                className={
                  packet.kind === 'calculated'
                    ? 'status-badge status-published'
                    : 'status-badge status-pending-review'
                }
              >
                {packet.kind === 'calculated'
                  ? `Calculated · ₹${packet.cashLakhs}L`
                  : 'Official door · amount not calculated'}
              </span>
              <h3>{packet.name}</h3>
              <p>{packet.organisation}</p>
              <p>{packet.note}</p>
              <p>
                <strong>Ask the office:</strong> {packet.askTheOffice}
              </p>
              <ul>
                {packet.documents.map((document) => (
                  <li key={document.key}>
                    {document.label}
                    {document.required ? '' : ' · optional'}
                  </li>
                ))}
              </ul>
              <div className="card-actions">
                <a href={packet.officialUrl} rel="noreferrer" target="_blank">
                  Official apply
                </a>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="account-card">
        <h2>Dated TANSIDCO land</h2>
        {land.length === 0 ? (
          <p>
            No vacancy-chart estate is in this snapshot for the project
            district. SIPCOT and empty TANSIDCO parks are absent from the chart.
          </p>
        ) : (
          land.map((estate) => (
            <article className="evidence-card" key={estate.id}>
              <span
                className={
                  estate.dataQuality === 'vacancy-snapshot'
                    ? 'status-badge status-published'
                    : 'status-badge status-pending-review'
                }
              >
                {estate.vacantTotal === null
                  ? 'Directory only'
                  : `${estate.vacantTotal} vacant · ${estate.verifiedOn}`}
              </span>
              <h3>{estate.name}</h3>
              <p>
                {estate.district}
                {estate.block === null ? '' : ` · ${estate.block}`}
              </p>
            </article>
          ))
        )}
      </section>

      <section className="account-card">
        <h2>One verified next action</h2>
        {firstAction === undefined ? (
          <p>No sequence action is available for this frozen result.</p>
        ) : (
          <>
            <strong>{firstAction.title}</strong>
            <p>{firstAction.organisation}</p>
            {citation === undefined ? null : (
              <p>
                <a href={citation.url} rel="noreferrer" target="_blank">
                  Official evidence: {citation.title}
                </a>{' '}
                · verified {citation.verifiedOn}
              </p>
            )}
          </>
        )}
      </section>

      <section>
        <h2>Pursue or skip</h2>
        <ProjectDecisionForm
          projectId={project.id}
          {...(project.companion.decision === undefined
            ? {}
            : { initial: project.companion.decision })}
        />
      </section>

      <section className="account-card">
        <h2>Project tools</h2>
        <div className="card-actions">
          <Link href={`/account/projects/${id}/readiness`}>Readiness</Link>
          <Link href={`/account/projects/${id}/execution`}>Execution</Link>
          <Link href={`/account/projects/${id}/impact`}>Change impact</Link>
          <Link href={`/account/projects/${id}/outcomes`}>Outcomes</Link>
        </div>
      </section>
    </section>
  );
}

function evaluateProject(input: MatcherInput, ruleset: string) {
  try {
    getRuleset(ruleset);
    return evaluateMatcherSurface(input, ruleset);
  } catch {
    return null;
  }
}
