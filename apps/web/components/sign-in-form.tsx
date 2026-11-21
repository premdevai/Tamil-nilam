'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

export function SignInForm({ next = '/account' }: { readonly next?: string }) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) return;
    setBusy(true);
    setError(undefined);
    let result: Awaited<ReturnType<typeof signIn>> | undefined;
    try {
      result = await signIn('email', {
        email,
        callbackUrl: next,
        redirect: false,
      });
    } catch {
      // A server error returns an empty body and next-auth throws while
      // parsing it; without this the button stayed on "Sending…" forever.
      result = { error: 'server_error', ok: false, status: 500, url: null };
    }
    setBusy(false);
    // NextAuth returns `{ error: null }` on success. `!== undefined` treated
    // that as a send failure and never reached the verify page.
    if (result?.error) {
      setError('We could not send the sign-in link. Please try again.');
      return;
    }
    window.location.assign(
      `/account/verify?email=${encodeURIComponent(email.trim())}`,
    );
  }

  return (
    <form className="account-form" onSubmit={(event) => void submit(event)}>
      <label className="field">
        Email address
        <input
          autoComplete="email"
          inputMode="email"
          name="email"
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="consent-field">
        <input
          checked={consent}
          required
          type="checkbox"
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          I agree to NILAM storing my account, saved work and notification
          preferences. I can export or delete this data later.
        </span>
      </label>
      {error === undefined ? null : <p className="error-message">{error}</p>}
      <button disabled={busy || !consent} type="submit">
        {busy ? 'Sending…' : 'Email me a secure link'}
      </button>
    </form>
  );
}
