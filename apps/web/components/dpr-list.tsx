'use client';

import { useCallback, useEffect, useState } from 'react';

type DprRow = {
  readonly id: string;
  readonly status: 'queued' | 'generating' | 'ready' | 'failed' | string;
  readonly documentVersion: number;
  readonly businessName: string | null;
  readonly district: string | null;
  readonly projectCost: string | number | null;
  readonly validationWarnings: readonly string[] | null;
  readonly expiresAt: string | null;
  readonly error: string | null;
  readonly createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  generating: 'Generating…',
  ready: 'Ready',
  failed: 'Failed',
};

export function DprList({
  userEmail,
}: {
  readonly userEmail?: string | undefined;
}) {
  const [rows, setRows] = useState<readonly DprRow[] | null>(null);
  const [openEmail, setOpenEmail] = useState<string | null>(null);

  const load = useCallback(() => {
    void fetchRows().then((next) => {
      if (next !== null) setRows(next);
    });
  }, []);

  useEffect(() => {
    let active = true;
    void fetchRows().then((next) => {
      if (active && next !== null) setRows(next);
    });
    window.addEventListener('nilam:dpr-queued', load);
    return () => {
      active = false;
      window.removeEventListener('nilam:dpr-queued', load);
    };
  }, [load]);

  const pending = rows?.some(
    (row) => row.status === 'queued' || row.status === 'generating',
  );
  useEffect(() => {
    if (pending !== true) return;
    const timer = window.setInterval(load, 2_500);
    return () => window.clearInterval(timer);
  }, [pending, load]);

  async function retry(id: string) {
    await fetch(`/api/dprs/${id}/retry`, { method: 'POST' });
    load();
  }

  return (
    <section className="account-card dpr-list" aria-labelledby="dpr-list-title">
      <h2 id="dpr-list-title">Your reports</h2>
      {rows === null ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p>No reports yet. Generate one above and it will appear here.</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              <div className="dpr-row">
                <div>
                  <strong>
                    {row.businessName ?? 'Detailed project report'}
                  </strong>
                  <small>
                    {[
                      row.district,
                      row.projectCost === null
                        ? null
                        : inrShort(Number(row.projectCost)),
                      new Date(row.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </div>
                <span className={`dpr-status dpr-status-${row.status}`}>
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>
              </div>
              {row.status === 'ready' ? (
                <div className="button-row">
                  <a
                    className="button-link"
                    href={`/api/dprs/${row.id}/download?format=pdf`}
                  >
                    Download PDF
                  </a>
                  <a
                    className="button-secondary"
                    href={`/api/dprs/${row.id}/download?format=docx`}
                  >
                    Download Word
                  </a>
                  <button
                    className="button-secondary"
                    type="button"
                    aria-expanded={openEmail === row.id}
                    onClick={() =>
                      setOpenEmail((current) =>
                        current === row.id ? null : row.id,
                      )
                    }
                  >
                    Email report
                  </button>
                </div>
              ) : null}
              {row.status === 'failed' ? (
                <div className="button-row">
                  <small>{row.error ?? 'Generation failed.'}</small>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => void retry(row.id)}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
              {openEmail === row.id ? (
                <EmailForm
                  dprId={row.id}
                  userEmail={userEmail}
                  onDone={() => setOpenEmail(null)}
                />
              ) : null}
              {row.status === 'ready' &&
              (row.validationWarnings?.length ?? 0) > 0 ? (
                <details>
                  <summary>
                    {row.validationWarnings?.length} note(s) to review
                  </summary>
                  <ul>
                    {row.validationWarnings?.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function inrShort(rupees: number): string {
  const options = { maximumFractionDigits: 2 };
  return rupees >= 10_000_000
    ? `₹${(rupees / 10_000_000).toLocaleString('en-IN', options)} crore`
    : `₹${(rupees / 100_000).toLocaleString('en-IN', options)} lakh`;
}

async function fetchRows(): Promise<DprRow[] | null> {
  const response = await fetch('/api/dprs', { cache: 'no-store' });
  if (!response.ok) return null;
  const result = (await response.json()) as { dprs: DprRow[] };
  return result.dprs;
}

function EmailForm({
  dprId,
  userEmail,
  onDone,
}: {
  readonly dprId: string;
  readonly userEmail?: string | undefined;
  readonly onDone: () => void;
}) {
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [copyMe, setCopyMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipients = to
      .split(/[\s,;]+/u)
      .map((address) => address.trim())
      .filter((address) => address.length > 0);
    if (recipients.length === 0) {
      setStatus({ ok: false, text: 'Add at least one email address.' });
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/dprs/${dprId}/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to: recipients, note, copyMe }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      to?: string[];
      cc?: string[];
      transport?: string;
      limitPerDay?: number;
    };
    setBusy(false);
    if (response.ok) {
      setStatus({
        ok: true,
        text: `Sent to ${(result.to ?? []).join(', ')}${result.cc?.length ? `, with a copy to you` : ''}.${result.transport === 'local-outbox' ? ' (Local mode: saved to .data/outbox instead of sending.)' : ''}`,
      });
      return;
    }
    setStatus({
      ok: false,
      text:
        result.error === 'invalid_email_request'
          ? 'Check the email addresses (up to 5).'
          : result.error === 'email_limit_reached'
            ? `You can email up to ${result.limitPerDay ?? 10} reports a day.`
            : result.error === 'download_expired'
              ? 'This report has expired. Generate a fresh one to send it.'
              : 'The email could not be sent. Try again shortly.',
    });
  }

  return (
    <form
      className="account-form dpr-email"
      onSubmit={(event) => void send(event)}
    >
      <label>
        Send to
        <input
          autoComplete="off"
          inputMode="email"
          placeholder="branch.manager@bank.in, gm.dic@tn.gov.in"
          required
          value={to}
          onChange={(event) => setTo(event.currentTarget.value)}
        />
        <small>
          Up to 5 addresses, separated by commas. PDF and Word are attached.
        </small>
      </label>
      <label>
        Message (optional)
        <textarea
          rows={3}
          value={note}
          placeholder="Dear Sir/Madam, please find my DPR for NEEDS loan consideration…"
          onChange={(event) => setNote(event.currentTarget.value)}
        />
      </label>
      {userEmail === undefined ? null : (
        <label className="consent-field">
          <input
            checked={copyMe}
            type="checkbox"
            onChange={(event) => setCopyMe(event.currentTarget.checked)}
          />
          <span>Send me a copy at {userEmail}; replies come to me.</span>
        </label>
      )}
      <div className="button-row">
        <button disabled={busy} type="submit">
          {busy ? 'Sending…' : 'Send email'}
        </button>
        <button className="button-secondary" type="button" onClick={onDone}>
          Close
        </button>
      </div>
      {status === undefined ? null : (
        <p className={status.ok ? 'notice' : 'error-message'} role="status">
          {status.text}
        </p>
      )}
    </form>
  );
}
