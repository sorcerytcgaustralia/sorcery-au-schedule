// Parsers for the community's Google Sheet.
//
// Each city is a separate sheet tab. Below the MON..SUN header row, every
// non-empty cell holds one or more events as free-text lines:
//
//   Event type
//   Venue (optionally "@Venue")
//   Suburb                <- optional, own line
//   Time (contains H:MM)
//   (frequency)            <- optional, e.g. (weekly), (fortnightly - notes)
//   Any extra note lines
//
// Multiple events in one cell are separated by starting a new "type" line;
// we detect that by looking ahead for an upcoming time-pattern line before
// any frequency parenthesis. A trailing "Updated: DD/MM/YY" row gives the
// last-updated date.
//
// This is a heuristic state machine, not a strict format, so the tests in
// parse.test.ts run it against the real exported sheet to keep it honest.

import {
  DAY_KEYS,
  emptyWeek,
  type CitySchedule,
  type FeaturedDeck,
  type Frequency,
  type Placing,
  type SpecialEvent,
  type Store,
  type Tier,
  type WeeklyEvent,
} from './types';

const TIME_LINE_RE = /\d{1,2}:\d{2}/;
const FREQ_PAREN_RE = /^\((.+)\)$/;
const FREQ_KEYWORD_RE = /\b(fortnightly|biweekly|monthly|weekly)\b/i;
const DISCORD_BOILERPLATE_RE = /^(check|see|ask|register|confirm)\b.*\bdiscord\b.*$/i;
const WEEKDAY_PREFIX_RE = /^(mon(day)?|tue(s|sday)?|wed(nesday)?|thu(rs|rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b[^\d]*/i;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Block {
  typeRaw: string;
  venueLines: string[];
  time: string;
  freq: Frequency | '';
  freqExplicit: boolean;
  notes: string[];
}

function normalizeFreqKeyword(word: string): Frequency {
  const w = word.toLowerCase();
  return (w === 'biweekly' ? 'fortnightly' : w) as Frequency;
}

function inferFreqFromText(text: string): Frequency {
  const m = text.match(FREQ_KEYWORD_RE);
  return m ? normalizeFreqKeyword(m[1]) : 'irregular';
}

function normalizeType(raw: string): string {
  return raw.replace(/\s*-\s*/g, ' · ').replace(/\s*\/\s*/g, ' · ').trim();
}

function normalizeTime(raw: string): string {
  return raw.replace(WEEKDAY_PREFIX_RE, '').trim().replace(/\s*-\s*/g, ' to ');
}

function consumeFreqParen(line: string, block: Block) {
  const inner = line.replace(FREQ_PAREN_RE, '$1').trim();
  const m = inner.match(FREQ_KEYWORD_RE);
  if (m) {
    block.freq = normalizeFreqKeyword(m[1]);
    block.freqExplicit = true;
    const leftover = inner
      .slice(inner.toLowerCase().indexOf(m[1].toLowerCase()) + m[1].length)
      .replace(/^[\s,:-]+/, '')
      .trim();
    if (leftover) block.notes.push(leftover);
  } else if (!DISCORD_BOILERPLATE_RE.test(inner)) {
    block.notes.push(inner);
  }
}

function looksLikeNewEventStart(lines: string[], idx: number): boolean {
  for (let k = idx; k < Math.min(idx + 3, lines.length); k++) {
    if (FREQ_PAREN_RE.test(lines[k])) return false;
    if (TIME_LINE_RE.test(lines[k])) return true;
  }
  return false;
}

function finalizeBlock(block: Block): WeeklyEvent {
  const venue = (block.venueLines[0] || '').replace(/^@\s*/, '').trim();
  const suburb = block.venueLines.slice(1).join(', ').trim();
  const freq = block.freqExplicit && block.freq ? block.freq : inferFreqFromText(block.typeRaw + ' ' + block.notes.join(' '));
  return {
    type: normalizeType(block.typeRaw),
    venue,
    suburb,
    time: normalizeTime(block.time),
    freq,
    note: block.notes.join(' ').trim(),
  };
}

export function parseCell(raw: string): WeeklyEvent[] {
  if (!raw || !raw.trim()) return [];
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const events: WeeklyEvent[] = [];
  let i = 0;
  while (i < lines.length) {
    const block: Block = { typeRaw: lines[i], venueLines: [], time: '', freq: '', freqExplicit: false, notes: [] };
    i++;

    while (i < lines.length && !TIME_LINE_RE.test(lines[i]) && !FREQ_PAREN_RE.test(lines[i])) {
      block.venueLines.push(lines[i]);
      i++;
    }
    if (i < lines.length && TIME_LINE_RE.test(lines[i])) {
      block.time = lines[i];
      i++;
    }
    if (i < lines.length && FREQ_PAREN_RE.test(lines[i])) {
      consumeFreqParen(lines[i], block);
      i++;
    }
    while (i < lines.length) {
      if (FREQ_PAREN_RE.test(lines[i])) {
        consumeFreqParen(lines[i], block);
        i++;
        continue;
      }
      if (looksLikeNewEventStart(lines, i)) break;
      block.notes.push(lines[i]);
      i++;
    }
    events.push(finalizeBlock(block));
  }
  return events;
}

export function formatUpdatedDate(raw: string): string {
  if (!raw) return '';
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return raw;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const yy = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
  const month = MONTHS[mm - 1] || m[2];
  return `${dd} ${month} ${yy}`;
}

export type Rows = string[][];

export function parseSheetRows(rows: Rows): CitySchedule {
  const events = emptyWeek();
  let headerRowIdx = -1;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r].map((c) => (c || '').toString().trim().toUpperCase());
    if (DAY_KEYS.every((d, idx) => row[idx] === d)) {
      headerRowIdx = r;
      break;
    }
  }
  if (headerRowIdx === -1) return { events, updated: '' };

  let updatedRaw = '';
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const first = (row[0] || '').toString().trim();
    const updatedMatch = first.match(/^updated:?\s*(.+)$/i);
    if (updatedMatch) {
      updatedRaw = updatedMatch[1].trim();
      continue;
    }
    for (let d = 0; d < 7; d++) {
      const cell = (row[d] || '').toString();
      if (!cell.trim()) continue;
      events[DAY_KEYS[d]].push(...parseCell(cell));
    }
  }
  return { events, updated: formatUpdatedDate(updatedRaw) };
}

