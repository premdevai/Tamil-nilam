import type { Metadata } from 'next';
import { Noto_Sans_Tamil } from 'next/font/google';
import type { ReactNode } from 'react';

import { SITE_URL } from '../lib/public-data';
import './quince.css';
import './palette.css';
import './base.css';
import './tailwind.css';

const tamil = Noto_Sans_Tamil({
  subsets: ['tamil'],
  weight: ['400', '700'],
  display: 'swap',
  preload: true,
  variable: '--font-noto-sans-tamil',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'NILAM — Verified Tamil Nadu land and schemes',
    template: '%s · NILAM',
  },
  description:
    'Cited Tamil Nadu industrial land, government scheme matching and bilingual application guidance.',
  applicationName: 'NILAM',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'NILAM',
    title: 'NILAM — Verified Tamil Nadu land and schemes',
    description:
      'Move from industrial land evidence to a cited, versioned scheme shortlist.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NILAM — Verified Tamil Nadu land and schemes',
    description:
      'Move from industrial land evidence to a cited, versioned scheme shortlist.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={tamil.variable}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
