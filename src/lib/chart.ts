// The map of the realm: the seven cities placed on the coast of Australia
// (see australia.ts, generated from Natural Earth 50m). Equirectangular,
// with longitude compressed by the cosine of the mid latitude so the
// continent keeps its shape.

import { CITIES, CITY_COORDS, type City } from './config';
import { MAP_BOUNDS, MAP_H, MAP_W } from './australia';

export const CHART_W = MAP_W;
export const CHART_H = MAP_H;

export function project(lat: number, lng: number): { x: number; y: number } {
  const { lng0, lng1, lat0, lat1 } = MAP_BOUNDS;
  return {
    x: ((lng - lng0) / (lng1 - lng0)) * MAP_W,
    y: ((lat0 - lat) / (lat0 - lat1)) * MAP_H,
  };
}

export const CITY_POINTS: Record<City, { x: number; y: number }> = Object.fromEntries(
  CITIES.map((c) => [c, project(CITY_COORDS[c].lat, CITY_COORDS[c].lng)]),
) as Record<City, { x: number; y: number }>;

export function coordLabel(city: City): string {
  const { lat, lng } = CITY_COORDS[city];
  return `${Math.abs(lat).toFixed(2)}S ${lng.toFixed(2)}E`;
}

// where a city's label sits relative to its mark, so labels in the crowded
// south-east never cross each other
export type LabelSide = 'right' | 'left' | 'below' | 'above';
export const LABEL_SIDE: Record<City, LabelSide> = {
  Perth: 'right',
  Adelaide: 'below',
  Hobart: 'right',
  Melbourne: 'below',
  Canberra: 'left',
  Sydney: 'right',
  Brisbane: 'left',
};
