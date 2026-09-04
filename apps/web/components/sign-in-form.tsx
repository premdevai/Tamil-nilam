'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) return;
    setBusy(true);
    setError(undefined);
    const result = await signIn('email', {
      email,
      callbackUrl: '/account',
      redirect: false,
    });
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
