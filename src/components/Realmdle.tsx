'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SITE_URL } from '@/lib/config';
import {
  COLUMNS,
  HINT_AFTER,
  MAX_GUESSES,
  compare,
  dailyCard,
  formatElements,
  msUntilNextPuzzle,
  puzzleNumber,
  shareText,
  suggest,
  type Clue,
  type Column,
  type Feedback,
} from '@/lib/realmdle/engine';
import type { Card, CardData } from '@/lib/realmdle/types';

const LABELS: Record<Column, string> = { elements: 'Element', type: 'Type', cost: 'Cost', power: 'Power', rarity: 'Rarity', set: 'First set' };
const DIRECTION_WORDS: Record<Column, [string, string]> = {
  elements: ['', ''],
  type: ['', ''],
  cost: ['higher', 'lower'],
  power: ['higher', 'lower'],
  rarity: ['rarer', 'more common'],
  set: ['newer', 'older'],
};

type Stats = { played: number; won: number; streak: number; best: number; lastPlayed: number; lastWon: number; dist: number[] };
const EMPTY_STATS: Stats = { played: 0, won: 0, streak: 0, best: 0, lastPlayed: 0, lastWon: 0, dist: Array(MAX_GUESSES).fill(0) };
// v2: six guesses instead of eight, so v1 boards and score spreads do not carry over
const STATE_KEY = 'realmdle:v2:state';
const STATS_KEY = 'realmdle:v2:stats';

// Storage can be missing or throw (private windows, blocked site data), so
// the game must work without it; it only costs the streak.
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* play on without saving */
  }
}

