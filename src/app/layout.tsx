import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, Marcellus_SC, Spectral } from 'next/font/google';
import { SITE_URL } from '@/lib/config';
import './globals.css';

const marcellus = Marcellus_SC({ subsets: ['latin'], weight: '400', variable: '--font-marcellus', display: 'swap' });
const spectral = Spectral({ subsets: ['latin'], weight: ['400', '600'], style: ['normal', 'italic'], variable: '--font-spectral', display: 'swap' });
const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex', display: 'swap' });

const TITLE = 'Sorcery TCG Australia';
const DESCRIPTION =
  'Where Sorcery: Contested Realm happens in Australia. This week’s tables in seven cities, coming tournaments, the record of champions, the decks in the meta, and the stores that host it all.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${TITLE}, where Sorcery happens in Australia`, template: `%s, ${TITLE}` },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: TITLE, title: `${TITLE}, where Sorcery happens in Australia`, description: DESCRIPTION, url: '/', images: [{ url: '/art/og-community.jpg', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: `${TITLE}, where Sorcery happens in Australia`, description: DESCRIPTION, images: ['/art/og-community.jpg'] },
};

export const viewport: Viewport = { themeColor: '#0f0f10', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${marcellus.variable} ${spectral.variable} ${plex.variable}`}>
      <body>{children}</body>
    </html>
  );
}
