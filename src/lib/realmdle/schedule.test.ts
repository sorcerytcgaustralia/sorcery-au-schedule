// Checks the committed card pool and schedule, so a bad schedule fails the
// build (CI runs the tests before deploying) instead of reaching players.
import { describe, expect, it } from 'vitest';
import cardData from '../../data/cards.json';
import scheduleData from '../../data/schedule.json';
import { NAME_GAP, answerPool, nameRepeats } from './engine';
import type { CardData } from './types';

const { cards } = cardData as CardData;
const { answers } = scheduleData;

describe('committed schedule', () => {
  it('covers at least a year', () => {
    expect(answers.length).toBeGreaterThanOrEqual(365);
  });

  it('only schedules cards that are the one card fitting all six clues', () => {
    const eligible = new Set(answerPool(cards).map((c) => c.id));
    expect(answers.filter((id) => !eligible.has(id))).toEqual([]);
  });

  it(`never repeats a card name within ${NAME_GAP} days, in any set`, () => {
    expect(nameRepeats(cards, answers)).toEqual([]);
  });
});
