'use client';

import { useRef } from 'react';
import type { SiteData } from '@/lib/sheet/types';
import { Footer } from './Footer';
import { Meta } from './Meta';
import { Places, type PlacesHandle } from './Places';
import { Plate } from './Plate';
import { Realm } from './Realm';
import { RecordPreview } from './Record';
import { Register } from './Register';
import { SiteDataProvider } from './SiteDataProvider';
import { SiteNav } from './SiteNav';

export function HomePage({ snapshot }: { snapshot: SiteData }) {
  const places = useRef<PlacesHandle>(null);
  return (
    <SiteDataProvider snapshot={snapshot}>
      <SiteNav />
      <Realm />
      <main>
        <Register onVenue={(venue) => places.current?.showVenue(venue)} />
        <Plate />
        <Meta />
        <RecordPreview />
        <Places ref={places} />
      </main>
      <Footer />
    </SiteDataProvider>
  );
}