function value(card: Card, column: Column): string {
  switch (column) {
    case 'elements':
      return formatElements(card.elements);
    case 'cost':
    case 'power':
      return card[column] === null ? 'None' : String(card[column]);
    case 'rarity':
      return card.rarity ?? 'None';
    default:
      return card[column];
  }
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg className="rd-chevron" viewBox="0 0 12 8" width="12" height="8" aria-hidden="true">
      <path d={up ? 'M1 7 6 2l5 5' : 'M1 1l5 5 5-5'} fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function Tile({ card, column, clue }: { card: Card; column: Column; clue: Clue }) {
  const hint = clue.direction ? DIRECTION_WORDS[column][clue.direction === 'up' ? 0 : 1] : '';
  const verdictWord = clue.verdict === 'correct' ? 'match' : clue.verdict === 'partial' ? 'close' : 'no match';
  return (
    <div className={`rd-tile rd-${clue.verdict}`}>
      <span className="rd-tile-label info" aria-hidden="true">
        {LABELS[column]}
      </span>
      <span className="rd-tile-value">{value(card, column)}</span>
      {clue.direction && <Chevron up={clue.direction === 'up'} />}
      <span className="sr-only">
        {LABELS[column]}: {verdictWord}
        {hint && `, answer is ${hint}`}.
      </span>
    </div>
  );
}

function Countdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(msUntilNextPuzzle(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (left === null) return null;
  const s = Math.floor(left / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <p className="rd-next info">
      Next card in {Math.floor(s / 3600)}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}
    </p>
  );
}

export function Realmdle({ data, schedule }: { data: CardData; schedule: string[] }) {
  const byId = useMemo(() => new Map(data.cards.map((c) => [c.id, c])), [data.cards]);
  // The date is only known in the browser; render nothing date-specific
  // until mounted so the static HTML and the first client render agree.
  const [puzzle, setPuzzle] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const today = puzzleNumber(new Date());
    const saved = load(STATE_KEY, { puzzle: 0, guesses: [] as string[] });
    setPuzzle(today);
    setGuesses(saved.puzzle === today ? saved.guesses.filter((id) => byId.has(id)) : []);
    setStats(load(STATS_KEY, EMPTY_STATS));
  }, [byId]);

  const answer = useMemo(() => (puzzle === null ? null : dailyCard(data.cards, puzzle, schedule)), [data.cards, puzzle, schedule]);
  const rows = useMemo(
    () => (answer ? guesses.map((id) => byId.get(id)!).map((card) => ({ card, feedback: compare(card, answer, data.sets) })) : []),
    [answer, guesses, byId, data.sets],
  );
  const won = answer !== null && guesses.includes(answer.id);
  const over = won || guesses.length >= MAX_GUESSES;
  const options = useMemo(() => suggest(data.cards, query, new Set(guesses)), [data.cards, query, guesses]);

  function submit(card: Card | undefined) {
    if (!card || !answer || puzzle === null || over || guesses.includes(card.id)) return;
    const next = [...guesses, card.id];
    setGuesses(next);
    setQuery('');
    setActive(0);
    save(STATE_KEY, { puzzle, guesses: next });

    const solved = card.id === answer.id;
    if ((solved || next.length >= MAX_GUESSES) && stats.lastPlayed !== puzzle) {
      const dist = [...stats.dist];
      if (solved) dist[next.length - 1] += 1;
      const streak = solved ? (stats.lastWon === puzzle - 1 ? stats.streak + 1 : 1) : 0;
      const updated: Stats = {
        played: stats.played + 1,
        won: stats.won + (solved ? 1 : 0),
        streak,
        best: Math.max(stats.best, streak),
        lastPlayed: puzzle,
        lastWon: solved ? puzzle : stats.lastWon,
        dist,
      };
      setStats(updated);
      save(STATS_KEY, updated);
    }
    requestAnimationFrame(() => input.current?.focus());
  }

  async function share() {
    if (puzzle === null) return;
    const text = shareText(puzzle, rows.map((r) => r.feedback as Feedback), won, `${SITE_URL}/daily`);
    try {
      await navigator.clipboard.writeText(text);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  }

  if (!data.cards.length) {
    return <p className="hall-note">The card pool has not been loaded yet. It is fetched from the Sorcery Card Registry when the site is built, so check back after the next deploy.</p>;
  }
  if (puzzle === null || !answer) return <p className="hall-note">Shuffling the deck.</p>;

  const listId = 'rd-options';
  return (
    <div className="rd">
      <p className="rd-meta info">
        <span>Puzzle {puzzle}</span>
        <span>
          Guess {Math.min(guesses.length + (over ? 0 : 1), MAX_GUESSES)} of {MAX_GUESSES}
        </span>
      </p>

      {!over && (
        <div className="rd-search">
          <label className="sr-only" htmlFor="rd-input">
            Guess a card
          </label>
          <input
            id="rd-input"
            ref={input}
            className="rd-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="Type a card name"
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-activedescendant={options.length ? `rd-opt-${active}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, options.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                submit(options[active]);
              } else if (e.key === 'Escape') {
                setQuery('');
              }
            }}
          />
          {options.length > 0 && (
            <ul className="rd-options" id={listId} role="listbox">
              {options.map((card, i) => (
                <li
                  key={card.id}
                  id={`rd-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? 'active' : undefined}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    submit(card);
                  }}
                >
                  <span>{card.name}</span>
                  <span className="rd-option-type info">{card.type}</span>
                </li>
              ))}
            </ul>
          )}
          {guesses.length >= HINT_AFTER && (
            <p className="rd-hint" role="status">
              <span className="rd-hint-label info">Last guess, a hint</span>
              {answer.subtypes.length ? (
                <>
                  The card is a <strong>{answer.subtypes.join(' ')}</strong>.
                </>
              ) : (
                <>The card has no subtype.</>
              )}
            </p>
          )}
        </div>
      )}

      {over && (
        <div className="rd-result">
          {answer.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="rd-art" src={answer.image} alt={answer.name} loading="lazy" />
          )}
          <div className="rd-result-body">
            <p className="rd-result-line info">{won ? `Solved in ${guesses.length}` : 'Out of guesses. The card was'}</p>
            <h2 className="rd-answer">{answer.name}</h2>
            <p className="rd-answer-meta info">
              {[answer.subtypes.length ? `${answer.type}, ${answer.subtypes.join(' ')}` : answer.type, formatElements(answer.elements), answer.rarity, answer.set].filter(Boolean).join(', ')}
            </p>
            <div className="rd-actions">
              <button type="button" className="btn" onClick={share}>
                {copied === 'done' ? 'Copied, paste it in Discord' : 'Copy result'}
              </button>
            </div>
            {copied === 'failed' && <p className="rd-copy-failed info">Could not reach the clipboard. Select the result and copy it instead.</p>}
            {copied === 'failed' && (
              <textarea className="rd-share-text" readOnly rows={guesses.length + 2} value={shareText(puzzle, rows.map((r) => r.feedback), won, `${SITE_URL}/daily`)} />
            )}
            <dl className="rd-stats info">
              <div>
                <dt>Played</dt>
                <dd>{stats.played}</dd>
              </div>
              <div>
                <dt>Won</dt>
                <dd>{stats.played ? Math.round((stats.won / stats.played) * 100) : 0}%</dd>
              </div>
              <div>
                <dt>Streak</dt>
                <dd>{stats.streak}</dd>
              </div>
              <div>
                <dt>Best</dt>
                <dd>{stats.best}</dd>
              </div>
            </dl>
            <Countdown />
          </div>
        </div>
      )}

      <ol className="rd-board" aria-label="Your guesses" reversed>
        {[...rows].reverse().map(({ card, feedback }) => (
          <li key={card.id} className="rd-row">
            <p className={`rd-name${card.id === answer.id ? ' rd-name-hit' : ''}`}>{card.name}</p>
            <div className="rd-tiles">
              {COLUMNS.map((column) => (
                <Tile key={column} card={card} column={column} clue={feedback[column]} />
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="rd-legend info">
        <span>
          <i className="rd-swatch rd-correct" /> Match
        </span>
        <span>
          <i className="rd-swatch rd-partial" /> Close: shares an element, or cost and power within one
        </span>
        <span>
          <i className="rd-swatch rd-wrong" /> No match
        </span>
        <span>
          <Chevron up /> The answer is higher, rarer or from a newer set
        </span>
        <span>First set is where a card was first printed; reprints do not count</span>
      </div>
    </div>
  );
}
