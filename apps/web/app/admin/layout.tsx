import type { ReactNode } from 'react';

import { LegacyChrome } from '../../components/legacy-chrome';

export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <LegacyChrome>{children}</LegacyChrome>;
}
