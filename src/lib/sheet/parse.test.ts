import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCell, parseSheetDate, parseSheetRows, parseSpecialEvents, parseStores } from './parse';

// The real sheet as exported when the site was first built: every city tab
// with its free-text cells. If the parser regresses on any of these shapes
// the community sees events vanish or merge, so they are pinned here.
const raw = JSON.parse(readFileSync(new URL('../../../project/data_raw.json', import.meta.url), 'utf8')) as Record<string, (string | null)[][]>;
const rows = (city: string) => raw[city].map((r) => r.map((c) => c ?? ''));

describe('parseCell', () => {
  it('reads the canonical type / venue / time / (frequency) shape', () => {
    const [ev] = parseCell('Constructed - Weekly Play\nGood Games Town Hall\n18:30 - 22:00\n(weekly)');
    expect(ev).toEqual({
      type: 'Constructed / Weekly Play',
      venue: 'Good Games Town Hall',
      suburb: '',
      time: '18:30 to 22:00',
      freq: 'weekly',
      note: '',
    });
  });

  it('keeps a suburb on its own line and strips a leading @', () => {
    const [ev] = parseCell('Draft/Sealed\n@Good Games Adelaide\n17:00 - 21:00\n(fortnightly)');
    expect(ev.type).toBe('Draft / Sealed');
    expect(ev.venue).toBe('Good Games Adelaide');
    const [withSuburb] = parseCell('Casual Play\n Fluke And Box\nSpringwood\n17:00 - 19:00\n(weekly)\n');
    expect(withSuburb.venue).toBe('Fluke And Box');
    expect(withSuburb.suburb).toBe('Springwood');
  });

  it('splits two stacked events in one cell', () => {
    const cell = 'Casual Constructed\nBlacklist Cards and Collectables\n18:00 - 23:00\n(fortnightly)\n\n\nMonthly Tournament\nGames Portal\nfrom 18:00\n(monthly - check discord for dates!)\n';
    const events = parseCell(cell);
    expect(events).toHaveLength(2);
    expect(events[0].venue).toBe('Blacklist Cards and Collectables');
    expect(events[1]).toMatchObject({ type: 'Monthly Tournament', venue: 'Games Portal', time: 'from 18:00', freq: 'monthly', note: 'check discord for dates!' });
  });

  it('treats a parenthetical without a keyword as a note, not a frequency', () => {
    const events = parseCell('Draft/Sealed\n@Good Games Modbury\n12:00 - 17:00\n(not regular!)\n');
    expect(events[0].freq).toBe('irregular');
    expect(events[0].note).toBe('not regular!');
  });

  it('drops the Discord boilerplate line and strips a weekday prefix from the time', () => {
    const cell = 'Weekly Sorcery Casual Constructed\n\nGood Games Belconnen\n\nMonday evenings 18:00 - 20:30\n\nEntry fee $13 - all participants receive two booster packs.\nRegister your interest on the Sorcery Play Network!\n\n(Check on the Sorcery TCG Australia Discord)';
    const [ev] = parseCell(cell);
    expect(ev.time).toBe('18:00 to 20:30');
    expect(ev.freq).toBe('weekly');
    expect(ev.note).not.toMatch(/discord/i);
    expect(ev.note).toMatch(/Entry fee/);
  });
});

describe('parseSheetRows against the exported sheet', () => {
  it('finds every city header and the Updated row', () => {
    for (const city of Object.keys(raw)) {
      const parsed = parseSheetRows(rows(city));
      expect(parsed.updated, city).not.toBe('');
    }
  });

  it('counts the events each city had at export time', () => {
    const count = (city: string) => Object.values(parseSheetRows(rows(city)).events).reduce((n, list) => n + list.length, 0);
    expect(count('Sydney')).toBe(3);
    expect(count('Canberra')).toBe(2);
    expect(count('Melbourne')).toBe(4);
    expect(count('Perth')).toBe(1);
    expect(count('Adelaide')).toBe(2);
    expect(count('Brisbane')).toBe(2);
    expect(count('Hobart')).toBe(1);
  });

  it('puts events under the right day', () => {
    const syd = parseSheetRows(rows('Sydney')).events;
    expect(syd.TUE[0].venue).toBe('Good Games Town Hall');
    expect(syd.THU[0].venue).toBe('Mighty Cool Games Hornsby');
    expect(syd.FRI[0].venue).toBe('Fluke And Box');
    expect(syd.MON).toHaveLength(0);
  });

  it('lets the last Updated row win when a tab has two', () => {
    expect(parseSheetRows(rows('Brisbane')).updated).toBe('6 June 2026');
  });
});

describe('tabular tabs', () => {
  it('parses gviz Date() and DD/MM/YY into ISO', () => {
    expect(parseSheetDate('Date(2026,9,3)')).toBe('2026-10-03');
    expect(parseSheetDate('3/10/26')).toBe('2026-10-03');
    expect(parseSheetDate('nonsense')).toBeNull();
  });

  it('reads special events with placings and a date range', () => {
    const tab = {
      colLabels: ['Date', 'End Date', 'Event', 'City', 'Venue', 'Time', 'Format', 'Entry', 'Link', '1st_place', '1st_deck', '2nd_place'],
      rows: [
        ['3/10/26', '4/10/26', 'Grand Contest Sydney', 'Sydney', 'Good Games Town Hall', '10:00', 'Constructed', '$45', 'https://example.com', 'Ada', 'https://curiosa.io/decks/1', 'Bob'],
        ['', '', 'no date, skipped'],
      ],
    };
    const [ev] = parseSpecialEvents(tab);
    expect(ev.start).toBe('2026-10-03');
    expect(ev.end).toBe('2026-10-04');
    expect(ev.tier).toBe('grand');
    expect(ev.results).toEqual([
      { place: 1, player: 'Ada', deck: 'https://curiosa.io/decks/1' },
      { place: 2, player: 'Bob', deck: '' },
    ]);
    expect(parseSpecialEvents(tab)).toHaveLength(1);
  });

  it('falls back to a header row inside the data when gviz gives no labels', () => {
    const tab = {
      colLabels: ['', '', ''],
      rows: [
        ['Store', 'City', 'Lat'],
        ['Good Games Hobart', 'Hobart', '-42.88'],
      ],
    };
    const [store] = parseStores(tab);
    expect(store.name).toBe('Good Games Hobart');
    expect(store.lat).toBeCloseTo(-42.88);
    expect(store.lng).toBeNull();
  });
});
