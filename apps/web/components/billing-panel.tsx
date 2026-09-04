'use client';

import Link from 'next/link';
import { useState } from 'react';

const plans = [
  [
    'dpr_once',
    'One DPR',
    'Directional detailed project report, not a bank-ready sanction.',
  ],
  [
    'pro',
    'Pro monthly',
    'Printable reports, unlimited saves, bulk runs and reusable profiles.',
  ],
  [
    'consultant',
    'Consultant monthly',
    'Client workspaces plus the Pro toolkit.',
  ],
] as const;

export function BillingPanel() {
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function buy(plan: (typeof plans)[number][0]) {
    setBusy(true);
    const checkout = await fetch('/api/payments/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        plan,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const result = (await checkout.json()) as {
      paymentId?: string;
      testMode?: boolean;
      error?: string;
      message?: string;
    };
    if (!checkout.ok || result.paymentId === undefined) {
      setBusy(false);
      setMessage(result.message ?? result.error ?? 'Checkout is unavailable.');
      return;
    }
    if (result.testMode === true) {
      const completed = await fetch('/api/payments/fake-complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentId: result.paymentId }),
      });
      setBusy(false);
      setMessage(
        completed.ok
          ? 'Test payment captured. Entitlements are active.'
          : 'Test payment could not be completed.',
      );
      return;
    }
    setBusy(false);
    setMessage(
      'Razorpay order created. Complete checkout in the approved live environment.',
    );
  }

  async function exportAudit() {
    setBusy(true);
    const response = await fetch('/api/audit/export', { method: 'POST' });
    setBusy(false);
    if (!response.ok) {
      setMessage(
        'Audit export requires an active Pro or consultant entitlement.',
      );
      return;
    }
    const blobUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = 'nilam-audit.json';
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  }

  return (
    <section className="account-card">
      <h2>Paid plans</h2>
      <p>
        NILAM never claims legal, tax, investment or bank approval. Paid
        documents remain directional planning support with cited annexures.
      </p>
      <div className="plan-grid">
        {plans.map(([plan, label, copy]) => (
          <article key={plan}>
            <h3>{label}</h3>
            <p>{copy}</p>
            <button
              disabled={busy}
              type="button"
              onClick={() => void buy(plan)}
            >
              Continue
            </button>
          </article>
        ))}
      </div>
      <div className="button-row">
        <Link className="button-secondary" href="/account/dpr">
          Guided DPR
        </Link>
        <Link className="button-secondary" href="/account/workspace">
          Pro workspace
        </Link>
        <button
          className="button-secondary"
          disabled={busy}
          type="button"
          onClick={() => void exportAudit()}
        >
          Audit export
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