// ---- tabular tabs (Special Events, Stores, Featured Decks) ----

export interface TabularTab {
  rows: Rows;
  colLabels: string[];
}

type ColMap = Record<string, number>;

function buildColMap(labels: string[], required: (lower: string[]) => boolean): ColMap | null {
  const lower = labels.map((h) => h.trim().toLowerCase());
  if (!required(lower)) return null;
  const map: ColMap = {};
  lower.forEach((h, i) => {
    if (h && map[h] == null) map[h] = i;
  });
  return map;
}

// When a column is date-typed, gviz promotes the header row into column
// metadata, so check the labels first and then fall back to scanning rows.
function locateHeader(tab: TabularTab, required: (lower: string[]) => boolean): { colMap: ColMap; headerIdx: number } | null {
  let colMap = buildColMap(tab.colLabels, required);
  if (colMap) return { colMap, headerIdx: -1 };
  for (let r = 0; r < tab.rows.length; r++) {
    colMap = buildColMap(tab.rows[r], required);
    if (colMap) return { colMap, headerIdx: r };
  }
  return null;
}

function colReader(colMap: ColMap) {
  return (row: string[], names: string[]): string => {
    for (const n of names) {
      if (colMap[n] != null) return (row[colMap[n]] || '').trim();
    }
    return '';
  };
}

const isUrl = (s: string) => /^https?:\/\//i.test(s);

