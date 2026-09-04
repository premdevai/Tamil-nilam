'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';

export function PlaybookProgress({
  slug,
  steps,
}: {
  readonly slug: string;
  readonly steps: readonly string[];
}) {
  const storageKey = `nilam:playbook:${slug}`;
  const stored = useSyncExternalStore(
    (notify) => {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === storageKey) notify();
      };
      window.addEventListener('storage', handleStorage);
      window.addEventListener('nilam-playbook-change', notify);
      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('nilam-playbook-change', notify);
      };
    },
    () => window.localStorage.getItem(storageKey) ?? '[]',
    () => '[]',
  );
  const complete = useMemo<readonly number[]>(() => {
    try {
      const parsed = JSON.parse(stored) as unknown;
      return Array.isArray(parsed) &&
        parsed.every((value) => Number.isInteger(value))
        ? (parsed as number[])
        : [];
    } catch {
      return [];
    }
  }, [stored]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/account/playbooks/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (!response.ok) return undefined;
        return (await response.json()) as { completed: number[] };
      })
      .then((remote) => {
        if (!active || remote === undefined) return;
        const local = JSON.parse(
          window.localStorage.getItem(storageKey) ?? '[]',
        ) as number[];
        const merged = [...new Set([...local, ...remote.completed])].sort(
          (left, right) => left - right,
        );
        window.localStorage.setItem(storageKey, JSON.stringify(merged));
        window.dispatchEvent(new Event('nilam-playbook-change'));
        return fetch(`/api/account/playbooks/${encodeURIComponent(slug)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ completed: merged }),
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [slug, storageKey]);

  function toggle(index: number): void {
    const next = complete.includes(index)
      ? complete.filter((value) => value !== index)
      : [...complete, index].sort((a, b) => a - b);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(new Event('nilam-playbook-change'));
    void fetch(`/api/account/playbooks/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ completed: next }),
    });
  }

  return (
    <section className="playbook-progress" aria-labelledby="progress-heading">
      <div className="section-heading">
        <p className="eyebrow">
          {complete.length}/{steps.length} complete
        </p>
        <h2 id="progress-heading">Your playbook progress</h2>
        <p>
          Stored in this browser and automatically merged with your account
          after sign-in.
        </p>
      </div>
      <ol>
        {steps.map((step, index) => (
          <li key={step}>
            <label>
              <input
                checked={complete.includes(index)}
                type="checkbox"
                onChange={() => toggle(index)}
              />
              <span>{step}</span>
            </label>
          </li>
        ))}
      </ol>
    </section>
  );
}
