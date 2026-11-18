import type { PlotRecord } from './plotTypes';

export function plotCenter(plot: PlotRecord): [number, number] | null {
  const valid = (lat: unknown, lng: unknown): [number, number] | null => {
    if (lat === null || lat === undefined || lat === '' || lng === null || lng === undefined || lng === '') return null;
    const a = Number(lat);
    const o = Number(lng);
    if (!Number.isFinite(a) || !Number.isFinite(o) || a < -90 || a > 90 || o < -180 || o > 180 || (a === 0 && o === 0)) return null;
    return [a, o];
  };

  const direct = valid(plot.lat, plot.lng);
  if (direct) return direct;

  const polygon = plot.polygonCoordinates ?? plot.polygon_coords;
  if (!Array.isArray(polygon) || polygon.length === 0) return null;
  const first = polygon as unknown[];
  if (first.length >= 2 && !Array.isArray(first[0])) return valid(first[0], first[1]);

  const points = first.map(point => Array.isArray(point) ? valid(point[0], point[1]) : null)
    .filter((point): point is [number, number] => point !== null);
  if (!points.length) return null;
  const [a, o] = points.reduce(([lat, lng], [x, y]) => [lat + x, lng + y], [0, 0]);
  return [a / points.length, o / points.length];
}

/**
 * A public catalogue item must also be locatable on the public map.
 * The API already quarantines known fabricated auction coordinates.
 * This is an additional shared display-level guard only; it never writes to Supabase.
 */
export function visibleMapPlot(plot: PlotRecord): boolean {
  if (plot.dataQuality === 'needs_verification' && !plotCenter(plot)) return false;
  const visibility = String(plot.publication_status ?? plot.publicationStatus ?? '').toLowerCase();
  if (visibility === 'draft' || visibility === 'review' || visibility === 'archived' || visibility === 'hidden') return false;
  return plotCenter(plot) !== null;
}
