// Refreshes src/data/cards.json, the card pool for Realmdle (/daily), from
// the Sorcery Card Registry export that KairosArchive serves.
//
// Runs before every `next build`, after the sheet fetch. The registry
// changes a few times a year and asks clients not to re-download the 6 MB
// export needlessly, so this first fetches its 80-byte checksum and only
// downloads the export when that differs from the one the snapshot was made
// from. Any failure keeps the committed file and never fails the build: the
// page never calls the API, so the game works even if the source is down.
//
// To seed from a local clone instead (no network): pass the path, e.g.
//   npx tsx scripts/fetch-cards.ts ../sorcery-registry/export/registry.json

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { normalise, type RegistryExport } from '../src/lib/realmdle/adapter';
import type { CardData } from '../src/lib/realmdle/types';

const BASE = 'https://api.kairosarchive.net/v3';
const SOURCE = `${BASE}/registry.json`;
// The registry asks automated clients to name themselves and a contact.
const HEADERS = { 'user-agent': 'realmofoz-daily/1.0 (+https://realmofoz.com)', accept: 'application/json' };
const OUT = new URL('../src/data/cards.json', import.meta.url);
/** Fewer cards than this means something upstream is wrong. */
const MIN_CARDS = 500;

function readPrevious(): CardData | null {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8')) as CardData;
  } catch {
    return null;
  }
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

function write(text: string, source: string, digest: string) {
  const data = normalise(JSON.parse(text) as RegistryExport, source, new Date().toISOString(), digest);
  if (data.cards.length < MIN_CARDS) throw new Error(`only ${data.cards.length} cards parsed; has the export's shape changed?`);
  writeFileSync(OUT, JSON.stringify(data) + '\n');
  const noRarity = data.cards.filter((c) => c.rarity === null).length;
  console.log(`Card pool written: ${data.cards.length} cards across ${data.sets.join(', ')} (${noRarity} without a rarity, never the answer)`);
}

async function main() {
  const local = process.argv[2];
  if (local) {
    const text = readFileSync(local, 'utf8');
    return write(text, SOURCE, sha256(text));
  }
  if (process.env.SKIP_SHEET_FETCH || process.env.SKIP_CARD_FETCH) {
    console.log('Skipping the card fetch: keeping the committed card pool');
    return;
  }
  const previous = readPrevious();
  try {
    const published = (await get(`${SOURCE}.sha256`)).trim().split(/\s+/)[0];
    if (previous?.sha256 === published) {
      console.log(`Card pool is current (registry ${published.slice(0, 12)})`);
      return;
    }
    const text = await get(SOURCE);
    const digest = sha256(text);
    if (digest !== published) throw new Error(`download does not match its published checksum`);
    write(text, SOURCE, digest);
  } catch (err) {
    console.warn(`Card pool not refreshed (${(err as Error).message}): keeping ${previous?.cards.length ?? 0} committed cards`);
  }
}

main().catch((err) => {
  // never fail the build over the minigame
  console.error(err);
});
