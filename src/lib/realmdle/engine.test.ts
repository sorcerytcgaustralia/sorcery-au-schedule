import { describe, expect, it } from 'vitest';
import { LOCK_DAYS, MAX_GUESSES, answerPool, compare, extendSchedule, nameRepeats, puzzleDate, releaseGate, replan, dailyCard, msUntilNextPuzzle, puzzleNumber, shareText, suggest } from './engine';
import type { Card } from './types';

// Made-up cards: the rules are tested against shapes, not real card data.
const SETS = ['First', 'Second', 'Third'];
const card = (over: Partial<Card> & { name: string }): Card => ({
  id: over.name.toLowerCase().replace(/ /g, '-'),
  type: 'Minion',
  elements: ['Fire'],
  cost: 3,
  power: 3,
  rarity: 'Ordinary',
  subtypes: [],
  set: 'First',
  image: null,
  ...over,
});
const answer = card({ name: 'Test Drake', elements: ['Fire', 'Water'], cost: 5, power: 4, rarity: 'Elite', set: 'Second' });

describe('puzzleNumber', () => {
  it('starts at 1 on launch day in Sydney', () => {
    // 28 Sep 2026 00:30 in Sydney (AEST, UTC+10) is still the 27th in UTC
    expect(puzzleNumber(new Date('2026-09-27T14:30:00Z'))).toBe(1);
    expect(puzzleNumber(new Date('2026-09-28T13:59:00Z'))).toBe(1);
    expect(puzzleNumber(new Date('2026-09-28T14:00:00Z'))).toBe(2);
  });

  it('follows the Sydney clock across daylight saving', () => {
    // DST starts 4 Oct 2026, so midnight moves from 14:00 to 13:00 UTC
    expect(puzzleNumber(new Date('2026-10-05T12:59:00Z'))).toBe(8);
    expect(puzzleNumber(new Date('2026-10-05T13:00:00Z'))).toBe(9);
  });

  it('counts down to the next Sydney midnight', () => {
    expect(msUntilNextPuzzle(new Date('2026-09-28T13:00:00Z'))).toBe(3_600_000);
    // before launch too, when the puzzle number is held at 1
    expect(msUntilNextPuzzle(new Date('2026-09-20T13:00:00Z'))).toBe(3_600_000);
  });
});

describe('dailyCard', () => {
  // distinct cost and power so every card has its own signature
  const pool = Array.from({ length: 50 }, (_, i) => card({ name: `Card ${i}`, cost: i % 10, power: Math.floor(i / 10) }));

  it('is the same for everyone on a given day and changes between days', () => {
    expect(dailyCard(pool, 10)).toEqual(dailyCard([...pool].reverse(), 10));
    const week = new Set(Array.from({ length: 7 }, (_, d) => dailyCard(pool, d + 1)!.id));
    expect(week.size).toBeGreaterThan(4);
  });

  it('mostly keeps the answer when new cards are added', () => {
    const grown = [...pool, ...Array.from({ length: 5 }, (_, i) => card({ name: `New ${i}`, cost: 20 + i }))];
    const kept = Array.from({ length: 100 }, (_, d) => dailyCard(pool, d)!.id === dailyCard(grown, d)!.id || dailyCard(grown, d)!.id.startsWith('new')).filter(Boolean).length;
    expect(kept).toBe(100);
  });

  it('only picks a card no other card can be mistaken for', () => {
    const twinA = card({ name: 'Twin A', type: 'Site', elements: [], cost: null, power: null });
    const twinB = card({ name: 'Twin B', type: 'Site', elements: [], cost: null, power: null });
    const loner = card({ name: 'Loner', cost: 9 });
    expect(answerPool([twinA, twinB, loner]).map((c) => c.name)).toEqual(['Loner']);
    for (let d = 1; d <= 20; d++) expect(dailyCard([twinA, twinB, loner], d)!.name).toBe('Loner');
  });

  it('skips cards without a rarity', () => {
    expect(dailyCard([card({ name: 'No Rarity', rarity: null })], 1)).toBeNull();
  });
});

