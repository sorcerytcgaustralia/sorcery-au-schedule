'use client';

// The chart of the realm: seven cities at their true relative positions,
// a graticule, and coastal routes. It is the site's identity and its place
// selector at once. Hovering a city reads its next table into the margin;
// selecting it sets the place for the whole page.

import { CITIES, type City } from '@/lib/config';
import { CHART_H, CHART_W, CITY_POINTS, LABEL_SIDE, MERIDIANS, PARALLELS, ROUTES, coordLabel, project } from '@/lib/chart';
import { ALL, cityEventCount, type CityChoice } from '@/lib/events';
import { useSiteData } from './SiteDataProvider';

export function Chart({ hovered, onHover }: { hovered: City | null; onHover: (c: City | null) => void }) {
  const { data, activeCity, setCity } = useSiteData();
  const pick = (c: CityChoice) => setCity(activeCity === c ? ALL : c);

  return (
    <figure className="chart" aria-label="Chart of the realm: the seven cities">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-hidden="true" className="chart-svg">
        <g className="graticule">
          {MERIDIANS.map((lng) => {
            const x = project(-25, lng).x;
            return (
              <g key={lng}>
                <line x1={x} y1={0} x2={x} y2={CHART_H} />
                <text x={x + 5} y={CHART_H - 8}>
                  {lng}E
                </text>
              </g>
            );
          })}
          {PARALLELS.map((lat) => {
            const y = project(lat, 112).y;
            return (
              <g key={lat}>
                <line x1={0} y1={y} x2={CHART_W} y2={y} />
                <text x={6} y={y - 6}>
                  {Math.abs(lat)}S
                </text>
              </g>
            );
          })}
        </g>
        <g className="routes">
          {ROUTES.map((route, i) => (
            <polyline key={i} points={route.map((c) => `${CITY_POINTS[c].x},${CITY_POINTS[c].y}`).join(' ')} style={{ animationDelay: `${0.5 + i * 0.4}s` }} />
          ))}
        </g>
      </svg>
      {/* city marks are HTML so they are real buttons in the tab order */}
      <div className="chart-marks">
        {CITIES.map((c, i) => {
          const p = CITY_POINTS[c];
          const n = cityEventCount(data, c);
          const selected = activeCity === c;
          const side = LABEL_SIDE[c];
          return (
            <button
              key={c}
              type="button"
              className={'mark' + (selected ? ' is-selected' : '') + (hovered === c ? ' is-hovered' : '') + (side === 'left' ? ' is-east' : side === 'below' ? ' is-below' : '')}
              style={{ left: `${(p.x / CHART_W) * 100}%`, top: `${(p.y / CHART_H) * 100}%`, animationDelay: `${0.15 + i * 0.07}s` }}
              onClick={() => pick(c)}
              onMouseEnter={() => onHover(c)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(c)}
              onBlur={() => onHover(null)}
              aria-pressed={selected}
              aria-label={`${c}, ${n} weekly ${n === 1 ? 'table' : 'tables'}${selected ? ', selected' : ''}`}
            >
              <span className="mark-dot" />
              <span className="mark-label">
                <span className="mark-name">{c}</span>
                <span className="mark-meta">
                  {n} {n === 1 ? 'table' : 'tables'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <figcaption className="chart-cartouche">
        <span className="cartouche-title">Chart of the Realm</span>
        <span className="cartouche-sub">{hovered ? coordLabel(hovered) : activeCity !== ALL ? coordLabel(activeCity) : 'Seven cities, 112E to 156E'}</span>
      </figcaption>
    </figure>
  );
}
