import type { PlotRecord } from './plotTypes';
import historical from '@/public/scraped_plots.json';
import { plotCenter } from './publicPlotVisibility';

export type AuditStatus = 'review' | 'possible_archive' | 'verified_candidate';
export type AuditRow = {
  id: string;
  name: string;
  sourceUrl: string | null;
  status: AuditStatus;
  reasons: string[];
  hasLocation: boolean;
  hasPhoto: boolean;
  legacySynthetic: boolean;
};

const byHistoricalId = new Map(historical.map(p => [String(p.id), p]));

function cleanUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch { return null; }
}

function lotIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).searchParams.get('lot_id'); } catch { return null; }
}

function isRectangularPlaceholder(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 4) return false;
  const p = value as unknown[];
  const coords = p.map(v => Array.isArray(v) && v.length >= 2 ? [Number(v[0]),Number(v[1])] : null);
  if (coords.some(x => !x || !x.every(Number.isFinite))) return false;
  const c = coords as number[][];
  const close = (a: number,b: number) => Math.abs(a-b) < 1e-8;
  return close(c[0][0],c[3][0]) && close(c[1][0],c[2][0])
    && close(c[0][1],c[1][1]) && close(c[2][1],c[3][1]);
}

/** Read-only heuristics. A clean row is not officially verified. */
export function auditPlots(plots: PlotRecord[]): AuditRow[] {
  const urlCounts = new Map<string,number>();
  const lotCounts = new Map<string,number>();
  const nameCounts = new Map<string,number>();
  for (const plot of plots) {
    const sourceUrl = cleanUrl(plot.auksionUrl || plot.auksion_url || plot.auction_url);
    if (sourceUrl) urlCounts.set(sourceUrl,(urlCounts.get(sourceUrl)||0)+1);
    const lot = lotIdFromUrl(sourceUrl);
    if (lot) lotCounts.set(lot,(lotCounts.get(lot)||0)+1);
    const name = String(plot.name || '').trim().toLowerCase();
    if (name) nameCounts.set(name,(nameCounts.get(name)||0)+1);
  }

  return plots.map(plot => {
    const id = String(plot.id);
    const name = String(plot.name || '').trim();
    const sourceUrl = cleanUrl(plot.auksionUrl || plot.auksion_url || plot.auction_url);
    const photo = cleanUrl(plot.image || plot.image_url || plot.photo_url);
    const old = byHistoricalId.get(id);
    const geometry = plot.polygonCoordinates || plot.polygon_coords;
    const legacySynthetic = Boolean(old && sourceUrl === old.auksionUrl
      && JSON.stringify(geometry) === JSON.stringify(old.polygonCoordinates));
    const hasLocation = Boolean(plotCenter(plot));
    const reasons: string[] = [];

    if (!name) reasons.push('Не указано название');
    if (!hasLocation) reasons.push('Нет пригодных координат');
    if (!photo) reasons.push('Нет проверяемой HTTPS-ссылки на фото');
    if (!sourceUrl) reasons.push('Нет ссылки на официальный источник');
    if (sourceUrl && !/^https:\/\/(?:[a-z0-9-]+\.)?e-auksion\.uz(?:\/|$)/i.test(sourceUrl)) {
      reasons.push('Ссылка не ведёт на E-auksion; проверить происхождение');
    }
    if (sourceUrl && (urlCounts.get(sourceUrl)||0)>1) reasons.push('Дубликат ссылки на аукцион');
    const lot = lotIdFromUrl(sourceUrl);
    if (lot && (lotCounts.get(lot)||0)>1) reasons.push('Дублируется номер лота');
    if (name && (nameCounts.get(name.toLowerCase())||0)>1) reasons.push('Повторяется название');
    if (legacySynthetic) reasons.push('Совпадает с исторической синтетической геометрией парсера');
    else if (isRectangularPlaceholder(geometry)) reasons.push('Прямоугольный полигон — сверить с кадастром');
    const area = plot.area;
    if (area === null || area === undefined || area === '' || !Number.isFinite(Number(area)) || Number(area)<=0) reasons.push('Площадь отсутствует или некорректна');
    if (old && sourceUrl === old.auksionUrl && (plot.area===old.area || plot.jobs===old.jobs || plot.budget===old.budget))
      reasons.push('Значения могут совпадать с исторически подставленными данными');
    if (!plot.ownership_type && !plot.ownershipType) reasons.push('Правовой статус не указан');

    // No automated record can be fully verified without an independent document check.
    const possibleArchive = ['Band','Sotilgan','Yakunlangan','Arxiv'].includes(String(plot.status??''));
    return {
      id, name:name || 'Без названия', sourceUrl,
      hasLocation, hasPhoto:Boolean(photo), legacySynthetic,
      status: possibleArchive ? 'possible_archive' : 'review',
      reasons: possibleArchive ? ['Статус требует проверки актуальности',...reasons] : reasons
    };
  });
}
