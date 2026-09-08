// The map of the realm as a backdrop: the coast of Australia in ink lines
// (Natural Earth 50m, see australia.ts), hatching on the sea side, the
// ranges as pen strokes and the seven cities named, drawn faintly behind
// the masthead and faded into the page. Decorative only.

import { CITIES } from '@/lib/config';
import { HATCH, LAND, MOUNTAINS } from '@/lib/australia';
import { CHART_H, CHART_W, CITY_POINTS, LABEL_SIDE } from '@/lib/chart';

export function MapBackdrop() {
  return (
    <svg className="masthead-map" viewBox={`0 0 ${CHART_W} ${CHART_H}`} aria-hidden="true" focusable="false">
      <defs>
        <filter id="pen" x="-2%" y="-2%" width="104%" height="104%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter="url(#pen)">
        <path className="bd-hatch" d={HATCH} />
        <g className="bd-land">
          {LAND.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <path className="bd-mountains" d={MOUNTAINS} />
      </g>
      <g className="bd-cities">
        {CITIES.map((c) => {
          const p = CITY_POINTS[c];
          const side = LABEL_SIDE[c];
          const dx = side === 'left' ? -12 : side === 'right' ? 12 : 0;
          const dy = side === 'below' ? 24 : side === 'above' ? -14 : 5;
          const anchor = side === 'left' ? 'end' : side === 'right' ? 'start' : 'middle';
          return (
            <g key={c}>
              <circle cx={p.x} cy={p.y} r="4.5" />
              <text x={p.x + dx} y={p.y + dy} textAnchor={anchor}>
                {c}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