describe('schedule', () => {
  const pool = Array.from({ length: 10 }, (_, i) => card({ name: `Card ${i}`, cost: i }));

  it('uses every card once before any repeats', () => {
    const s = extendSchedule(pool, [], 25);
    expect(s).toHaveLength(25);
    expect(new Set(s.slice(0, 10)).size).toBe(10);
    expect(new Set(s.slice(10, 20)).size).toBe(10);
  });

  it('never changes days already scheduled, even when the pool changes', () => {
    const first = extendSchedule(pool, [], 12);
    const grown = [...pool, card({ name: 'Newcomer', cost: 42 })];
    const longer = extendSchedule(grown, first, 30);
    expect(longer.slice(0, 12)).toEqual(first);
    expect(longer).toContain('newcomer');
  });

  it('spaces out the copies of a card from different sets', () => {
    // five cards, each printed in two sets: ten entries, five names
    const twoSets = pool.slice(0, 5).flatMap((c) => [
      { ...c, id: `${c.id}-a`, set: 'First' },
      { ...c, id: `${c.id}-b`, set: 'Second' },
    ]);
    const s = extendSchedule(twoSets, [], 10);
    const names = s.map((id) => twoSets.find((c) => c.id === id)!.name);
    // every name once before any name comes back, then in the same order
    expect(new Set(names.slice(0, 5)).size).toBe(5);
    expect(names.slice(5)).toEqual(names.slice(0, 5));
  });

  it('never brings a name back within the gap, even with more entries than names', () => {
    // 8 names, 3 of them in two sets: 11 entries. With a gap of 5 days the
    // rule always has a free name, so it must hold over many cycles.
    const names = Array.from({ length: 8 }, (_, i) => card({ name: `Name ${i}`, cost: i }));
    const entries = [...names, ...names.slice(0, 3).map((c) => ({ ...c, id: `${c.id}-b`, set: 'Second' }))];
    const s = extendSchedule(entries, [], 200, { gap: 5 });
    expect(nameRepeats(entries, s, 5)).toEqual([]);
    // and every entry still gets its day
    expect(new Set(s).size).toBe(entries.length);
  });

  it('holds a new set back until its grace period is over', () => {
    const fresh = card({ name: 'Fresh', cost: 50, set: 'Second' });
    // Second released on puzzle 5's date: with 14 days' grace, eligible from puzzle 19
    const gate = releaseGate(['First', 'Second'], ['2020-01-01', puzzleDate(5)]);
    const s = extendSchedule([...pool, fresh], [], 40, { gap: 1, eligibleFrom: gate });
    expect(s.indexOf(fresh.id) + 1).toBeGreaterThanOrEqual(19);
  });

  it('gives a new set a fair share, level with the cards still waiting their turn', () => {
    // 10 old cards: one full round (10 days) and half of the next (5 days)
    const played = extendSchedule(pool, [], 15, { gap: 1 });
    const waiting = pool.filter((c) => !played.slice(10).includes(c.id)).map((c) => c.id);
    const fresh = Array.from({ length: 5 }, (_, i) => card({ name: `Fresh ${i}`, cost: 60 + i }));
    const next = replan([...pool, ...fresh], played, 15, 25, { gap: 1 }).slice(15);
    // the next ten days are the five old cards still waiting plus the five new ones, in some mix
    expect(new Set(next)).toEqual(new Set([...waiting, ...fresh.map((c) => c.id)]));
    expect(next.slice(0, 5).some((id) => id.startsWith('fresh'))).toBe(true);
  });

  it('never changes today or the locked week when replanning', () => {
    const planned = extendSchedule(pool, [], 30, { gap: 1 });
    const fresh = card({ name: 'Fresh', cost: 70 });
    const after = replan([...pool, fresh], planned, 10, 30, { gap: 1 });
    expect(after.slice(0, 10 + LOCK_DAYS)).toEqual(planned.slice(0, 10 + LOCK_DAYS));
    expect(after.slice(10 + LOCK_DAYS)).toContain(fresh.id);
  });

  it('reports a name that comes back too soon', () => {
    const twins = [card({ name: 'Twin', id: 'twin-a', set: 'First' }), card({ name: 'Twin', id: 'twin-b', set: 'Second' })];
    expect(nameRepeats(twins, ['twin-a', 'twin-b'])).toEqual([[2, 'Twin']]);
  });

  it('decides the daily card, falling back to a hash past its end', () => {
    const s = extendSchedule(pool, [], 5);
    expect(dailyCard(pool, 3, s)!.id).toBe(s[2]);
    expect(dailyCard(pool, 99, s)).not.toBeNull();
  });
});

describe('compare', () => {
  it('marks an exact guess correct everywhere', () => {
    const f = compare(answer, answer, SETS);
    expect(Object.values(f).every((c) => c.verdict === 'correct')).toBe(true);
  });

  it('gives partial and direction clues', () => {
    const f = compare(card({ name: 'Guess', elements: ['Fire'], cost: 4, power: 1, rarity: 'Ordinary', set: 'Third' }), answer, SETS);
    expect(f.elements).toEqual({ verdict: 'partial', direction: null });
    expect(f.type.verdict).toBe('correct');
    expect(f.cost).toEqual({ verdict: 'partial', direction: 'up' });
    expect(f.power).toEqual({ verdict: 'wrong', direction: 'up' });
    expect(f.rarity).toEqual({ verdict: 'wrong', direction: 'up' });
    expect(f.set).toEqual({ verdict: 'wrong', direction: 'down' });
  });

  it('treats a missing cost as its own value', () => {
    const site = card({ name: 'Test Site', type: 'Site', elements: [], cost: null, power: null });
    expect(compare(site, answer, SETS).cost).toEqual({ verdict: 'wrong', direction: null });
    expect(compare(site, site, SETS).elements.verdict).toBe('correct');
  });
});

describe('shareText', () => {
  it('shows squares only, never the card', () => {
    const rows = [compare(card({ name: 'Guess' }), answer, SETS), compare(answer, answer, SETS)];
    const text = shareText(3, rows, true, 'https://example.test/daily');
    expect(text.split('\n')[0]).toBe(`Realmdle #3 2/${MAX_GUESSES}`);
    expect(text).not.toContain('Drake');
    expect(text.split('\n')[2]).toBe('\u{1F7E9}'.repeat(6));
  });
});

describe('suggest', () => {
  const cards = [card({ name: 'Fire Drake' }), card({ name: 'Drake Rider' }), card({ name: 'Water Drake' })];
  it('lists prefix matches before other matches and leaves out guessed cards', () => {
    expect(suggest(cards, 'drake', new Set()).map((c) => c.name)).toEqual(['Drake Rider', 'Fire Drake', 'Water Drake']);
    expect(suggest(cards, 'drake', new Set(['fire-drake'])).map((c) => c.name)).toEqual(['Drake Rider', 'Water Drake']);
  });
});
