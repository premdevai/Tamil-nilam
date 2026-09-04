'use client';

import { signOut } from 'next-auth/react';
import { useState } from 'react';

type Preferences = {
  emailEnabled: boolean;
  telegramEnabled: boolean;
  deadlineReminders: boolean;
  goChangeAlerts: boolean;
  vacancyAlerts: boolean;
};

export function AccountSettings({
  initialPreferences,
  telegramLinked,
}: {
  readonly initialPreferences: Preferences;
  readonly telegramLinked: boolean;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function savePreferences() {
    setBusy(true);
    const response = await fetch('/api/account/preferences', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(preferences),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    setMessage(
      response.ok
        ? 'Delivery preferences saved.'
        : result.error === 'link_telegram_before_enabling'
          ? 'Link Telegram before enabling Telegram delivery.'
          : 'Could not save preferences.',
    );
  }

  async function linkTelegram() {
    setBusy(true);
    const response = await fetch('/api/account/telegram-link', {
      method: 'POST',
    });
    const result = (await response.json()) as { url?: string };
    setBusy(false);
    if (response.ok && result.url !== undefined) {
      window.location.assign(result.url);
    } else {
      setMessage('Could not create a Telegram link.');
    }
  }

  async function exportAccount() {
    setBusy(true);
    const response = await fetch('/api/account/export', { method: 'POST' });
    setBusy(false);
    if (!response.ok) {
      setMessage('Could not export account data.');
      return;
    }
    const blobUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = 'nilam-account.json';
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  }

  async function requestDeletion() {
    if (
      !window.confirm(
        'Queue permanent account deletion? Export your data first if needed.',
      )
    ) {
      return;
    }
    setBusy(true);
    const response = await fetch('/api/account/deletion', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE' }),
    });
    setBusy(false);
    setMessage(
      response.ok
        ? 'Deletion queued. You will be signed out now.'
        : 'Could not queue deletion.',
    );
    if (response.ok) {
      await signOut({ callbackUrl: '/' });
    }
  }

  const preferenceFields: readonly [keyof Preferences, string][] = [
    ['emailEnabled', 'Email delivery'],
    ['telegramEnabled', 'Telegram delivery'],
    ['deadlineReminders', 'Deadline reminders'],
    ['goChangeAlerts', 'G.O. change alerts'],
    ['vacancyAlerts', 'Estate vacancy alerts'],
  ];

  return (
    <div className="account-settings">
      <section className="account-card">
        <h2>Alert delivery</h2>
        <div className="preference-list">
          {preferenceFields.map(([key, label]) => (
            <label key={key}>
              <input
                checked={preferences[key]}
                type="checkbox"
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>
        <div className="button-row">
          <button
            disabled={busy}
            type="button"
            onClick={() => void savePreferences()}
          >
            Save preferences
          </button>
          <button
            className="button-secondary"
            disabled={busy}
            type="button"
            onClick={() => void linkTelegram()}
          >
            {telegramLinked ? 'Relink Telegram' : 'Link Telegram'}
          </button>
        </div>
      </section>

      <section className="account-card">
        <h2>Your data</h2>
        <p>
          Download your account data immediately, or queue permanent deletion.
        </p>
        <div className="button-row">
          <button
            disabled={busy}
            type="button"
            onClick={() => void exportAccount()}
          >
            Export JSON
          </button>
          <button
            className="button-danger"
            disabled={busy}
            type="button"
            onClick={() => void requestDeletion()}
          >
            Delete account
          </button>
          <button
            className="button-secondary"
            disabled={busy}
            type="button"
            onClick={() => void signOut({ callbackUrl: '/' })}
          >
            Sign out
          </button>
        </div>
      </section>
      {message === undefined ? null : (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
