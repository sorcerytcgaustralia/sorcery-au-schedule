'use client';

// Leaflet only runs in the browser and only once the section approaches
// the viewport, so the library and the tiles cost nothing on first paint.

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Store } from '@/lib/sheet/types';
import { ALL, type CityChoice } from '@/lib/events';
import { CARTO_TILE_URL } from '@/lib/config';

// fixed Australia-wide opening view, framed by hand; sheet edits and
// container size never reframe it
const AU_CENTER: [number, number] = [-28.188244, 133.462569];
const AU_ZOOM = 4;
// capped so a lone store, or two side by side, lands on the city rather
// than the street
const CITY_FIT = { padding: [55, 55] as [number, number], maxZoom: 11 };

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export interface StoreMapProps {
  stores: Store[];
  city: CityChoice;
  cityPicked: boolean;
  weeklyLines: (store: Store) => string[];
  focus: Store | null;
  focusSeq: number;
  onLive: () => void;
}

export function StoreMap({ stores, city, cityPicked, weeklyLines, focus, focusSeq, onLive }: StoreMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const markers = useRef(new globalThis.Map<string, Leaflet.Marker>());
  const armed = useRef(false);
  const [ready, setReady] = useState(false);
  const located = stores.filter((s) => s.lat != null && s.lng != null);

  // the map's tiles only load once the section approaches the viewport
  useEffect(() => {
    const node = el.current;
    if (!node || located.length === 0) return;
    const start = async () => {
      if (armed.current) return;
      armed.current = true;
      const L = await import('leaflet');
      if (!el.current) return;
      const m = L.map(el.current, { scrollWheelZoom: false, zoomSnap: 0.25, zoomDelta: 1 });
      L.tileLayer(CARTO_TILE_URL, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(m);
      // opens on the hand-framed Australia view unless a city was chosen
      // before the map came into range, in which case open on that city
      const pts = stores.filter((s) => cityPicked && city !== ALL && s.city === city && s.lat != null).map((s) => [s.lat as number, s.lng as number] as [number, number]);
      if (pts.length) m.fitBounds(L.latLngBounds(pts), CITY_FIT);
      else m.setView(AU_CENTER, AU_ZOOM);
      leafletRef.current = L;
      mapRef.current = m;
      setReady(true);
      onLive();
      setTimeout(() => m.invalidateSize(), 0);
      window.addEventListener('resize', () => m.invalidateSize());
    };
    if (!('IntersectionObserver' in window)) {
      start();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: '500px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.length]);

  // markers follow the store list and the selected city
  useEffect(() => {
    const m = mapRef.current;
    const L = leafletRef.current;
    if (!ready || !m || !L) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current.clear();
    located.forEach((s) => {
      const dimmed = city !== ALL && s.city && s.city !== city;
      // a divIcon marker rather than a circleMarker: it looks the same but
      // sits in the tab order and opens on Enter
      const marker = L.marker([s.lat as number, s.lng as number], {
        icon: L.divIcon({ className: 'store-pin' + (dimmed ? ' is-dim' : ''), html: '<span class="store-pin-dot"></span>', iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -9] }),
        title: s.name,
        alt: s.name + (s.city ? ', ' + s.city : ''),
        riseOnHover: true,
      }).addTo(m);
      const weekly = weeklyLines(s);
      marker.bindPopup(
        '<strong>' + esc(s.name) + '</strong>' +
          (s.address ? '<br>' + esc(s.address) : '') +
          (weekly.length ? '<div class="popup-week">' + weekly.map((l) => '<div>' + esc(l) + '</div>').join('') + '</div>' : '') +
          (s.link ? '<div class="popup-site"><a href="' + esc(s.link) + '" target="_blank" rel="noopener">Website</a></div>' : ''),
      );
      markers.current.set(s.name.toLowerCase(), marker);
    });
  }, [ready, stores, city, weeklyLines, located]);

  // frame the selected city's stores; cities with none fall back to the
  // default view rather than leaving the map somewhere unrelated
  const firstFrame = useRef(true);
  useEffect(() => {
    const m = mapRef.current;
    const L = leafletRef.current;
    if (!ready || !m || !L) return;
    if (firstFrame.current) {
      firstFrame.current = false;
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    m.closePopup();
    const pts = stores.filter((s) => city !== ALL && s.city === city && s.lat != null && s.lng != null).map((s) => [s.lat as number, s.lng as number] as [number, number]);
    if (pts.length) {
      const b = L.latLngBounds(pts);
      if (reduced) m.fitBounds(b, CITY_FIT);
      else m.flyToBounds(b, { ...CITY_FIT, duration: 0.7 });
    } else if (reduced) m.setView(AU_CENTER, AU_ZOOM);
    else m.flyTo(AU_CENTER, AU_ZOOM, { duration: 0.7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, city]);

  // a venue click from the schedule lands on that pin
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m || !focus || focus.lat == null || focusSeq === 0) return;
    const marker = markers.current.get(focus.name.toLowerCase());
    m.flyTo([focus.lat, focus.lng as number], 14, { duration: 0.8 });
    if (marker) setTimeout(() => marker.openPopup(), 850);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focusSeq]);

  return (
    <div className="store-map" ref={el} role="application" aria-label="Store locations map">
      {!ready && located.length === 0 && <p className="map-note">No store has map coordinates in the sheet yet.</p>}
    </div>
  );
}
