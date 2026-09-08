'use client';

// The schedule and the store explorer each show the same selection, so
// every city-tabs row is rendered from, and writes back to, one state.
// A thin marker travels under the active tab.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CITIES } from '@/lib/config';
import { ALL, type CityChoice } from '@/lib/events';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function CityTabs({ current, onPick, label }: { current: CityChoice; onPick: (c: CityChoice) => void; label: string }) {
  const wrap = useRef<HTMLElement>(null);
  const [marker, setMarker] = useState<{ x: number; y: number; w: number } | null>(null);

  useIsoLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const position = () => {
      const active = el.querySelector<HTMLElement>('.city-tab.active');
      if (!active) return;
      const wr = el.getBoundingClientRect();
      const ar = active.getBoundingClientRect();
      setMarker({ x: ar.left - wr.left, y: ar.bottom - wr.top, w: ar.width });
    };
    position();
    const ro = new ResizeObserver(position);
    ro.observe(el);
    // the display font arriving after first paint reflows the tabs
    document.fonts?.ready.then(position);
    return () => ro.disconnect();
  }, [current]);

  const values: CityChoice[] = [ALL, ...CITIES];
  return (
    <nav className="city-tabs" aria-label={label} ref={wrap}>
      {values.map((c) => (
        <button key={c} type="button" className={'city-tab' + (c === current ? ' active' : '')} aria-pressed={c === current} onClick={() => onPick(c)}>
          {c}
        </button>
      ))}
      <span className="city-marker" style={marker ? { width: marker.w, transform: `translate(${marker.x}px, ${marker.y}px)` } : undefined} />
    </nav>
  );
}
