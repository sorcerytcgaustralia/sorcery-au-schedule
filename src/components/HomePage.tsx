'use client';

import { useRef } from 'react';
import type { SiteData } from '@/lib/sheet/types';
import { Dispatches } from './Dispatches';
import { Footer } from './Footer';
import { Masthead } from './Masthead';
import { Schedule } from './Schedule';
import { SiteDataProvider } from './SiteDataProvider';
import { SiteNav } from './SiteNav';
import { Stores, type StoresHandle } from './Stores';

export function HomePage({ snapshot }: { snapshot: SiteData }) {
  const stores = useRef<StoresHandle>(null);
  return (
    <SiteDataProvider snapshot={snapshot}>
      <SiteNav />
      <Masthead />
      <main>
        <Schedule onVenue={(venue) => stores.current?.showVenue(venue)} />
        <Dispatches />
        <Stores ref={stores} />
      </main>
      <Footer />
    </SiteDataProvider>
  );
}
