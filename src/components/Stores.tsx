'use client';

// Store explorer: master-detail synced to the city. Primary source is the
// Stores sheet tab (name, address, website, lat/lng), rendered as an
// interactive map. With a working map there is no list at all: the pins
// are focusable and their popups carry the address, website and weekly
// play. The list only appears if the map can't run.

import dynamic from 'next/dynamic';
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { CITIES } from '@/lib/config';
import { ALL, findStoreForVenue } from '@/lib/events';
import { DAY_KEYS, DAY_NAMES, type Store } from '@/lib/sheet/types';
import { CityTabs } from './CityTabs';
import { useSiteData } from './SiteDataProvider';

const StoreMap = dynamic(() => import('./StoreMap').then((m) => m.StoreMap), { ssr: false });

const FREQ_LABELS: Record<string, string> = { fortnightly: 'Fortnightly', monthly: 'Monthly', irregular: 'Check dates' };

export interface StoresHandle {
  showVenue: (venue: string) => void;
}

export const Stores = forwardRef<StoresHandle>(function Stores(_, ref) {
  const { data, storeCity, cityPicked, setStoreCity } = useSiteData();
  const [focus, setFocus] = useState<Store | null>(null);
  const [focusSeq, setFocusSeq] = useState(0);

  // weekly events hosted at this store, for the map popup
  const weeklyLines = useCallback(
    (store: Store): string[] => {
      const lines: string[] = [];
      const n = store.name.trim().toLowerCase();
      const cities = store.city && data.cities[store.city] ? [store.city] : CITIES;
      for (const c of cities) {
        const cd = data.cities[c];
        if (!cd || cd.error) continue;
        for (const day of DAY_KEYS) {
          for (const ev of cd.events[day] || []) {
            const v = ev.venue.trim().toLowerCase();
            if (!v || !(v.includes(n) || n.includes(v))) continue;
            lines.push(`${DAY_NAMES[day].slice(0, 3)}: ${ev.type}${ev.time ? ', ' + ev.time : ''}${ev.freq !== 'weekly' ? ` (${FREQ_LABELS[ev.freq]})` : ''}`);
          }
        }
      }
      return lines;
    },
    [data],
  );

  const focusStore = useCallback((s: Store) => {
    setFocus(s);
    setFocusSeq((n) => n + 1);
    document.getElementById('stores')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useImperativeHandle(ref, () => ({
    showVenue: (venue: string) => {
      const s = findStoreForVenue(data.stores, venue);
      if (s) focusStore(s);
    },
  }));

  const items = storeCity === ALL ? data.stores : data.stores.filter((s) => s.city === storeCity);
  const unreadable = data.failed.includes('stores') && data.stores.length === 0;
  const groups = storeCity === ALL ? CITIES.map((c) => [c, items.filter((s) => s.city === c)] as const).filter(([, list]) => list.length) : [[storeCity, items] as const];

  return (
    <section id="stores" className="stores" aria-label="Find a local store">
      <div className="stores-inner">
        <h2>Find a Local Store</h2>
        <CityTabs current={storeCity} onPick={setStoreCity} label="City for stores" />
        <StoreMap stores={data.stores} city={storeCity} cityPicked={cityPicked} weeklyLines={weeklyLines} focus={focus} focusSeq={focusSeq} onLive={() => undefined} />
        <div className="store-list">
          {unreadable ? (
            <p className="store-note">Couldn&rsquo;t load the stores right now. Check the Discord.</p>
          ) : items.length === 0 ? (
            <p className="store-note">No stores listed for {storeCity === ALL ? 'any city' : storeCity} yet.</p>
          ) : (
            groups.map(([city, list]) => (
              <div key={city} className="store-group">
                {storeCity === ALL && <h3 className="store-group-name">{city}</h3>}
                <ul className="store-items">
                  {list.map((s) => {
                    const week = weeklyLines(s);
                    return (
                      <li className="store-item" key={s.name + s.city}>
                        <button type="button" className="store-name-plain" onClick={() => focusStore(s)} disabled={s.lat == null} title={s.lat == null ? 'No map position in the sheet yet' : 'Show on the map'}>
                          {s.name}
                        </button>
                        {s.address && <div className="store-addr">{s.address}</div>}
                        {week.length > 0 && (
                          <div className="store-week">
                            {week.map((l, i) => (
                              <span key={i}>{l}</span>
                            ))}
                          </div>
                        )}
                        {s.link && (
                          <a className="store-site" href={s.link} target="_blank" rel="noopener">
                            Website
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
});
