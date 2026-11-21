import type { ReactNode } from 'react';

import { LegacyChrome } from '../../components/legacy-chrome';

export default function NeedsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <LegacyChrome>{children}</LegacyChrome>;
}
