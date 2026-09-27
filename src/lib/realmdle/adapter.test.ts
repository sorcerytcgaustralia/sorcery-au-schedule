import { describe, expect, it } from 'vitest';
import { normalise } from './adapter';

// Made-up records in the two shapes the adapter accepts.
describe('normalise', () => {
  it('reads flat records wrapped in { data }', () => {
    const body = {
      data: [
        { name: 'Test Imp', type: 'minion', elements: 'Fire, Water', cost: '2', attack: 1, rarity: 'ordinary', set: 'Second', image: 'https://img.test/imp.png' },
        { name: 'Test Tower', type: 'Site', element: null, rarity: 'Exceptional', set: 'First' },
        { title: 'no type, skipped' },
      ],
    };
    const data = normalise(body, 'src', 'now');
    expect(data.cards).toEqual([
      { id: 'test-imp', name: 'Test Imp', type: 'Minion', elements: ['Fire', 'Water'], cost: 2, power: 1, rarity: 'Ordinary', set: 'Second', image: 'https://img.test/imp.png' },
      { id: 'test-tower', name: 'Test Tower', type: 'Site', elements: [], cost: null, power: null, rarity: 'Exceptional', set: 'First', image: null },
    ]);
  });

  it('reads nested records, keeps the first printing and orders sets by release', () => {
    const body = [
      {
        name: 'Test Knight',
        guardian: { type: 'Minion', rarity: 'Elite', cost: 4, attack: 4, thresholds: { air: 0, earth: 2, fire: 0, water: 0 } },
        sets: [
          { name: 'Reprint', releasedAt: '2025-01-01', variants: [] },
          { name: 'Original', releasedAt: '2023-05-01', variants: [] },
        ],
      },
    ];
    const data = normalise(body, 'src', 'now');
    expect(data.cards[0]).toMatchObject({ type: 'Minion', elements: ['Earth'], cost: 4, power: 4, rarity: 'Elite', set: 'Original' });
    expect(data.sets).toEqual(['Original']);
  });

  it('returns nothing for a shape it does not know', () => {
    expect(normalise({ message: 'hello' }, 'src', 'now').cards).toEqual([]);
  });
});
