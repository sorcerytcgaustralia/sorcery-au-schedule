// Refreshes src/data/site-data.json from the community's Google Sheet.
//
// Runs before every `next build` (see the prebuild script). The committed
// JSON is the last known good snapshot: a tab that cannot be read keeps its
// previous contents, and a total failure (no network at all) leaves the file
// untouched, so a build never ships an empty site. The browser re-reads the
// sheet after hydration, so the snapshot only has to be good enough for
// first paint and for search engines.

import { readFileSync, writeFileSync } from 'node:fs';
import { CITIES } from '../src/lib/config';
import { loadSiteData } from '../src/lib/sheet/load';
import type { SiteData } from '../src/lib/sheet/types';

const OUT = new URL('../src/data/site-data.json', import.meta.url);

function readPrevious(): SiteData | null {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8')) as SiteData;
  } catch {
    return null;
  }
}

async function main() {
  if (process.env.SKIP_SHEET_FETCH) {
    console.log('SKIP_SHEET_FETCH set: keeping the committed snapshot');
    return;
  }
  const previous = readPrevious();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  const fresh = await loadSiteData({
    signal: controller.signal,
    onError: (section, err) => console.warn(`  could not read "${section}": ${(err as Error).message}`),
  }).finally(() => clearTimeout(timer));

  const everythingFailed = fresh.failed.length >= CITIES.length + 3;
  if (everythingFailed) {
    console.warn(previous ? 'Sheet unreachable: keeping the committed snapshot' : 'Sheet unreachable and no snapshot exists');
    if (!previous) process.exitCode = 1;
    return;
  }

  // Merge: a tab that failed this time keeps what the snapshot had.
  const merged: SiteData = { ...fresh, cities: { ...fresh.cities } };
  if (previous) {
    for (const city of CITIES) {
      if (fresh.cities[city]?.error && previous.cities[city] && !previous.cities[city].error) merged.cities[city] = previous.cities[city];
    }
    if (fresh.failed.includes('special')) merged.special = previous.special;
    if (fresh.failed.includes('stores')) merged.stores = previous.stores;
    if (fresh.failed.includes('featured')) merged.featured = previous.featured;
  }

  writeFileSync(OUT, JSON.stringify(merged, null, 2) + '\n');
  const eventCount = Object.values(merged.cities).reduce((n, c) => n + Object.values(c.events).reduce((m, l) => m + l.length, 0), 0);
  console.log(
    `Snapshot written: ${eventCount} weekly events across ${CITIES.length} cities, ` +
      `${merged.special.length} special events, ${merged.stores.length} stores, ${merged.featured.length} featured decks` +
      (fresh.failed.length ? ` (kept previous data for: ${fresh.failed.join(', ')})` : ''),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
