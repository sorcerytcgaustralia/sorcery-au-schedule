'use client';

// Places: the chart's cities as a list, each with the stores that host
// tables, and the map as a plate beside them.

import dynamic from 'next/dynamic';
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { CITIES, type City } from '@/lib/config';
import { coordLabel } from '@/lib/chart';
import { ALL, findStoreForVenue } from '@/lib/events';
import { DAY_KEYS, DAY_NAMES, type Store } from '@/lib/sheet/types';
import { useSiteData } from './SiteDataProvider';

const StoreMap = dynamic(() => import('./StoreMap').then((m) => m.StoreMap), { ssr: false });
const FREQ: Record<string, string> = { fortnightly: 'fortnightly', monthly: 'monthly', irregular: 'check dates' };

export interface PlacesHandle {
  showVenue: (venue: string) => void;
}

export const Places = forwardRef<PlacesHandle>(function Places(_, ref) {
  const { data, activeCity, cityPicked, setCity } = useSiteData();
  const [focus, setFocus] = useState<Store | null>(null);
  const [focusSeq, setFocusSeq] = useState(0);

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
            lines.push(`${DAY_NAMES[day]}: ${ev.type}${ev.time ? ', ' + ev.time : ''}${ev.freq !== 'weekly' ? ` (${FREQ[ev.freq]})` : ''}`);
          }
        }
      }
      return lines;
    },
    [data],
  );

  const focusStore = useCallback((s: Store) => {
    setFocus(s);
    setFocusSeq((k) => k + 1);
    document.getElementById('places')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useImperativeHandle(ref, () => ({
    showVenue: (venue: string) => {
      const s = findStoreForVenue(data.stores, venue);
      if (s) focusStore(s);
    },
  }));

  const cities: City[] = activeCity === ALL ? [...CITIES] : [activeCity];
  const unreadable = data.failed.includes('stores') && data.stores.length === 0;

  return (
    <section className="places" id="places" aria-labelledby="places-title">
      <div className="places-inner">
        <div className="places-head">
          <h2 className="h2" id="places-title">
            Places
          </h2>
          <p className="head-note">
            {data.stores.length} {data.stores.length === 1 ? 'store hosts' : 'stores host'} tables across the realm.
            {activeCity !== ALL && (
              <>
                {' '}
                <button type="button" className="quiet-link" onClick={() => setCity(ALL)}>
                  Show every city
                </button>
              </>
            )}
          </p>
        </div>
        <div className="places-grid">
          <div className="place-list">
            {unreadable && <p className="spine-empty">The store list could not be read just now.</p>}
            {cities.map((c) => {
              const stores = data.stores.filter((s) => s.city === c);
              return (
                <div key={c} className="place">
                  <h3 className="place-name">
                    <button type="button" onClick={() => setCity(activeCity === c ? ALL : c)} aria-pressed={activeCity === c}>
                      {c}
                    </button>
                    <span className="place-coord">{coordLabel(c)}</span>
                  </h3>
                  {stores.length === 0 ? (
                    <p className="place-none">No store listed yet.</p>
                  ) : (
                    <ul className="stores">
                      {stores.map((s) => {
                        const week = weeklyLines(s);
                        return (
                          <li key={s.name} className="store">
                            <button type="button" className="store-name" onClick={() => focusStore(s)} disabled={s.lat == null} title={s.lat == null ? 'No map position in the sheet yet' : 'Show on the map'}>
                              {s.name}
                            </button>
                            {s.address && <span className="store-addr">{s.address}</span>}
                            {week.length > 0 && (
                              <span className="store-week">
                                {week.map((l, i) => (
                                  <span key={i}>{l}</span>
                                ))}
                              </span>
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
                  )}
                </div>
              );
            })}
          </div>
          <div className="map-plate">
            <StoreMap stores={data.stores} city={activeCity} cityPicked={cityPicked} weeklyLines={weeklyLines} focus={focus} focusSeq={focusSeq} onLive={() => undefined} />
            <p className="map-caption">Stores with a map position in the sheet. Select a place to frame it.</p>
          </div>
        </div>
      </div>
    </section>
  );
});
