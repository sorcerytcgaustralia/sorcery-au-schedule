'use client';

// The map of the realm, drawn as an ink map on parchment: the coast of
// Australia with Tolkien-style hatching on the sea side, the ranges as pen
// strokes, the seas named, a compass and a cartouche. The seven cities are
// real buttons laid over it: hovering one reads its next table into the
// live line; selecting one sets the place for the whole page.

import { CITIES, type City } from '@/lib/config';
import { HATCH, HATCH_2, LAND, MOUNTAINS, SEAS } from '@/lib/australia';
import { CHART_H, CHART_W, CITY_POINTS, LABEL_SIDE, coordLabel } from '@/lib/chart';
import { ALL, cityEventCount, type CityChoice } from '@/lib/events';
import { useSiteData } from './SiteDataProvider';

function Compass({ x, y }: { x: number; y: number }) {
  return (
    <g className="compass" transform={`translate(${x} ${y})`}>
      <circle r="26" />
      <circle r="4" />
      <path d="M0 -40 L6 -6 L0 -10 L-6 -6 Z" className="north" />
      <path d="M0 40 L6 6 L0 10 L-6 6 Z M40 0 L6 -6 L10 0 L6 6 Z M-40 0 L-6 -6 L-10 0 L-6 6 Z" />
      <path d="M28 -28 L8 -4 M-28 -28 L-8 -4 M28 28 L8 4 M-28 28 L-8 4" className="fine" />
      <text y="-46" textAnchor="middle">
        N
      </text>
    </g>
  );
}

export function Chart({ hovered, onHover }: { hovered: City | null; onHover: (c: City | null) => void }) {
  const { data, activeCity, setCity } = useSiteData();
  const pick = (c: CityChoice) => setCity(activeCity === c ? ALL : c);

  return (
    <figure className="map" aria-label="Map of the realm: Australia and its seven Sorcery cities">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-hidden="true" className="map-svg">
        <defs>
          <filter id="pen" x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="4" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="9" result="g" />
            <feColorMatrix in="g" type="saturate" values="0" result="gs" />
            <feComponentTransfer in="gs" result="ga">
              <feFuncA type="table" tableValues="0 0.16" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="ga" mode="multiply" />
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
          </radialGradient>
        </defs>
        <rect className="paper" width={CHART_W} height={CHART_H} filter="url(#grain)" />
        <g filter="url(#pen)">
          <g className="hatch">
            <path d={HATCH} />
            <path d={HATCH_2} className="hatch-2" />
          </g>
          <g className="land">
            {LAND.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <path className="mountains" d={MOUNTAINS} />
        </g>
        <g className="seas">
          {SEAS.map((s) => (
            <text key={s.name} x={s.x} y={s.y} textAnchor="middle">
              {s.name}
            </text>
          ))}
        </g>
        <Compass x={110} y={140} />
        <rect width={CHART_W} height={CHART_H} fill="url(#vignette)" />
        <rect className="frame" x="8" y="8" width={CHART_W - 16} height={CHART_H - 16} />
      </svg>
      <div className="map-marks">
        {CITIES.map((c, i) => {
          const p = CITY_POINTS[c];
          const n = cityEventCount(data, c);
          const selected = activeCity === c;
          return (
            <button
              key={c}
              type="button"
              className={'mark side-' + LABEL_SIDE[c] + (selected ? ' is-selected' : '') + (hovered === c ? ' is-hovered' : '')}
              style={{ left: `${(p.x / CHART_W) * 100}%`, top: `${(p.y / CHART_H) * 100}%`, animationDelay: `${0.3 + i * 0.07}s` }}
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
      <figcaption className="cartouche">
        <span className="cartouche-title">The Realm Down Under</span>
        <span className="cartouche-sub">{hovered ? `${hovered}, ${coordLabel(hovered)}` : activeCity !== ALL ? `${activeCity}, ${coordLabel(activeCity)}` : 'Seven cities where Sorcery is played'}</span>
      </figcaption>
    </figure>
  );
}
