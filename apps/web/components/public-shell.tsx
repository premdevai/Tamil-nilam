import { BrandMark } from '@nilam/ui';
import { CURRENT_RULESET, getInventoryCoverage } from '@nilam/engine';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { STATUS_COPY } from '../lib/public-data';
import { LanguageControl } from './language-control';

export function PublicShell({ children }: { readonly children: ReactNode }) {
  const inventory = getInventoryCoverage(CURRENT_RULESET);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="site-header-wrap">
        <header className="site-header">
          <Link className="brand-link" href="/" aria-label="NILAM home">
            <BrandMark />
          </Link>
          <nav aria-label="Primary navigation">
            <Link className="nav-current" href="/">
              NILAM
            </Link>
            <Link href="/account">Saved</Link>
          </nav>
          <span className="source-promise">
            {inventory.published}/{inventory.total} calculating ·{' '}
            {inventory.pendingReview} pending
          </span>
          <LanguageControl />
        </header>
      </div>
      <main id="main-content" className="site-main">
        {children}
      </main>
      <div className="site-footer-wrap">
        <footer className="site-footer">
          <p>
            NILAM <span lang="ta">நிலம்</span>
          </p>
          <p>
            Directional guidance, not a sanction or legal opinion. Always
            confirm with the cited authority.
          </p>
        </footer>
      </div>
    </>
  );
}

export function BilingualHeading({
  eyebrow,
  title,
  titleTa,
  children,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly titleTa: string;
  readonly children?: ReactNode;
}) {
  return (
    <header className="page-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="tamil-title" lang="ta">
        {titleTa}
      </p>
      {children}
    </header>
  );
}

export function StatusBadge({
  status,
}: {
  readonly status: keyof typeof STATUS_COPY;
}) {
  const copy = STATUS_COPY[status];
  return (
    <span className={`status-badge status-${status}`} title={copy.explanation}>
      {copy.label}
    </span>
  );
}

export function JsonLd({
  value,
}: {
  readonly value: Readonly<Record<string, unknown>>;
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(value).replaceAll('<', '\\u003c'),
      }}
    />
  );
}
