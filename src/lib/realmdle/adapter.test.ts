import { describe, expect, it } from 'vitest';
import { normalise, type RegistryExport } from './adapter';

// Made-up records in the registry v3 export shape.
const record = (over: Partial<RegistryExport['cards'][number]>): RegistryExport['cards'][number] => ({
  codex_id: 'C000001',
  name: 'Test Imp',
  type: 'Minion',
  category: 'Spell',
  rarity: 'Ordinary',
  subtypes: ['Demon'],
  elements: ['Fire'],
  cost: 2,
  power: 1,
  set_codes: ['001'],
  image_urls: { normal: 'https://img.test/imp.webp' },
  ...over,
});

const registry: RegistryExport = {
  sets: [
    { set_code: '002', set_name: 'Second', released_at: '2024-01-01', kind: 'release' },
    { set_code: '001', set_name: 'First', released_at: '2023-01-01', kind: 'release' },
    { set_code: '999', set_name: 'Promo', released_at: '2022-01-01', kind: 'promo' },
  ],
  cards: [
    record({ codex_id: 'C000002', name: 'Test Tower', type: 'Site', category: 'Site', elements: ['None'], cost: null, power: null, set_codes: ['999', '002'] }),
    record({ codex_id: 'C000003', name: 'Test Token', category: 'Token' }),
    record({ codex_id: 'C000004', name: 'Promo Only', set_codes: ['999'] }),
    record({ codex_id: 'C000005', name: 'Test Avatar', type: 'Avatar', category: 'Avatar', rarity: null, elements: ['Water', 'Air'], image_urls: null }),
    record({}),
    record({ codex_id: 'C000006', name: 'Test Reprint', cost: 5, set_codes: ['002', '001', '999'] }),
  ],
};

describe('normalise', () => {
  const data = normalise(registry, 'src', 'now', 'abc');

  it('orders release sets by date and leaves promos out', () => {
    expect(data.sets).toEqual(['First', 'Second']);
  });

  it('maps cards, dropping tokens and promo-only cards', () => {
    expect(data.cards.map((c) => c.name)).toEqual(['Test Avatar', 'Test Imp', 'Test Reprint', 'Test Tower']);
  });

  it('turns "None" into no elements, sorts elements and uses the first release printing', () => {
    const byName = Object.fromEntries(data.cards.map((c) => [c.name, c]));
    expect(byName['Test Tower']).toEqual({ id: 'C000002', name: 'Test Tower', type: 'Site', elements: [], cost: null, power: null, rarity: 'Ordinary', subtypes: ['Demon'], set: 'Second', image: 'https://img.test/imp.webp' });
    // printed in both release sets and a promo: only its first release set counts
    expect(byName['Test Reprint'].set).toBe('First');
    expect(byName['Test Avatar']).toMatchObject({ elements: ['Air', 'Water'], rarity: null, image: null });
  });
});
