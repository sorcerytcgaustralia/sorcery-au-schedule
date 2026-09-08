export const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_NAMES: Record<DayKey, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

export type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'irregular';

export interface WeeklyEvent {
  type: string;
  venue: string;
  suburb: string;
  time: string;
  freq: Frequency;
  note: string;
}

export type WeekEvents = Record<DayKey, WeeklyEvent[]>;

export interface CitySchedule {
  events: WeekEvents;
  updated: string;
  error?: boolean;
}

export type CityData = Record<string, CitySchedule>;

export interface Placing {
  place: number;
  player: string;
  deck: string;
}

export type Tier = 'grand' | 'cornerstone' | '';

export interface SpecialEvent {
  // ISO dates (YYYY-MM-DD) so the snapshot survives JSON and the two sides
  // of the build (Node at build time, the browser afterwards) agree.
  start: string;
  end: string;
  event: string;
  tier: Tier;
  city: string;
  venue: string;
  time: string;
  format: string;
  entry: string;
  link: string;
  results: Placing[];
}

export interface Store {
  name: string;
  city: string;
  address: string;
  link: string;
  lat: number | null;
  lng: number | null;
}

export interface FeaturedDeck {
  card: string;
  deck: string;
  pilot: string;
  link: string;
}

export interface SiteData {
  cities: CityData;
  special: SpecialEvent[];
  stores: Store[];
  featured: FeaturedDeck[];
  // When the snapshot was taken, ISO timestamp. Missing sections are
  // recorded so the UI can say "couldn't read" rather than "nothing here".
  fetchedAt: string;
  failed: string[];
}

export function emptyWeek(): WeekEvents {
  return { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] };
}
