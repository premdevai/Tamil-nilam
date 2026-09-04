import type { ReactNode } from 'react';

import '@nilam/ui/tokens.css';
import '../app/globals.css';
import { PublicShell } from './public-shell';

/**
 * Chrome + stylesheet for the routes the NILAM App design prototype does not
 * cover (deep scheme/estate pages, account, admin).
 *
 * `globals.css` is imported here rather than in the root layout on purpose: its
 * element-level rules (box-sizing, h1 letter-spacing, body line-height) would
 * otherwise leak into the ported design and shift it by a few pixels.
 */
export function LegacyChrome({ children }: { readonly children: ReactNode }) {
  return (
    <div className="legacy-ui">
      <PublicShell>{children}</PublicShell>
    </div>
  );
}
