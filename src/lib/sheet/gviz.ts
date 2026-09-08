// Google's public "gviz" endpoint returns a JSONP-ish payload for any sheet
// shared as "Anyone with the link". No API key is needed, which is what
// keeps the community's editing workflow free of any admin step. This
// module is isomorphic: the build step calls it from Node and the browser
// calls it again after hydration to pick up edits made since the build.

import { SHEET_ID } from '../config';
import type { Rows, TabularTab } from './parse';

interface GvizCell {
  v?: unknown;
  f?: string | null;
}
interface GvizPayload {
  table: {
    cols?: { label?: string }[];
    rows?: { c?: (GvizCell | null)[] }[];
  };
}

function tabUrl(tabName: string): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}`;
}

async function fetchGviz(tabName: string, signal?: AbortSignal): Promise<GvizPayload> {
  const res = await fetch(tabUrl(tabName), { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheet fetch failed for ${tabName}: ${res.status}`);
  const text = await res.text();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`Sheet payload for ${tabName} was not JSON`);
  const json = JSON.parse(text.slice(start, end + 1)) as GvizPayload;
  if (!json.table) throw new Error(`Sheet payload for ${tabName} has no table (is the sheet public?)`);
  return json;
}

// City tabs: raw values only, since the cells are free text.
export async function fetchCityRows(tabName: string, signal?: AbortSignal): Promise<Rows> {
  const json = await fetchGviz(tabName, signal);
  return (json.table.rows || []).map((row) => (row.c || []).map((cell) => (cell && cell.v != null ? String(cell.v) : '')));
}

// Tabular tabs: prefer the formatted value (so dates keep the DD/MM/YY the
// editor typed) and keep the column labels, which gviz fills from the
// header row whenever it can type the columns.
export async function fetchTabular(tabName: string, signal?: AbortSignal): Promise<TabularTab> {
  const json = await fetchGviz(tabName, signal);
  const rows = (json.table.rows || []).map((row) =>
    (row.c || []).map((cell) => {
      if (!cell) return '';
      if (cell.f != null) return String(cell.f);
      if (cell.v != null) return String(cell.v);
      return '';
    }),
  );
  const colLabels = (json.table.cols || []).map((c) => (c.label || '').trim());
  return { rows, colLabels };
}
