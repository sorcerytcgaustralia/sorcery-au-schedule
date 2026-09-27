'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SITE_URL } from '@/lib/config';
import type { ApiError, Board, LeaderboardRow } from '@/lib/realmdle/api';
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

const LABELS: Record<Column, string> = { elements: 'Element', type: 'Type', cost: 'Cost', power: 'Power', rarity: 'Rarity', set: 'Set' };
const DIRECTION_WORDS: Record<Column, [string, string]> = {
  elements: ['', ''],
  type: ['', ''],
  cost: ['higher', 'lower'],
  power: ['higher', 'lower'],
  rarity: ['rarer', 'more common'],
  set: ['newer', 'older'],
};

// In-browser mode keeps its own small record; server mode computes stats from every play.
type Stats = { played: number; won: number; streak: number; best: number; lastPlayed: number; lastWon: number; dist: number[] };
const EMPTY_STATS: Stats = { played: 0, won: 0, streak: 0, best: 0, lastPlayed: 0, lastWon: 0, dist: Array(MAX_GUESSES).fill(0) };
// v3: guesses are a card in a set (C000001-002), no longer just a card
const STATE_KEY = 'realmdle:v3:state';
const STATS_KEY = 'realmdle:v3:stats';

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

type Row = { card: Card; feedback: Feedback };
type ShownStats = { played: number; winRate: number; currentStreak: number; maxStreak: number; averageGuesses: number | null };

/** What the page needs, whether the puzzle is scored in the browser or by the server. */
type Game = {
  mode: 'local' | 'server';
  puzzle: number;
  rows: Row[];
  over: boolean;
  won: boolean;
  /** Only shown once the puzzle is over; the server only sends it then. */
  answer: Card | null;
  hint: string[] | null;
  stats: ShownStats | null;
  busy: boolean;
  error: string | null;
  submit: (card: Card) => void;
};

/** The original game: answer from the committed schedule, progress in this browser only. */
function useLocalGame(data: CardData, schedule: string[], byId: Map<string, Card>, enabled: boolean): Game | null {
  // The date is only known in the browser; render nothing date-specific
  // until mounted so the static HTML and the first client render agree.
  const [puzzle, setPuzzle] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  useEffect(() => {
    if (!enabled) return;
    const today = puzzleNumber(new Date());
    const saved = load(STATE_KEY, { puzzle: 0, guesses: [] as string[] });
    setPuzzle(today);
    setGuesses(saved.puzzle === today ? saved.guesses.filter((id) => byId.has(id)) : []);
    setStats(load(STATS_KEY, EMPTY_STATS));
  }, [byId, enabled]);

  const answer = useMemo(() => (puzzle === null ? null : dailyCard(data.cards, puzzle, schedule)), [data.cards, puzzle, schedule]);
  const rows = useMemo(
    () => (answer ? guesses.map((id) => byId.get(id)!).map((card) => ({ card, feedback: compare(card, answer, data.sets) })) : []),
    [answer, guesses, byId, data.sets],
  );
  if (!enabled || puzzle === null || !answer) return null;
  const won = guesses.includes(answer.id);
  const over = won || guesses.length >= MAX_GUESSES;
  const solvedIn = stats.dist.reduce((sum, n, i) => sum + n * (i + 1), 0);

  return {
    mode: 'local',
    puzzle,
    rows,
    over,
    won,
    answer,
    hint: guesses.length >= HINT_AFTER ? answer.subtypes : null,
    stats: {
      played: stats.played,
      winRate: stats.played ? Math.round((stats.won / stats.played) * 100) : 0,
      currentStreak: stats.streak,
      maxStreak: stats.best,
      averageGuesses: stats.won ? Math.round((solvedIn / stats.won) * 10) / 10 : null,
    },
    busy: false,
    error: null,
    submit(card) {
      if (over || guesses.includes(card.id)) return;
      const next = [...guesses, card.id];
      setGuesses(next);
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
    },
  };
}

type ServerState = { status: 'checking' } | { status: 'unavailable' } | { status: 'ready'; board: Board };

async function api<T>(path: string, init?: RequestInit): Promise<{ ok: true; body: T } | { ok: false; error: ApiError }> {
  try {
    const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...init?.headers }, credentials: 'same-origin' });
    const body = await res.json();
    return res.ok ? { ok: true, body: body as T } : { ok: false, error: body as ApiError };
  } catch {
    return { ok: false, error: { code: 'not_configured', error: 'The Realmdle server could not be reached.' } };
  }
}

