// Realmdle rules, kept free of React and the DOM so they can be tested.
//
// Everyone gets the same card on the same day without a server: the puzzle
// number comes from the date in Sydney, and the answer is chosen from the
// card pool by hashing that number together with each card's id.

import { ELEMENTS, RARITIES, type Card } from './types';

export const MAX_GUESSES = 8;
export const TIME_ZONE = 'Australia/Sydney';
/** Puzzle #1. */
const EPOCH = Date.UTC(2026, 8, 28);
const DAY_MS = 86_400_000;

/** The calendar date in Sydney as [year, month (1-12), day]. */
export function sydneyDate(now: Date): [number, number, number] {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [y, m, d] = parts.split('-').map(Number);
  return [y, m, d];
}

/** Days since puzzle #1, negative before launch. */
function dayIndex(now: Date): number {
  const [y, m, d] = sydneyDate(now);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS);
}

export function puzzleNumber(now: Date): number {
  return Math.max(1, dayIndex(now) + 1);
}

/** Milliseconds until the next puzzle, which starts at midnight in Sydney. */
export function msUntilNextPuzzle(now: Date): number {
  const current = dayIndex(now);
  // Sydney is UTC+10 or +11, so the next midnight is 13 to 38 hours after
  // the current UTC midnight. Step forward by the hour until the number ticks.
  let t = Math.floor(now.getTime() / 3_600_000) * 3_600_000;
  while (dayIndex(new Date(t)) === current) t += 3_600_000;
  return t - now.getTime();
}

/** FNV-1a then a murmur3 finaliser: a cheap hash that spreads well. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Cards that can be the answer: enough data to give fair clues. */
export function answerPool(cards: Card[]): Card[] {
  return cards.filter((c) => c.rarity !== null && c.set !== '');
}

/**
 * Rendezvous hashing: every card gets a score for today and the highest
 * wins. Unlike `pool[n % pool.length]`, adding a new set only changes the
 * answer on days where one of the new cards happens to score highest, so a
 * rebuild in the middle of the day almost never swaps today's card.
 */
export function dailyCard(cards: Card[], puzzle: number): Card | null {
  let best: Card | null = null;
  let bestScore = -1;
  for (const card of answerPool(cards)) {
    const score = hash(`realmdle:${puzzle}:${card.id}`);
    if (score > bestScore || (score === bestScore && best !== null && card.id < best.id)) {
      best = card;
      bestScore = score;
    }
  }
  return best;
}

export type Verdict = 'correct' | 'partial' | 'wrong';
/** Which way the answer lies from the guess: up means higher, later or rarer. */
export type Direction = 'up' | 'down' | null;
export type Clue = { verdict: Verdict; direction: Direction };

export const COLUMNS = ['elements', 'type', 'cost', 'power', 'rarity', 'set'] as const;
export type Column = (typeof COLUMNS)[number];
export type Feedback = Record<Column, Clue>;

function ordinal(guess: number, answer: number, closeWithin: number): Clue {
  if (guess === answer) return { verdict: 'correct', direction: null };
  const direction = answer > guess ? 'up' : 'down';
  return { verdict: Math.abs(answer - guess) <= closeWithin ? 'partial' : 'wrong', direction };
}

function nullableNumber(guess: number | null, answer: number | null): Clue {
  if (guess === null || answer === null) return { verdict: guess === answer ? 'correct' : 'wrong', direction: null };
  return ordinal(guess, answer, 1);
}

function elementClue(guess: Card['elements'], answer: Card['elements']): Clue {
  const same = guess.length === answer.length && guess.every((e) => answer.includes(e));
  if (same) return { verdict: 'correct', direction: null };
  return { verdict: guess.some((e) => answer.includes(e)) ? 'partial' : 'wrong', direction: null };
}

export function compare(guess: Card, answer: Card, sets: string[]): Feedback {
  const rank = (r: Card['rarity']) => (r === null ? -1 : RARITIES.indexOf(r));
  return {
    elements: elementClue(guess.elements, answer.elements),
    type: { verdict: guess.type === answer.type ? 'correct' : 'wrong', direction: null },
    cost: nullableNumber(guess.cost, answer.cost),
    power: nullableNumber(guess.power, answer.power),
    rarity: ordinal(rank(guess.rarity), rank(answer.rarity), 0),
    set: ordinal(sets.indexOf(guess.set), sets.indexOf(answer.set), 0),
  };
}

const SQUARE: Record<Verdict, string> = { correct: '\u{1F7E9}', partial: '\u{1F7E8}', wrong: '⬛' };

/**
 * The spoiler-free result people paste into Discord. Emoji squares are the
 * genre's convention and render natively there; the page itself uses none.
 */
export function shareText(puzzle: number, rows: Feedback[], won: boolean, url: string): string {
  const score = won ? `${rows.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const grid = rows.map((row) => COLUMNS.map((c) => SQUARE[row[c].verdict]).join('')).join('\n');
  return `Realmdle #${puzzle} ${score}\n${grid}\n${url}`;
}

export function formatElements(elements: Card['elements']): string {
  return elements.length ? [...elements].sort((a, b) => ELEMENTS.indexOf(a) - ELEMENTS.indexOf(b)).join(' ') : 'None';
}

/** Names that match what has been typed: prefix matches first, then anywhere. */
export function suggest(cards: Card[], query: string, exclude: Set<string>, limit = 8): Card[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: Card[] = [];
  const contains: Card[] = [];
  for (const card of cards) {
    if (exclude.has(card.id)) continue;
    const name = card.name.toLowerCase();
    if (name.startsWith(q)) starts.push(card);
    else if (name.includes(q)) contains.push(card);
  }
  const byName = (a: Card, b: Card) => a.name.localeCompare(b.name);
  return [...starts.sort(byName), ...contains.sort(byName)].slice(0, limit);
}
