import type { ReactNode } from 'react';

import { LegacyChrome } from '../../../components/legacy-chrome';

export default function LegacyPublicLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <LegacyChrome>{children}</LegacyChrome>;
}
