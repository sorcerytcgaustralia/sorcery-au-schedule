// Turns the card API's JSON into Realmdle's `Card` shape.
//
// This is the only file that knows what the upstream response looks like.
// It was written before the KairosArchive response could be inspected, so
// it accepts the common shapes: a flat record per card
// ({ name, type, elements, cost, attack, rarity, set }) and the nested
// Curiosa-style record ({ name, elements, guardian: {...}, sets: [{ name,
// releasedAt, variants: [...] }] }). If a build logs "0 cards parsed",
// compare a record against `pick` below and adjust the field names.

import { ELEMENTS, RARITIES, type Card, type CardData, type Element, type Rarity } from './types';

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The first of several possible paths that holds a value. */
function pick(record: Raw, ...paths: string[]): unknown {
  for (const path of paths) {
    let value: unknown = record;
    for (const key of path.split('.')) value = isObject(value) ? value[key] : Array.isArray(value) ? value[Number(key)] : undefined;
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function toElements(record: Raw): Element[] {
  const raw = pick(record, 'elements', 'element');
  const names = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? raw.split(/[\s,/&]+/) : [];
  let found = names.map(titleCase).filter((n): n is Element => (ELEMENTS as readonly string[]).includes(n));
  if (!found.length) {
    // fall back to the threshold, e.g. { air: 0, earth: 0, fire: 2, water: 0 }
    const threshold = pick(record, 'thresholds', 'threshold', 'guardian.thresholds', 'sets.0.metadata.thresholds');
    if (isObject(threshold)) found = ELEMENTS.filter((e) => (toNumber(threshold[e.toLowerCase()]) ?? 0) > 0);
  }
  return ELEMENTS.filter((e) => found.includes(e));
}

function toRarity(value: unknown): Rarity | null {
  const name = typeof value === 'string' ? titleCase(value.trim()) : '';
  return (RARITIES as readonly string[]).includes(name) ? (name as Rarity) : null;
}

export const slug = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

type Printing = { set: string; releasedAt: string };

function printings(record: Raw): Printing[] {
  const sets = pick(record, 'sets', 'printings');
  if (Array.isArray(sets)) {
    return sets
      .map((s) => (isObject(s) ? { set: String(pick(s, 'name', 'set', 'setName') ?? ''), releasedAt: String(pick(s, 'releasedAt', 'releaseDate', 'released') ?? '') } : { set: String(s), releasedAt: '' }))
      .filter((p) => p.set);
  }
  const set = pick(record, 'set.name', 'set', 'setName', 'expansion');
  return set ? [{ set: String(set), releasedAt: String(pick(record, 'set.releasedAt', 'releasedAt', 'releaseDate') ?? '') }] : [];
}

function image(record: Raw): string | null {
  const url = pick(record, 'image', 'imageUrl', 'image_url', 'images.large', 'images.normal', 'art', 'sets.0.variants.0.image', 'sets.0.variants.0.imageUrl');
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null;
}

/** Finds the list of cards whether the body is an array or wraps one. */
export function cardRecords(body: unknown): Raw[] {
  const list = Array.isArray(body) ? body : isObject(body) ? (pick(body, 'cards', 'data', 'results', 'items') as unknown) : undefined;
  return Array.isArray(list) ? list.filter(isObject) : [];
}

export function normalise(body: unknown, source: string, fetchedAt: string): CardData {
  const byId = new Map<string, Card & { released: string }>();
  const setDates = new Map<string, string>();

  for (const record of cardRecords(body)) {
    const name = pick(record, 'name', 'title');
    const type = pick(record, 'type', 'cardType', 'guardian.type', 'sets.0.metadata.type');
    if (typeof name !== 'string' || typeof type !== 'string') continue;

    const prints = printings(record);
    for (const p of prints) if (p.releasedAt && (!setDates.has(p.set) || p.releasedAt < setDates.get(p.set)!)) setDates.set(p.set, p.releasedAt);
    const first = [...prints].sort((a, b) => (a.releasedAt || '9999').localeCompare(b.releasedAt || '9999'))[0];

    const card: Card & { released: string } = {
      id: slug(name),
      name: name.trim(),
      type: titleCase(type.trim()),
      elements: toElements(record),
      cost: toNumber(pick(record, 'cost', 'manaCost', 'mana', 'guardian.cost', 'sets.0.metadata.cost')),
      power: toNumber(pick(record, 'power', 'attack', 'guardian.attack', 'sets.0.metadata.attack')),
      rarity: toRarity(pick(record, 'rarity', 'guardian.rarity', 'sets.0.metadata.rarity')),
      set: first?.set ?? '',
      image: image(record),
      released: first?.releasedAt ?? '',
    };
    // the same card listed once per printing: keep the earliest
    const existing = byId.get(card.id);
    if (!existing || (card.released && (!existing.released || card.released < existing.released))) byId.set(card.id, card);
  }

  const cards = [...byId.values()].map(({ released: _released, ...card }) => card).sort((a, b) => a.name.localeCompare(b.name));
  const setNames = [...new Set(cards.map((c) => c.set).filter(Boolean))];
  // release order when dates are known, otherwise the order sets were met in
  const sets = setNames
    .map((name, i) => ({ name, key: setDates.get(name) ?? `9999-${String(i).padStart(4, '0')}` }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((s) => s.name);

  return { fetchedAt, source, sets, cards };
}
