'use client';

import { useState } from 'react';

export function ProWorkspacePanel() {
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [clientName, setClientName] = useState('');
  const [profileName, setProfileName] = useState('');
  const [csv, setCsv] = useState(
    'businessName,sector,district,projectCost\nKaveri Foods,food-processing,Thanjavur,1000000',
  );

  async function createClient() {
    setBusy(true);
    const response = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: clientName }),
    });
    setBusy(false);
    setMessage(
      response.ok
        ? 'Client workspace saved.'
        : 'Consultant entitlement is required for client workspaces.',
    );
  }

  async function saveProfile() {
    setBusy(true);
    const response = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: profileName,
        profile: {
          businessName: profileName,
          promoterName: profileName,
          sector: 'manufacturing',
          district: 'Coimbatore',
        },
      }),
    });
    setBusy(false);
    setMessage(
      response.ok
        ? 'Reusable business profile saved.'
        : 'A Pro or consultant entitlement is required for profiles.',
    );
  }

  async function runBulk() {
    setBusy(true);
    const response = await fetch('/api/bulk-runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        csv,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    setBusy(false);
    setMessage(
      response.ok
        ? 'Bulk stack run queued.'
        : 'Bulk import requires Pro and a valid CSV with businessName, sector, district and projectCost.',
    );
  }

  return (
    <section className="account-card">
      <h2>Consultant and Pro workspace</h2>
      <p>
        Client folders, reusable profiles and bulk Matcher runs stay on the
        server. Every action is authorization-checked and audit-logged.
      </p>
      <div className="account-form">
        <label>
          Client workspace name
          <input
            value={clientName}
            onChange={(event) => setClientName(event.currentTarget.value)}
          />
        </label>
        <button
          disabled={busy || clientName.length < 2}
          type="button"
          onClick={() => void createClient()}
        >
          Save client
        </button>
        <label>
          Business profile name
          <input
            value={profileName}
            onChange={(event) => setProfileName(event.currentTarget.value)}
          />
        </label>
        <button
          disabled={busy || profileName.length < 2}
          type="button"
          onClick={() => void saveProfile()}
        >
          Save profile
        </button>
        <label>
          Bulk stack CSV
          <textarea
            rows={6}
            value={csv}
            onChange={(event) => setCsv(event.currentTarget.value)}
          />
        </label>
        <button disabled={busy} type="button" onClick={() => void runBulk()}>
          Queue bulk run
        </button>
      </div>
      {message === undefined ? null : (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
