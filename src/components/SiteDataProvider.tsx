'use client';

// Holds the site's data and the one city selection that the schedule and
// the store explorer share. Starts from the build-time snapshot (so the
// first paint and search engines see real content), then re-reads the
// Google Sheet in the browser so an edit to the sheet shows up without
// waiting for the next build.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CITIES, type City } from '@/lib/config';
import { ALL, type CityChoice } from '@/lib/events';
import { loadSiteData } from '@/lib/sheet/load';
import type { SiteData } from '@/lib/sheet/types';

export type RefreshState = 'idle' | 'refreshing' | 'fresh' | 'offline';

interface Ctx {
  data: SiteData;
  // the schedule shows one city at a time, or every city together
  activeCity: CityChoice;
  // the store explorer tracks the same city, but can also sit on "All"
  storeCity: CityChoice;
  cityPicked: boolean;
  setCity: (c: CityChoice) => void;
  setStoreCity: (c: CityChoice) => void;
  refresh: RefreshState;
  now: Date | null;
}

const SiteDataContext = createContext<Ctx | null>(null);

function cityFromURL(): CityChoice | null {
  try {
    const p = new URLSearchParams(window.location.search).get('city');
    if (!p) return null;
    if (p.toLowerCase() === 'all') return ALL;
    return (CITIES.find((c) => c.toLowerCase() === p.toLowerCase()) as City | undefined) ?? null;
  } catch {
    return null;
  }
}

export function SiteDataProvider({ snapshot, children }: { snapshot: SiteData; children: ReactNode }) {
  const [data, setData] = useState<SiteData>(snapshot);
  const [activeCity, setActiveCity] = useState<CityChoice>(ALL);
  const [storeCity, setStoreCityState] = useState<CityChoice>(ALL);
  const [cityPicked, setCityPicked] = useState(false);
  const [refresh, setRefresh] = useState<RefreshState>('idle');
  const [now, setNow] = useState<Date | null>(null);

  // Clock only exists after hydration, so server and client markup agree.
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ?city=Melbourne opens on that city, as it always has
  useEffect(() => {
    const c = cityFromURL();
    if (c) {
      setActiveCity(c);
      setStoreCityState(c);
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

  // one city selection drives the schedule, the store list and the map
  const setCity = useCallback((c: CityChoice) => {
    setActiveCity(c);
    setStoreCityState(c);
    setCityPicked(true);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('city', c);
      window.history.replaceState(null, '', u);
    } catch {
      /* URL API unavailable: selection simply isn't shareable */
    }
  }, []);

  // picking a city in the store explorer still drives the whole page; only
  // "All" there is store-only
  const setStoreCity = useCallback(
    (c: CityChoice) => {
      if (c !== ALL) {
        setCity(c);
        return;
      }
      setStoreCityState(ALL);
      setCityPicked(true);
    },
    [setCity],
  );

  const value = useMemo<Ctx>(
    () => ({ data, activeCity, storeCity, cityPicked, setCity, setStoreCity, refresh, now }),
    [data, activeCity, storeCity, cityPicked, setCity, setStoreCity, refresh, now],
  );
  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
}

export function useSiteData(): Ctx {
  const ctx = useContext(SiteDataContext);
  if (!ctx) throw new Error('useSiteData must be used inside SiteDataProvider');
  return ctx;
}
