// Edit these to point the site at a different sheet, server, or city list.
// The Google Sheet must be shared as "Anyone with the link" (Viewer) so that
// both the build step and visitors' browsers can read it without an API key.

export const SHEET_ID = '1DZiYwc0o4YKxtS_bn86jfXyIQKpV92XGhEJaL503uS8';

export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

// Tab names in the sheet, in the order the site lists them. Case-sensitive.
export const CITIES = ['Sydney', 'Canberra', 'Melbourne', 'Perth', 'Adelaide', 'Brisbane', 'Hobart'] as const;
export type City = (typeof CITIES)[number];

export const SPECIAL_EVENTS_TAB = 'Special Events';
export const STORES_TAB = 'Stores';
export const FEATURED_DECKS_TAB = 'Featured Decks';

export const DISCORD_GUILD_ID = '1454028745001402485';
export const DISCORD_INVITE_URL = 'https://discord.gg/eyPp9FKpxU';

export const CURIOSA_PROFILE_URL = 'https://curiosa.io/users/cml4xcf3o00m204l723smuakz';

export const SITE_URL = 'https://realmofoz.com';
export const SITE_NAME = 'Sorcery TCG Australia';

// IANA timezones per city: Australia spans three offsets and two daylight
// saving regimes, so "18:30" means something different in every column.
export const CITY_TZ: Record<City, string> = {
  Sydney: 'Australia/Sydney',
  Canberra: 'Australia/Sydney',
  Melbourne: 'Australia/Melbourne',
  Hobart: 'Australia/Hobart',
  Brisbane: 'Australia/Brisbane',
  Adelaide: 'Australia/Adelaide',
  Perth: 'Australia/Perth',
};

export const CITY_SLUG: Record<City, string> = {
  Sydney: 'sydney',
  Canberra: 'canberra',
  Melbourne: 'melbourne',
  Perth: 'perth',
  Adelaide: 'adelaide',
  Brisbane: 'brisbane',
  Hobart: 'hobart',
};

export function cityFromSlug(slug: string): City | null {
  const s = slug.toLowerCase();
  return CITIES.find((c) => CITY_SLUG[c] === s) ?? null;
}

// CARTO basemap key for the store map tiles. Tile keys are sent from the
// visitor's browser, so this is public by nature; restrict it to the
// site's domain in the CARTO dashboard rather than treating it as secret.
export const CARTO_API_KEY = 'cb1_31mt_1_39d2b8072d479aab38014672';
export const CARTO_TILE_URL = `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;
