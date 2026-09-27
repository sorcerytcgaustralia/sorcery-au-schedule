// Refreshes src/data/cards.json, the card pool for Realmdle (/daily), from
// the Sorcery Card Registry export that KairosArchive serves, and keeps
// src/data/schedule.json (the answer for each day) planned a year ahead.
//
// Run daily by .github/workflows/refresh-cards.yml, which commits any
// change; site builds never run it and only read the committed files, so
// a build can never change a day's answer. The registry changes a few
// times a year and asks clients not to re-download the 6 MB export
// needlessly, so this first fetches its 80-byte checksum and only
// downloads the export when that differs from the one the pool was made
// from. Any failure keeps the committed files.
//
// To seed from a local clone instead (no network): pass the path, e.g.
//   npx tsx scripts/fetch-cards.ts ../sorcery-registry/export/registry.json

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { normalise, type RegistryExport } from '../src/lib/realmdle/adapter';
import { releaseGate, replan, puzzleNumber } from '../src/lib/realmdle/engine';
import type { CardData } from '../src/lib/realmdle/types';

const BASE = 'https://api.kairosarchive.net/v3';
const SOURCE = `${BASE}/registry.json`;
// The registry asks automated clients to name themselves and a contact.
const HEADERS = { 'user-agent': 'realmofoz-daily/1.0 (+https://realmofoz.com)', accept: 'application/json' };
const OUT = new URL('../src/data/cards.json', import.meta.url);
const SCHEDULE = new URL('../src/data/schedule.json', import.meta.url);
/** How far ahead the schedule is planned. */
const DAYS_AHEAD = 365;
/** Top the plan up once it is this much shorter than DAYS_AHEAD: a commit a month, not a day. */
const TOP_UP = 30;
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

type Schedule = { note?: string; pool: string | null; answers: string[] };

/**
 * Replans the schedule when the card pool has changed, or tops it up when
 * it runs short. Days up to today never change and the next week is
 * locked (see `replan`), so a new set is mixed in from about a week out.
 */
function updateSchedule() {
  const data = readPrevious();
  if (!data) return;
  let current: Schedule = { pool: null, answers: [] };
  try {
    current = { pool: null, ...JSON.parse(readFileSync(SCHEDULE, 'utf8')) };
  } catch {
    /* first run */
  }
  const today = puzzleNumber(new Date());
  const poolChanged = current.pool !== data.sha256;
  if (!poolChanged && current.answers.length - today >= DAYS_AHEAD - TOP_UP) return;

  const answers = replan(data.cards, current.answers, today, today + DAYS_AHEAD, { eligibleFrom: releaseGate(data.sets, data.setDates) });
  const changedFrom = answers.findIndex((id, i) => id !== current.answers[i]);
  const schedule: Schedule = {
    note: 'Puzzle n is answers[n - 1]. Written by scripts/fetch-cards.ts: days up to today never change.',
    pool: data.sha256,
    answers,
  };
  writeFileSync(SCHEDULE, JSON.stringify(schedule) + '\n');
  console.log(
    `Schedule ${poolChanged ? 'replanned for a new card pool' : 'topped up'}: puzzles 1 to ${answers.length}` +
      (changedFrom >= 0 ? `, changed from puzzle ${changedFrom + 1}` : ', no days changed'),
  );
}

async function main() {
  await refreshCards();
  updateSchedule();
}

async function refreshCards() {
  const local = process.argv[2];
  if (local) {
    const text = readFileSync(local, 'utf8');
    return write(text, SOURCE, sha256(text));
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
