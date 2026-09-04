'use client';

import { useState } from 'react';

import type {
  ProjectCompanion,
  ProjectReadinessInput,
  ProjectTask,
} from '../lib/project-companion';

export function ProjectDecisionForm({
  projectId,
  initial,
}: {
  readonly projectId: string;
  readonly initial?: ProjectCompanion['decision'];
}) {
  const [decision, setDecision] = useState(initial?.decision ?? 'pursue');
  const [reason, setReason] = useState(initial?.reason ?? '');
  const [message, setMessage] = useState<string>();
  return (
    <form
      className="account-form"
      onSubmit={(event) => {
        event.preventDefault();
        void fetch(`/api/account/projects/${projectId}/decision`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ decision, reason }),
        }).then((response) =>
          setMessage(response.ok ? 'Decision recorded.' : 'Could not save.'),
        );
      }}
    >
      <label>
        Decision
        <select
          value={decision}
          onChange={(event) =>
            setDecision(event.currentTarget.value as 'pursue' | 'skip')
          }
        >
          <option value="pursue">Pursue this project</option>
          <option value="skip">Skip for now</option>
        </select>
      </label>
      <label>
        Evidence-based reason
        <textarea
          required
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
        />
      </label>
      <button type="submit">Record decision</button>
      {message === undefined ? null : <p role="status">{message}</p>}
    </form>
  );
}

export function ReadinessForm({
  projectId,
  initial,
  assumptions,
}: {
  readonly projectId: string;
  readonly initial: ProjectReadinessInput;
  readonly assumptions: readonly { field: string; label: string }[];
}) {
  const [value, setValue] = useState(initial);
  const [message, setMessage] = useState<string>();
  const setFact = (key: string, next: string) =>
    setValue((current) => ({
      ...current,
      profileFacts: { ...current.profileFacts, [key]: next },
    }));
  return (
    <form
      className="account-form"
      onSubmit={(event) => {
        event.preventDefault();
        void fetch(`/api/account/projects/${projectId}/readiness`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(value),
        })
          .then(async (response) => ({
            ok: response.ok,
            body: (await response.json()) as { applicationReady?: boolean },
          }))
          .then(({ ok, body }) =>
            setMessage(
              ok
                ? body.applicationReady
                  ? 'Application-ready state verified.'
                  : 'Readiness saved; blockers remain.'
                : 'Could not save readiness.',
            ),
          );
      }}
    >
      <h2>Reusable project profile</h2>
      <label>
        Business name
        <input
          value={String(value.profileFacts.businessName ?? '')}
          onChange={(event) =>
            setFact('businessName', event.currentTarget.value)
          }
        />
      </label>
      <label>
        Promoter name
        <input
          value={String(value.profileFacts.promoterName ?? '')}
          onChange={(event) =>
            setFact('promoterName', event.currentTarget.value)
          }
        />
      </label>
      <h2>Assumptions</h2>
      {assumptions.length === 0 ? (
        <p>No unconfirmed matcher assumptions.</p>
      ) : (
        assumptions.map((assumption) => (
          <label key={assumption.field}>
            <input
              type="checkbox"
              checked={value.confirmedAssumptions.includes(assumption.field)}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  confirmedAssumptions: event.currentTarget.checked
                    ? [
                        ...new Set([
                          ...current.confirmedAssumptions,
                          assumption.field,
                        ]),
                      ]
                    : current.confirmedAssumptions.filter(
                        (field) => field !== assumption.field,
                      ),
                }))
              }
            />{' '}
            Confirm {assumption.label}
          </label>
        ))
      )}
      <h2>Document evidence</h2>
      {value.documents.map((document, index) => (
        <fieldset key={document.key}>
          <legend>{document.label}</legend>
          <label>
            Status
            <select
              value={document.status}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  documents: current.documents.map((item, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...item,
                          status: event.currentTarget.value as
                            'missing' | 'ready',
                        }
                      : item,
                  ),
                }))
              }
            >
              <option value="missing">Missing</option>
              <option value="ready">Ready</option>
            </select>
          </label>
          <label>
            Official evidence URL
            <input
              type="url"
              value={document.evidenceUrl ?? ''}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  documents: current.documents.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, evidenceUrl: event.currentTarget.value }
                      : item,
                  ),
                }))
              }
            />
          </label>
          <label>
            Expiry date (if any)
            <input
              type="date"
              value={document.expiresOn ?? ''}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  documents: current.documents.map((item, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...item,
                          expiresOn: event.currentTarget.value || null,
                        }
                      : item,
                  ),
                }))
              }
            />
          </label>
        </fieldset>
      ))}
      <label>
        Current blockers (one per line)
        <textarea
          value={value.blockers.join('\n')}
          onChange={(event) =>
            setValue((current) => ({
              ...current,
              blockers: event.currentTarget.value
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean),
            }))
          }
        />
      </label>
      <button type="submit">Verify readiness</button>
      {message === undefined ? null : <p role="status">{message}</p>}
    </form>
  );
}