// Sheet dates arrive either as gviz "Date(2026,9,3)" (month is 0-based) or
// as DD/MM/YY text. Both become YYYY-MM-DD.
export function parseSheetDate(str: string): string | null {
  if (!str) return null;
  str = str.trim();
  let m = str.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})/);
  if (m) return isoDate(+m[1], +m[2] + 1, +m[3]);
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const mo = +m[2];
    const d = +m[1];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return isoDate(y, mo, d);
  }
  return null;
}

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function inferTier(s: string): Tier {
  if (/grand\s*contest/i.test(s)) return 'grand';
  if (/cornerstone/i.test(s)) return 'cornerstone';
  return '';
}

export function parseSpecialEvents(tab: TabularTab): SpecialEvent[] {
  const located = locateHeader(tab, (lower) => lower.includes('date') && lower.some((h) => h === 'event' || h === 'event name'));
  if (!located) throw new Error('Special Events tab has no Date/Event header');
  const col = colReader(located.colMap);
  const events: SpecialEvent[] = [];

  for (let r = located.headerIdx + 1; r < tab.rows.length; r++) {
    const row = tab.rows[r];
    const rawDate = col(row, ['date', 'dates', 'start date', 'start']);
    const name = col(row, ['event', 'event name', 'name']);
    if (!rawDate || !name) continue;
    const parts = rawDate.split(/\s*[\u2013\u2014-]\s*/).map((s) => s.trim()).filter(Boolean);
    const start = parseSheetDate(parts[0]);
    if (!start) continue;
    let end = parseSheetDate(col(row, ['end date', 'end', 'until', 'to']));
    if (!end && parts.length > 1) end = parseSheetDate(parts[1]);
    if (!end || end < start) end = start;

    const results: Placing[] = [];
    ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].forEach((ord, i) => {
      const player = col(row, [ord + '_place']);
      if (!player) return;
      const deck = col(row, [ord + '_deck']);
      results.push({ place: i + 1, player, deck: isUrl(deck) ? deck : '' });
    });

    const link = col(row, ['link', 'url']);
    events.push({
      start,
      end,
      event: name,
      tier: inferTier(col(row, ['tier', 'event tier', 'type', 'event type'])) || inferTier(name),
      city: col(row, ['city']),
      venue: col(row, ['venue']),
      time: col(row, ['time', 'times']),
      format: col(row, ['format']),
      entry: col(row, ['entry', 'entry fee', 'cost']),
      link: isUrl(link) ? link : '',
      results,
    });
  }
  return events;
}

export function parseStores(tab: TabularTab): Store[] {
  const looksLikeHeader = (arr: string[]) => arr.includes('store') || arr.includes('name') || arr.includes('venue');
  const located = locateHeader(tab, looksLikeHeader);
  if (!located) throw new Error('Stores tab has no Store header');
  const col = colReader(located.colMap);
  const stores: Store[] = [];
  for (let r = located.headerIdx + 1; r < tab.rows.length; r++) {
    const row = tab.rows[r];
    const name = col(row, ['store', 'name', 'venue']);
    if (!name) continue;
    const link = col(row, ['website', 'link', 'url']);
    const lat = parseFloat(col(row, ['lat', 'latitude']));
    const lng = parseFloat(col(row, ['lng', 'lon', 'long', 'longitude']));
    stores.push({
      name,
      city: col(row, ['city']),
      address: col(row, ['address']),
      link: isUrl(link) ? link : '',
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    });
  }
  return stores;
}

export function parseFeaturedDecks(tab: TabularTab): FeaturedDeck[] {
  const located = locateHeader(tab, (lower) => lower.includes('card') && lower.includes('deck'));
  if (!located) throw new Error('Featured Decks tab has no Card/Deck header');
  const col = colReader(located.colMap);
  const decks: FeaturedDeck[] = [];
  for (let r = located.headerIdx + 1; r < tab.rows.length; r++) {
    const row = tab.rows[r];
    const card = col(row, ['card']);
    if (!card) continue;
    const link = col(row, ['link']);
    decks.push({ card, deck: col(row, ['deck']), pilot: col(row, ['pilot']), link: isUrl(link) ? link : '' });
  }
  return decks;
}
