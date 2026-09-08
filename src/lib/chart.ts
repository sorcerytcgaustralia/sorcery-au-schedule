// The chart of the realm: an equirectangular projection of the populated
// south of the continent, 112E to 156E and 25S to 45S, onto an 880 by 400
// drawing. Only the seven cities, a graticule and coastal routes are drawn;
// there is no coastline, because the community is the seven places, not
// the landmass.

import { CITIES, CITY_COORDS, type City } from './config';

export const CHART_W = 880;
export const CHART_H = 400;
const LNG0 = 112;
const LNG1 = 156;
const LAT0 = -25;
const LAT1 = -45;

export function project(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng - LNG0) / (LNG1 - LNG0)) * CHART_W,
    y: ((LAT0 - lat) / (LAT0 - LAT1)) * CHART_H,
  };
}

export const CITY_POINTS: Record<City, { x: number; y: number }> = Object.fromEntries(
  CITIES.map((c) => [c, project(CITY_COORDS[c].lat, CITY_COORDS[c].lng)]),
) as Record<City, { x: number; y: number }>;

// hairline routes along the coast, west to east
export const ROUTES: City[][] = [
  ['Perth', 'Adelaide', 'Melbourne', 'Hobart'],
  ['Melbourne', 'Canberra', 'Sydney', 'Brisbane'],
];

export const MERIDIANS = [120, 130, 140, 150];
export const PARALLELS = [-30, -40];

export function coordLabel(city: City): string {
  const { lat, lng } = CITY_COORDS[city];
  return `${Math.abs(lat).toFixed(2)}S ${lng.toFixed(2)}E`;
}

// where a city's label sits relative to its mark, so labels in the crowded
// south-east never cross each other
export type LabelSide = 'right' | 'left' | 'below';
export const LABEL_SIDE: Record<City, LabelSide> = {
  Perth: 'right',
  Adelaide: 'right',
  Hobart: 'right',
  Melbourne: 'left',
  Canberra: 'below',
  Sydney: 'left',
  Brisbane: 'left',
};
