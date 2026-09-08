'use client';

import dynamic from 'next/dynamic';
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { CITIES, SHEET_URL } from '@/lib/config';
import { ALL, findStoreForVenue } from '@/lib/events';
import { DAY_KEYS, DAY_NAMES, type Store } from '@/lib/sheet/types';
import { useSiteData } from './SiteDataProvider';

const StoreMap = dynamic(() => import('./StoreMap').then((m) => m.StoreMap), { ssr: false });

const FREQ_LABEL: Record<string, string> = { fortnightly: 'fortnightly', monthly: 'monthly', irregular: 'check dates' };

export interface StoresHandle {
  showVenue: (venue: string) => void;
}

export const Stores = forwardRef<StoresHandle>(function Stores(_, ref) {
  const { data, city, setCity } = useSiteData();
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
            lines.push(`${DAY_NAMES[day].slice(0, 3)} · ${ev.type}${ev.time ? ' · ' + ev.time : ''}${ev.freq !== 'weekly' ? ` (${FREQ_LABEL[ev.freq]})` : ''}`);
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

  const items = city === ALL ? data.stores : data.stores.filter((s) => s.city === city);
  const unreadable = data.failed.includes('stores') && data.stores.length === 0;

  return (
    <section className="section wrap" id="stores" aria-labelledby="stores-title">
      <div className="section-head">
        <span className="section-no mono">§ 06</span>
        <h2 className="section-title" id="stores-title">
          Find <em>a local store</em>
        </h2>
        <p className="section-meta mono">
          {city === ALL ? `${data.stores.length} stores across Australia` : `${items.length} in ${city}`}
          {city !== ALL && (
            <>
              {' · '}
              <a href="#stores" onClick={(e) => (e.preventDefault(), setCity(ALL))}>
                show all
              </a>
            </>
          )}
        </p>
      </div>
      <div className="stores">
        <StoreMap stores={data.stores} city={city} weeklyLines={weeklyLines} focus={focus} focusSeq={focusSeq} />
        <ul className="store-list">
          {unreadable ? (
            <li className="store-none">The store list could not be read just now. Ask on the Discord.</li>
          ) : items.length === 0 ? (
            <li className="store-none">
              No stores listed {city === ALL ? 'yet' : `for ${city} yet`}.{' '}
              <a href={SHEET_URL} target="_blank" rel="noopener" style={{ color: 'var(--text-2)' }}>
                Add one to the sheet.
              </a>
            </li>
          ) : (
            items.map((s) => {
              const week = weeklyLines(s);
              return (
                <li className="store-item" key={s.name + s.city}>
                  <button type="button" onClick={() => focusStore(s)} disabled={s.lat == null} title={s.lat == null ? 'No coordinates in the sheet yet' : 'Show on the map'}>
                    <span>{s.name}</span>
                    {city === ALL && s.city && <span className="store-city">{s.city}</span>}
                  </button>
                  {s.address && <p className="store-addr">{s.address}</p>}
                  {week.length > 0 && (
                    <p className="store-week">
                      {week.map((l, i) => (
                        <span key={i}>
                          {l}
                          <br />
                        </span>
                      ))}
                    </p>
                  )}
                  {s.link && (
                    <a className="store-site" href={s.link} target="_blank" rel="noopener">
                      Website &nearr;
                    </a>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </section>
  );
});
