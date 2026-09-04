'use client';

import { useEffect, useState } from 'react';

/**
 * True on phone-width viewports.
 *
 * The Land Explorer cannot be made responsive with CSS alone: on a phone the
 * list and the plan become separate screens rather than columns, which is a
 * different component tree, not a different grid. Hence matchMedia.
 *
 * Starts false so the server and the first client paint agree; the effect
 * corrects it before anything interactive happens.
 */
export function useNarrow(query = '(max-width: 899px)'): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mql = globalThis.matchMedia(query);
    const sync = () => setNarrow(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, [query]);

  return narrow;
}
