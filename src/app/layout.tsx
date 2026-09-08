import type { Metadata, Viewport } from 'next';
import { Fraunces, IBM_Plex_Mono, Instrument_Sans } from 'next/font/google';
import { SITE_NAME, SITE_URL } from '@/lib/config';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz', 'SOFT', 'WONK'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

const DESCRIPTION =
  'The community almanac of Sorcery: Contested Realm in Australia. Weekly organised play in seven cities, tournaments and results, featured decks on Curiosa, local stores, and the Discord where it all happens.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} · Sorcery TCG Australia`, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} · Sorcery TCG Australia`,
    description: DESCRIPTION,
    url: '/',
    images: [{ url: '/art/og-community.jpg', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: `${SITE_NAME} · Sorcery TCG Australia`, description: DESCRIPTION, images: ['/art/og-community.jpg'] },
};

export const viewport: Viewport = { themeColor: '#100e0b', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
