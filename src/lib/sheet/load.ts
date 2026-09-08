// Assembles a full SiteData from the sheet. Used by the build-time snapshot
// script and by the browser's post-hydration refresh, so every tab is
// fetched independently: one broken tab should never take the others down.

import { CITIES, FEATURED_DECKS_TAB, SPECIAL_EVENTS_TAB, STORES_TAB } from '../config';
import { fetchCityRows, fetchTabular } from './gviz';
import { parseFeaturedDecks, parseSheetRows, parseSpecialEvents, parseStores } from './parse';
import { emptyWeek, type CityData, type SiteData } from './types';

export interface LoadOptions {
  signal?: AbortSignal;
  onError?: (section: string, err: unknown) => void;
}

export async function loadSiteData(opts: LoadOptions = {}): Promise<SiteData> {
  const failed: string[] = [];
  const fail = (section: string, err: unknown) => {
    failed.push(section);
    opts.onError?.(section, err);
  };

  const cities: CityData = {};
  await Promise.all(
    CITIES.map(async (city) => {
      try {
        cities[city] = parseSheetRows(await fetchCityRows(city, opts.signal));
      } catch (err) {
        cities[city] = { events: emptyWeek(), updated: '', error: true };
        fail(city, err);
      }
    }),
  );

  const [special, stores, featured] = await Promise.all([
    fetchTabular(SPECIAL_EVENTS_TAB, opts.signal).then(parseSpecialEvents).catch((err) => (fail('special', err), [])),
    fetchTabular(STORES_TAB, opts.signal).then(parseStores).catch((err) => (fail('stores', err), [])),
    fetchTabular(FEATURED_DECKS_TAB, opts.signal).then(parseFeaturedDecks).catch((err) => (fail('featured', err), [])),
  ]);

  return { cities, special, stores, featured, fetchedAt: new Date().toISOString(), failed };
}
