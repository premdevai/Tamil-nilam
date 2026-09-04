import {
  AdminAction,
  ReviewActions,
  RoleControl,
} from '../../components/admin-actions';
import { BilingualHeading } from '../../components/public-shell';
import { can, requireCapability } from '../../lib/authz';
import { getOperationsSnapshot, getRoleDirectory } from '../../lib/operations';

export const dynamic = 'force-dynamic';

export default async function OperationsPage() {
  const session = await requireCapability('operations:read');
  const canPublish = can(session.user.role, 'publish:write');
  const canManageRoles = can(session.user.role, 'roles:write');
  const [snapshot, roleDirectory] = await Promise.all([
    getOperationsSnapshot(),
    canManageRoles ? getRoleDirectory() : Promise.resolve([]),
  ]);

  return (
    <section className="content-page operations-page">
      <BilingualHeading
        eyebrow={`Protected operations · ${session.user.role}`}
        title="Evidence operations"
        titleTa="ஆதார செயல்பாடுகள்"
      >
        <p className="lede">
          Review source freshness, proposed publications, user impact and
          corrective versions. Every mutation is authorized and audited on the
          server.
        </p>
      </BilingualHeading>

      <OperationSection title="Source health">
        <ul className="operations-list">
          {snapshot.sourceHealth.map((source) => (
            <li key={source.agency}>
              <strong>{source.agency}</strong>
              <span>{source.documentCount} documents</span>
              <span>
                {source.lastRetrievedAt === null
                  ? 'Never retrieved'
                  : `Last retrieved ${source.lastRetrievedAt.toLocaleString('en-IN')}`}
              </span>
            </li>
          ))}
        </ul>
      </OperationSection>

      <OperationSection title="Stale rules">
        <ul className="operations-list">
          {snapshot.staleRules.map((rule) => (
            <li key={rule.id}>
              <strong>{rule.scheme}</strong>
              <span>v{rule.version}</span>
              <span>Verified {rule.verifiedOn}</span>
            </li>
          ))}
        </ul>
      </OperationSection>

      <OperationSection title="Review queue">
        <ul className="operations-list">
          {snapshot.reviewQueue.map((review) => (
            <li key={review.id}>
              <strong>
                {review.entityType} · {review.entityKey}
              </strong>
              <span>{review.status}</span>
              <details>
                <summary>Field-level diff</summary>
                <pre>{JSON.stringify(review.fieldDiff, null, 2)}</pre>
              </details>
              <ReviewActions reviewId={review.id} />
            </li>
          ))}
        </ul>
      </OperationSection>

      <OperationSection title="Publish previews">
        <ul className="operations-list">
          {snapshot.publishPreviews.map((preview) => (
            <li key={preview.id}>
              <strong>
                {preview.entityType} · {preview.entityKey}
              </strong>
              <details>
                <summary>Exact version payload</summary>
                <pre>{JSON.stringify(preview.proposedData, null, 2)}</pre>
              </details>
              {canPublish ? (
                <AdminAction
                  endpoint={`/api/admin/publish/${preview.id}`}
                  label="Publish append-only version"
                />
              ) : (
                <small>Admin publication required</small>
              )}
            </li>
          ))}
        </ul>
      </OperationSection>

      <OperationSection title="Ruleset diffs">
        <ul className="operations-list">
          {snapshot.rulesetDiffs.map((diff) => (
            <li key={`${diff.scheme}-${diff.toVersion}`}>
              <strong>{diff.scheme}</strong>
              <span>
                v{diff.fromVersion} → v{diff.toVersion}
              </span>
              <p>{diff.changelog}</p>
            </li>
          ))}
        </ul>
      </OperationSection>

      <OperationSection title="Failed jobs">
        <ul className="operations-list">
          {snapshot.failedJobs.map((job) => (
            <li key={job.id}>
              <strong>{job.task}</strong>
              <span>{job.attempts} attempts</span>
              <span>{job.error ?? 'No error detail'}</span>
              {canPublish ? (
                <AdminAction
                  endpoint={`/api/admin/jobs/${job.id}/retry`}
                  label="Retry safely"
                />
              ) : null}
            </li>
          ))}
        </ul>
      </OperationSection>

      <OperationSection title="User-impact previews">
        <ul className="operations-list">
          {snapshot.impactPreviews.map((impact) => (
            <li key={impact.id}>
              <strong>{impact.kind}</strong>
              <span>
                {impact.entityType} · {impact.entityId}
              </span>
              <span>{impact.recipientCount} delivery records</span>
            </li>
          ))}
        </ul>
      </OperationSection>

      <OperationSection title="Corrective-version workflow">
        <p>
          Corrections never mutate old publications. Reviewers submit a
          replacement payload through the corrective-version API; admins publish
          it as the next version.
        </p>
        <ul className="operations-list">
          {snapshot.correctiveVersions.map((correction) => (
            <li key={correction.id}>
              <strong>{correction.entityKey}</strong>
              <span>
                Corrects v{correction.originalVersion} · {correction.status}
              </span>
              <p>{correction.reason}</p>
              {canPublish && correction.status === 'pending' ? (
                <AdminAction
                  endpoint={`/api/admin/corrective-versions/${correction.id}/publish`}
                  label="Publish corrective version"
                />
              ) : null}
            </li>
          ))}
        </ul>
      </OperationSection>

      {canManageRoles ? (
        <OperationSection title="Account roles">
          <ul className="operations-list">
            {roleDirectory.map((user) => (
              <li key={user.id}>
                <strong>{user.name ?? user.email ?? user.id}</strong>
                <span>{user.email}</span>
                <RoleControl userId={user.id} initialRole={user.role} />
              </li>
            ))}
          </ul>
        </OperationSection>
      ) : null}
    </section>
  );
}

function OperationSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="operation-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
