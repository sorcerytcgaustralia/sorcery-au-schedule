import type { Metadata, Viewport } from 'next';
import { Marcellus_SC, Spectral } from 'next/font/google';
import { SITE_URL } from '@/lib/config';
import './globals.css';

const marcellus = Marcellus_SC({ subsets: ['latin'], weight: '400', variable: '--font-marcellus', display: 'swap' });
const spectral = Spectral({ subsets: ['latin'], weight: ['400', '600'], style: ['normal', 'italic'], variable: '--font-spectral', display: 'swap' });

const TITLE = 'Sorcery TCG Australia';
const DESCRIPTION =
  'The home of the Sorcery: Contested Realm community in Australia. Weekly organised play across seven cities, special events, tournament decks on Curiosa, and the Discord where it all happens.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${TITLE}, the community Down Under`, template: `%s, ${TITLE}` },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: TITLE,
    title: `${TITLE}, the community Down Under`,
    description: DESCRIPTION,
    url: '/',
    images: [{ url: '/art/og-community.jpg', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: `${TITLE}, the community Down Under`, description: DESCRIPTION, images: ['/art/og-community.jpg'] },
};

export const viewport: Viewport = { themeColor: '#0f0f10', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${marcellus.variable} ${spectral.variable}`}>
      <body>{children}</body>
    </html>
  );
}
