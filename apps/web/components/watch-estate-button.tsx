'use client';

import { useState } from 'react';

export function WatchEstateButton({ slug }: { readonly slug: string }) {
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function watch() {
    setBusy(true);
    const response = await fetch('/api/account/watched-estates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ estateSlug: slug, vacancyAlerts: true }),
    });
    setBusy(false);
    setMessage(
      response.ok
        ? 'Estate watch saved.'
        : response.status === 401
          ? 'Sign in from Account to watch this estate.'
          : response.status === 404
            ? 'This estate is not in the public land catalog.'
            : 'Could not save this estate watch.',
    );
  }

  return (
    <span className="inline-action">
      <button disabled={busy} type="button" onClick={() => void watch()}>
        {busy ? 'Saving…' : 'Watch vacancy'}
      </button>
      {message === undefined ? null : <small role="status">{message}</small>}
    </span>
  );
}
