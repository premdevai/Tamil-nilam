'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdminAction({
  endpoint,
  label,
  method = 'POST',
  body,
}: {
  readonly endpoint: string;
  readonly label: string;
  readonly method?: 'POST' | 'PATCH';
  readonly body?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function run() {
    setBusy(true);
    setError(undefined);
    const response = await fetch(
      endpoint,
      body === undefined
        ? { method }
        : {
            method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          },
    );
    setBusy(false);
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(result.error ?? 'operation_failed');
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-action">
      <button disabled={busy} type="button" onClick={() => void run()}>
        {busy ? 'Working…' : label}
      </button>
      {error === undefined ? null : <small>{error}</small>}
    </span>
  );
}

export function ReviewActions({ reviewId }: { readonly reviewId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function review(status: 'approved' | 'rejected' | 'needs_changes') {
    const note = window.prompt('Required review note');
    if (note === null || note.trim() === '') return;
    setBusy(true);
    const response = await fetch(`/api/admin/reviews/${reviewId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, note }),
    });
    setBusy(false);
    if (response.ok) router.refresh();
  }

  return (
    <span className="button-row">
      <button
        disabled={busy}
        type="button"
        onClick={() => void review('approved')}
      >
        Approve
      </button>
      <button
        className="button-secondary"
        disabled={busy}
        type="button"
        onClick={() => void review('needs_changes')}
      >
        Needs changes
      </button>
      <button
        className="button-danger"
        disabled={busy}
        type="button"
        onClick={() => void review('rejected')}
      >
        Reject
      </button>
    </span>
  );
}

export function RoleControl({
  userId,
  initialRole,
}: {
  readonly userId: string;
  readonly initialRole: 'user' | 'consultant' | 'reviewer' | 'admin';
}) {
  const router = useRouter();
  const [role, setRole] = useState(initialRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    setBusy(true);
    setError(undefined);
    const response = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    setBusy(false);
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? 'role_update_failed');
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-action">
      <select
        aria-label="Account role"
        disabled={busy}
        value={role}
        onChange={(event) => setRole(event.target.value as typeof initialRole)}
      >
        <option value="user">User</option>
        <option value="consultant">Consultant</option>
        <option value="reviewer">Reviewer</option>
        <option value="admin">Admin</option>
      </select>
      <button
        disabled={busy || role === initialRole}
        type="button"
        onClick={() => void save()}
      >
        Save role
      </button>
      {error === undefined ? null : <small>{error}</small>}
    </span>
  );
}
