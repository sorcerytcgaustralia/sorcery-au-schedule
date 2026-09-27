// Turns the Sorcery Card Registry export (KairosArchive's `registry.json`)
// into Realmdle's `Card` shape. This is the only file that knows that
// format; see https://github.com/sadkinglabs/sorcery-registry for the schema.

import { ELEMENTS, RARITIES, type Card, type CardData, type Element, type Rarity } from './types';

/** The parts of a registry v3 export Realmdle reads. */
export type RegistryExport = {
  sets: { set_code: string; set_name: string; released_at: string; kind: string }[];
  cards: {
    codex_id: string;
    name: string;
    type: string;
    category: string;
    rarity: string | null;
    /** ["None"] for colourless cards. */
    elements: string[];
    cost: number | null;
    power: number | null;
    set_codes: string[];
    image_urls: { normal: string } | null;
  }[];
};

const isElement = (e: string): e is Element => (ELEMENTS as readonly string[]).includes(e);
const isRarity = (r: string | null): r is Rarity => r !== null && (RARITIES as readonly string[]).includes(r);

export function normalise(registry: RegistryExport, source: string, fetchedAt: string, sha256: string | null): CardData {
  // Release sets oldest first. Promo sets are left out: they are dated
  // before Alpha, which would make "older" and "newer" clues meaningless.
  const releases = registry.sets.filter((s) => s.kind === 'release').sort((a, b) => a.released_at.localeCompare(b.released_at));
  const setName = new Map(releases.map((s) => [s.set_code, s.set_name]));
  const order = releases.map((s) => s.set_code);

  const cards: Card[] = [];
  for (const c of registry.cards) {
    if (c.category === 'Token') continue;
    // first printing in a release set; the handful of promo-only cards are skipped
    const first = order.find((code) => c.set_codes.includes(code));
    if (!first) continue;
    cards.push({
      id: c.codex_id,
      name: c.name,
      type: c.type,
      elements: ELEMENTS.filter((e) => c.elements.filter(isElement).includes(e)),
      cost: c.cost,
      power: c.power,
      rarity: isRarity(c.rarity) ? c.rarity : null,
      set: setName.get(first)!,
      image: c.image_urls?.normal ?? null,
    });
  }
  cards.sort((a, b) => a.name.localeCompare(b.name));
  return { fetchedAt, source, sha256, sets: releases.map((s) => s.set_name), cards };
}
