// Refreshes src/data/cards.json, the card pool for Realmdle (/daily).
//
// Runs before every `next build`, after the sheet fetch. Like the sheet
// snapshot, the committed file is the last known good data: if the API is
// unreachable, or answers with something the adapter cannot read, the file
// is left alone and the build carries on. The page itself never calls the
// API, so the game keeps working even if the source goes down.

import { readFileSync, writeFileSync } from 'node:fs';
import { cardRecords, normalise } from '../src/lib/realmdle/adapter';
import type { CardData } from '../src/lib/realmdle/types';

const SOURCE = process.env.CARDS_API_URL ?? 'https://kairosarchive.net/api/cards';
const OUT = new URL('../src/data/cards.json', import.meta.url);
/** A fresh fetch with fewer cards than this is treated as broken. */
const MIN_CARDS = 100;

function readPrevious(): CardData | null {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8')) as CardData;
  } catch {
    return null;
  }
}

async function main() {
  if (process.env.SKIP_SHEET_FETCH || process.env.SKIP_CARD_FETCH) {
    console.log('Skipping the card fetch: keeping the committed card pool');
    return;
  }
  const previous = readPrevious();
  const keep = (why: string) => console.warn(`Card pool not refreshed (${why}): keeping ${previous?.cards.length ?? 0} committed cards`);

  let body: unknown;
  try {
    const res = await fetch(SOURCE, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return keep(`${SOURCE} answered ${res.status}`);
    body = await res.json();
  } catch (err) {
    return keep(`${SOURCE}: ${(err as Error).message}`);
  }

  const data = normalise(body, SOURCE, new Date().toISOString());
  if (data.cards.length < MIN_CARDS) {
    // Print enough of the response to fix the adapter without guessing.
    const records = cardRecords(body);
    const sample = records[0] ?? body;
    console.warn(`  ${records.length} records found, ${data.cards.length} cards parsed. Top-level keys: ${Object.keys((body ?? {}) as object).slice(0, 20).join(', ')}`);
    console.warn(`  First record: ${JSON.stringify(sample).slice(0, 1500)}`);
    return keep('the response did not match the adapter in src/lib/realmdle/adapter.ts');
  }

  writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n');
  const missing = (field: 'rarity' | 'cost' | 'image') => data.cards.filter((c) => c[field] === null).length;
  console.log(
    `Card pool written: ${data.cards.length} cards across ${data.sets.length} sets (${data.sets.join(', ')}); ` +
      `without rarity ${missing('rarity')}, without cost ${missing('cost')}, without image ${missing('image')}`,
  );
}

main().catch((err) => {
  // never fail the build over the minigame
  console.error(err);
});
