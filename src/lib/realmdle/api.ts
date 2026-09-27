// The shapes the Realmdle API (worker/) sends to the page. Shared so the
// browser and the Worker cannot disagree about them.

import type { Feedback } from './engine';
import type { PlayerStats } from './stats';

export type Board = {
  puzzle: number;
  /** YYYY-MM-DD in Sydney. */
  date: string;
  /** Null when signed out. */
  player: { name: string; leaderboard: boolean } | null;
  guesses: { id: string; feedback: Feedback }[];
  over: boolean;
  won: boolean;
  /** The answer's subtypes, once the last guess is reached. */
  hint: string[] | null;
  /** The answer's card id, only once the puzzle is over. */
  answer: string | null;
  stats: PlayerStats | null;
  /** Everyone who has finished today's puzzle, anonymously. */
  community: { finished: number; solved: number };
};

export type LeaderboardRow = {
  name: string;
  currentStreak: number;
  maxStreak: number;
  winRate: number;
  played: number;
  averageGuesses: number | null;
  you: boolean;
};

export type ApiErrorCode = 'not_configured' | 'signed_out' | 'stale_puzzle' | 'bad_guess' | 'over' | 'conflict' | 'forbidden' | 'not_found' | 'server';
export type ApiError = { error: string; code: ApiErrorCode };
