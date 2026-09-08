// One-off: builds the initial src/data/site-data.json from the sheet export
// that shipped with the original site (project/data_raw.json), for
// environments that cannot reach Google. Weekly events only; the other tabs
// start empty and fill in on the first build with network access.

import { readFileSync, writeFileSync } from 'node:fs';
import { CITIES } from '../src/lib/config';
import { parseSheetRows } from '../src/lib/sheet/parse';
import type { SiteData } from '../src/lib/sheet/types';

const raw = JSON.parse(readFileSync(new URL('../project/data_raw.json', import.meta.url), 'utf8')) as Record<string, (string | null)[][]>;
const data: SiteData = { cities: {}, special: [], stores: [], featured: [], fetchedAt: new Date().toISOString(), failed: [] };
for (const city of CITIES) data.cities[city] = parseSheetRows(raw[city].map((r) => r.map((c) => c ?? '')));
writeFileSync(new URL('../src/data/site-data.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
console.log('seeded');