export function ExecutionTracker({
  projectId,
  tasks,
  suggested,
}: {
  readonly projectId: string;
  readonly tasks: readonly ProjectTask[];
  readonly suggested?: {
    readonly title: string;
    readonly organisation: string;
    readonly officialUrl: string;
  };
}) {
  const [title, setTitle] = useState(suggested?.title ?? '');
  const [owner, setOwner] = useState('');
  const [reason, setReason] = useState(
    suggested === undefined
      ? ''
      : `First verified action with ${suggested.organisation}.`,
  );
  const [officialUrl, setOfficialUrl] = useState(suggested?.officialUrl ?? '');
  const [deadlineOn, setDeadlineOn] = useState('');
  const [followUpOn, setFollowUpOn] = useState('');
  return (
    <>
      <form
        className="account-form"
        onSubmit={(event) => {
          event.preventDefault();
          void fetch(`/api/account/projects/${projectId}/tasks`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              title,
              owner,
              reason,
              deadlineOn: deadlineOn || null,
              officialUrl,
              applicationId: '',
              followUpOn: followUpOn || null,
            }),
          }).then((response) => {
            if (response.ok) location.reload();
          });
        }}
      >
        <h2>Add verified action</h2>
        <label>
          Task
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
        </label>
        <label>
          Owner
          <input
            required
            value={owner}
            onChange={(event) => setOwner(event.currentTarget.value)}
          />
        </label>
        <label>
          Why this action
          <textarea
            required
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
          />
        </label>
        <label>
          Official destination
          <input
            required
            type="url"
            value={officialUrl}
            onChange={(event) => setOfficialUrl(event.currentTarget.value)}
          />
        </label>
        <label>
          Official deadline
          <input
            type="date"
            value={deadlineOn}
            onChange={(event) => setDeadlineOn(event.currentTarget.value)}
          />
        </label>
        <label>
          Follow-up date
          <input
            type="date"
            value={followUpOn}
            onChange={(event) => setFollowUpOn(event.currentTarget.value)}
          />
        </label>
        <button type="submit">Add action</button>
      </form>
      {tasks.map((task) => (
        <TaskProofForm key={task.id} projectId={projectId} task={task} />
      ))}
    </>
  );
}

function TaskProofForm({
  projectId,
  task,
}: {
  readonly projectId: string;
  readonly task: ProjectTask;
}) {
  const [proofUrl, setProofUrl] = useState(task.proofUrl);
  const [applicationId, setApplicationId] = useState(task.applicationId);
  const [query, setQuery] = useState('');
  const [queryEvidenceUrl, setQueryEvidenceUrl] = useState('');
  const [followUpOn, setFollowUpOn] = useState(task.followUpOn ?? '');
  return (
    <form
      className="account-form"
      onSubmit={(event) => {
        event.preventDefault();
        void fetch(`/api/account/projects/${projectId}/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            completed: true,
            proofUrl,
            applicationId,
            followUpOn: followUpOn || null,
            ...(query === ''
              ? {}
              : {
                  query: {
                    note: query,
                    evidenceUrl: queryEvidenceUrl,
                  },
                }),
          }),
        }).then((response) => {
          if (response.ok) location.reload();
        });
      }}
    >
      <h2>{task.title}</h2>
      <p>
        Owner: {task.owner} ·{' '}
        <a href={task.officialUrl} rel="noreferrer" target="_blank">
          official destination
        </a>
      </p>
      <p>{task.reason}</p>
      <p>
        Deadline: {task.deadlineOn ?? 'none'} · follow-up:{' '}
        {task.followUpOn ?? 'none'}
      </p>
      {task.queryLog.length === 0 ? null : (
        <ul className="history-list">
          {task.queryLog.map((entry) => (
            <li key={`${entry.at}-${entry.evidenceUrl}`}>
              <strong>{entry.note}</strong>
              <a href={entry.evidenceUrl}>Query evidence</a>
            </li>
          ))}
        </ul>
      )}
      <label>
        Completion proof URL
        <input
          required
          type="url"
          value={proofUrl}
          onChange={(event) => setProofUrl(event.currentTarget.value)}
        />
      </label>
      <label>
        Application ID
        <input
          value={applicationId}
          onChange={(event) => setApplicationId(event.currentTarget.value)}
        />
      </label>
      <label>
        Query / follow-up log note
        <textarea
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <label>
        Query evidence URL
        <input
          required={query !== ''}
          type="url"
          value={queryEvidenceUrl}
          onChange={(event) => setQueryEvidenceUrl(event.currentTarget.value)}
        />
      </label>
      <label>
        Next follow-up date
        <input
          type="date"
          value={followUpOn}
          onChange={(event) => setFollowUpOn(event.currentTarget.value)}
        />
      </label>
      <button type="submit">
        {task.completedAt === null ? 'Complete with proof' : 'Update evidence'}
      </button>
    </form>
  );
}

export function OutcomeRecorder({ projectId }: { readonly projectId: string }) {
  const [status, setStatus] = useState('submitted');
  const [reference, setReference] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  return (
    <form
      className="account-form"
      onSubmit={(event) => {
        event.preventDefault();
        void fetch(`/api/account/projects/${projectId}/outcomes`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            status,
            officialReference: reference,
            recordedOn: new Date().toISOString().slice(0, 10),
            evidenceUrl,
            note: '',
            rejectionReason,
          }),
        }).then((response) => {
          if (response.ok) location.reload();
        });
      }}
    >
      <label>
        Official status
        <select
          value={status}
          onChange={(event) => setStatus(event.currentTarget.value)}
        >
          <option value="submitted">Submitted</option>
          <option value="queried">Queried</option>
          <option value="sanctioned">Sanctioned</option>
          <option value="allotted">Allotted</option>
          <option value="claimed">Claimed</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      <label>
        Application / order reference
        <input
          required
          value={reference}
          onChange={(event) => setReference(event.currentTarget.value)}
        />
      </label>
      <label>
        Official evidence URL
        <input
          required
          type="url"
          value={evidenceUrl}
          onChange={(event) => setEvidenceUrl(event.currentTarget.value)}
        />
      </label>
      {status === 'rejected' ? (
        <label>
          Valid rejection reason
          <textarea
            required
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.currentTarget.value)}
          />
        </label>
      ) : null}
      <button type="submit">Record official status</button>
    </form>
  );
}