/** Accounts mode: the server holds the answer, scores guesses and keeps every play, keyed by Discord id. */
function useServerGame(byId: Map<string, Card>) {
  const [state, setState] = useState<ServerState>({ status: 'checking' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await api<Board>('/api/today');
    // anything but a working API (static preview, not set up yet, offline) means play in the browser
    setState(res.ok ? { status: 'ready', board: res.body } : { status: 'unavailable' });
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  async function post(path: string, body: unknown, method = 'POST') {
    setBusy(true);
    setError(null);
    const res = await api<Board>(path, { method, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) setState({ status: 'ready', board: res.body });
    else {
      setError(res.error.error);
      if (res.error.code === 'stale_puzzle' || res.error.code === 'conflict') reload();
    }
    return res.ok;
  }

  const board = state.status === 'ready' ? state.board : null;
  const game: Game | null = board
    ? {
        mode: 'server',
        puzzle: board.puzzle,
        rows: board.guesses.flatMap(({ id, feedback }) => {
          const card = byId.get(id);
          return card ? [{ card, feedback }] : [];
        }),
        over: board.over,
        won: board.won,
        answer: board.answer ? (byId.get(board.answer) ?? null) : null,
        hint: board.hint,
        stats: board.stats,
        busy,
        error,
        submit(card) {
          if (!busy && !board.over) post('/api/guess', { puzzle: board.puzzle, cardId: card.id });
        },
      }
    : null;

  return {
    state,
    game,
    board,
    setLeaderboard: (on: boolean) => post('/api/settings', { leaderboard: on }),
    async signOut() {
      await api('/api/auth/logout', { method: 'POST', body: '{}' });
      reload();
    },
    async deleteData() {
      const res = await api('/api/me', { method: 'DELETE', body: '{}' });
      if (!res.ok) setError(res.error.error);
      reload();
    },
  };
}

function StatsList({ stats }: { stats: ShownStats }) {
  return (
    <dl className="rd-stats info">
      <div>
        <dt>Played</dt>
        <dd>{stats.played}</dd>
      </div>
      <div>
        <dt>Won</dt>
        <dd>{stats.winRate}%</dd>
      </div>
      <div>
        <dt>Streak</dt>
        <dd>{stats.currentStreak}</dd>
      </div>
      <div>
        <dt>Best</dt>
        <dd>{stats.maxStreak}</dd>
      </div>
      <div>
        <dt>Avg guesses</dt>
        <dd>{stats.averageGuesses ?? 'None'}</dd>
      </div>
    </dl>
  );
}

function Leaderboard({ refreshKey }: { refreshKey: string }) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  useEffect(() => {
    api<LeaderboardRow[]>('/api/leaderboard').then((res) => setRows(res.ok ? res.body : []));
  }, [refreshKey]);
  if (!rows) return null;
  return (
    <section className="rd-leaderboard" aria-labelledby="rd-lb-title">
      <h2 id="rd-lb-title" className="rd-section-title">
        Leaderboard
      </h2>
      {rows.length === 0 ? (
        <p className="rd-muted">Nobody has joined the leaderboard yet. Tick the box under your result to be the first.</p>
      ) : (
        <table className="rd-lb-table info">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Player</th>
              <th scope="col">Streak</th>
              <th scope="col">Best</th>
              <th scope="col">Won</th>
              <th scope="col">Played</th>
              <th scope="col">Avg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}-${i}`} className={r.you ? 'rd-lb-you' : undefined}>
                <td>{i + 1}</td>
                <td className="rd-lb-name">{r.name}</td>
                <td>{r.currentStreak}</td>
                <td>{r.maxStreak}</td>
                <td>{r.winRate}%</td>
                <td>{r.played}</td>
                <td>{r.averageGuesses ?? 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function Realmdle({ data, schedule }: { data: CardData; schedule: string[] }) {
  const byId = useMemo(() => new Map(data.cards.map((c) => [c.id, c])), [data.cards]);
  const server = useServerGame(byId);
  const local = useLocalGame(data, schedule, byId, server.state.status === 'unavailable');
  const game = server.game ?? local;
  const board = server.board;

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const [signinFailed, setSigninFailed] = useState(false);
  const [leaderboardPending, setLeaderboardPending] = useState<boolean | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSigninFailed(new URLSearchParams(window.location.search).get('signin') === 'failed');
  }, []);

  const guessed = useMemo(() => new Set(game?.rows.map((r) => r.card.id)), [game?.rows]);
  const options = useMemo(() => suggest(data.cards, query, guessed), [data.cards, query, guessed]);

  function submit(card: Card | undefined) {
    if (!card || !game || game.over || guessed.has(card.id)) return;
    game.submit(card);
    setQuery('');
    setActive(0);
    requestAnimationFrame(() => input.current?.focus());
  }

  async function share() {
    if (!game) return;
    const text = shareText(game.puzzle, game.rows.map((r) => r.feedback), game.won, `${SITE_URL}/daily`);
    try {
      await navigator.clipboard.writeText(text);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  }

  if (!data.cards.length) {
    return <p className="hall-note">The card pool has not been loaded yet. It is fetched from the Sorcery Card Registry, so check back after the next update.</p>;
  }
  if (!game) return <p className="hall-note">Shuffling the deck.</p>;

  const { puzzle, rows, over, won, answer, hint, stats } = game;
  const signedOut = game.mode === 'server' && !board?.player;
  const listId = 'rd-options';
  return (
    <div className="rd">
      <p className="rd-meta info">
        <span>Puzzle {puzzle}</span>
        {!signedOut && (
          <span>
            Guess {Math.min(rows.length + (over ? 0 : 1), MAX_GUESSES)} of {MAX_GUESSES}
          </span>
        )}
        {board && board.community.finished > 0 && (
          <span>
            {board.community.finished} played today, {board.community.solved} solved
          </span>
        )}
      </p>

      {signedOut && (
        <div className="rd-signin">
          <p>Sign in with Discord to play. Your streak and stats are kept with your Discord account, so they follow you to any device.</p>
          <p className="rd-muted info">
            Realmdle stores your Discord id and display name and the cards you guess, nothing else. The leaderboard is opt-in, and you can delete your data at any
            time.
          </p>
          {signinFailed && <p className="rd-error">Signing in with Discord did not work. Please try again.</p>}
          <a className="btn" href="/api/auth/discord">
            Sign in with Discord
          </a>
        </div>
      )}

      {!over && !signedOut && (
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
            aria-busy={game.busy}
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
                  <span className="rd-option-type info">
                    {card.set}, {card.type}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {hint && (
            <p className="rd-hint" role="status">
              <span className="rd-hint-label info">Last guess, a hint</span>
              {hint.length ? (
                <>
                  The card is a <strong>{hint.join(' ')}</strong>.
                </>
              ) : (
                <>The card has no subtype.</>
              )}
            </p>
          )}
        </div>
      )}

      {game.error && (
        <p className="rd-error" role="alert">
          {game.error}
        </p>
      )}

      {over && answer && (
        <div className="rd-result">
          {answer.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="rd-art" src={answer.image} alt={answer.name} loading="lazy" />
          )}
          <div className="rd-result-body">
            <p className="rd-result-line info">{won ? `Solved in ${rows.length}` : 'Out of guesses. The card was'}</p>
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
              <textarea className="rd-share-text" readOnly rows={rows.length + 2} value={shareText(puzzle, rows.map((r) => r.feedback), won, `${SITE_URL}/daily`)} />
            )}
            {stats && <StatsList stats={stats} />}
            {game.mode === 'local' && <p className="rd-muted info">Stats are kept in this browser only.</p>}
            {board?.player && (
              <label className="rd-toggle info">
                <input
                  type="checkbox"
                  checked={leaderboardPending ?? board.player.leaderboard}
                  disabled={leaderboardPending !== null}
                  onChange={async (e) => {
                    // tick at once; the server's answer then confirms it or puts it back
                    setLeaderboardPending(e.target.checked);
                    await server.setLeaderboard(e.target.checked);
                    setLeaderboardPending(null);
                  }}
                />
                Show me on the leaderboard as {board.player.name}
              </label>
            )}
            <Countdown />
          </div>
        </div>
      )}

      <ol className="rd-board" aria-label="Your guesses" reversed>
        {[...rows].reverse().map(({ card, feedback }) => (
          <li key={card.id} className="rd-row">
            <p className={`rd-name${won && answer && card.id === answer.id ? ' rd-name-hit' : ''}`}>
              {card.name}
              <span className="rd-name-set info">{card.set}</span>
            </p>
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
        <span>Each set counts as its own card: Apprentice Wizard from Alpha and from Beta are different answers</span>
      </div>

      {game.mode === 'server' && <Leaderboard refreshKey={`${board?.player?.leaderboard}-${over}`} />}

      {board?.player && (
        <p className="rd-account info">
          Signed in as {board.player.name}.{' '}
          <button type="button" className="quiet-link" onClick={() => server.signOut()}>
            Sign out
          </button>{' '}
          or{' '}
          <button
            type="button"
            className="quiet-link"
            onClick={() => {
              if (window.confirm('Delete your Realmdle stats and every game you have played? This cannot be undone.')) server.deleteData();
            }}
          >
            delete my Realmdle data
          </button>
          .
        </p>
      )}
    </div>
  );
}
