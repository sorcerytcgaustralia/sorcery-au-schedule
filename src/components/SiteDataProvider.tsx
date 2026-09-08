'use client';

// Holds the site's data and the one city selection that every section
// shares. Starts from the build-time snapshot (so the first paint and search
// engines see real content), then re-reads the Google Sheet in the browser
// so an edit to the sheet shows up without waiting for the next build.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CITIES, CITY_SLUG, type City } from '@/lib/config';
import { ALL, type CityChoice } from '@/lib/events';
import { loadSiteData } from '@/lib/sheet/load';
import type { SiteData } from '@/lib/sheet/types';

export type RefreshState = 'idle' | 'refreshing' | 'fresh' | 'offline';

interface Ctx {
  data: SiteData;
  city: CityChoice;
  setCity: (c: CityChoice) => void;
  refresh: RefreshState;
  now: Date | null;
}

const SiteDataContext = createContext<Ctx | null>(null);

const STORAGE_KEY = 'realmofoz.city';

function isCity(v: unknown): v is City {
  return typeof v === 'string' && (CITIES as readonly string[]).includes(v);
}

export function SiteDataProvider({ snapshot, initialCity, children }: { snapshot: SiteData; initialCity: CityChoice; children: ReactNode }) {
  const [data, setData] = useState<SiteData>(snapshot);
  const [city, setCityState] = useState<CityChoice>(initialCity);
  const [refresh, setRefresh] = useState<RefreshState>('idle');
  const [now, setNow] = useState<Date | null>(null);
  const pinned = useRef(initialCity !== ALL);

  // Clock only exists after hydration, so server and client markup agree.
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // On the home page, come back to the city you looked at last time. A city
  // page (/schedule/melbourne) is pinned to its own city.
  useEffect(() => {
    if (pinned.current) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('city');
      const match = fromQuery && CITIES.find((c) => c.toLowerCase() === fromQuery.toLowerCase());
      if (match) {
        setCityState(match);
        return;
      }
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isCity(stored) || stored === ALL) setCityState(stored);
    } catch {
      /* storage unavailable: stay on the default */
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setRefresh('refreshing');
    loadSiteData({ signal: controller.signal })
      .then((fresh) => {
        if (controller.signal.aborted) return;
        // keep the snapshot for any tab that could not be read live
        setData((prev) => ({
          ...fresh,
          cities: Object.fromEntries(CITIES.map((c) => [c, fresh.cities[c]?.error ? prev.cities[c] : fresh.cities[c]])),
          special: fresh.failed.includes('special') ? prev.special : fresh.special,
          stores: fresh.failed.includes('stores') ? prev.stores : fresh.stores,
          featured: fresh.failed.includes('featured') ? prev.featured : fresh.featured,
        }));
        setRefresh(fresh.failed.length >= CITIES.length + 3 ? 'offline' : 'fresh');
      })
      .catch(() => setRefresh('offline'));
    return () => controller.abort();
  }, []);

  const setCity = useCallback((c: CityChoice) => {
    setCityState(c);
    try {
      window.localStorage.setItem(STORAGE_KEY, c);
      const path = c === ALL ? '/' : `/schedule/${CITY_SLUG[c]}`;
      window.history.replaceState(null, '', path + window.location.hash);
    } catch {
      /* not shareable, still selectable */
    }
  }, []);

  const value = useMemo<Ctx>(() => ({ data, city, setCity, refresh, now }), [data, city, setCity, refresh, now]);
  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
}

export function useSiteData(): Ctx {
  const ctx = useContext(SiteDataContext);
  if (!ctx) throw new Error('useSiteData must be used inside SiteDataProvider');
  return ctx;
}
