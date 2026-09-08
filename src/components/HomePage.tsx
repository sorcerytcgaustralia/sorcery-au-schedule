'use client';

import { useRef } from 'react';
import type { CityChoice } from '@/lib/events';
import type { SiteData } from '@/lib/sheet/types';
import { ArtPlate } from './ArtPlate';
import { Community } from './Community';
import { Decks } from './Decks';
import { Footer } from './Footer';
import { HallPreview } from './Hall';
import { Masthead } from './Masthead';
import { Notices } from './Notices';
import { SiteDataProvider } from './SiteDataProvider';
import { SiteNav } from './SiteNav';
import { Stores, type StoresHandle } from './Stores';
import { WeekBoard } from './WeekBoard';

export function HomePage({ snapshot, initialCity }: { snapshot: SiteData; initialCity: CityChoice }) {
  const stores = useRef<StoresHandle>(null);
  return (
    <SiteDataProvider snapshot={snapshot} initialCity={initialCity}>
      <SiteNav />
      <Masthead />
      <ArtPlate />
      <main>
        <WeekBoard onVenue={(venue) => stores.current?.showVenue(venue)} />
        <Notices />
        <Decks />
        <HallPreview />
        <Community />
        <Stores ref={stores} />
      </main>
      <Footer fetchedAt={snapshot.fetchedAt} />
    </SiteDataProvider>
  );
}
