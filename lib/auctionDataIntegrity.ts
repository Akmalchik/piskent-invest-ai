import type { PlotRecord } from '@/lib/plotTypes';
import historical from '@/public/scraped_plots.json';

// Historical automated data generated synthetic rectangles and template attributes.
// This module is a READ-ONLY safety overlay: it never updates or deletes database rows.
// Compare against the exact historical values so manually corrected properties are retained.
const historicalById = new Map(historical.map(item => [String(item.id), item]));

export function quarantineHistoricalAuctionFields(plot: PlotRecord): PlotRecord {
    const old = historicalById.get(String(plot.id));
    if (!old) return plot;

    const url = String(plot.auksionUrl || plot.auksion_url || plot.auction_url || '');
    if (url !== old.auksionUrl) return plot;

    const cleaned: PlotRecord = { ...plot };
    let scrubbed = false;

    const geometry = cleaned.polygonCoordinates ?? cleaned.polygon_coords;
    if (JSON.stringify(geometry) === JSON.stringify(old.polygonCoordinates)) {
        delete cleaned.polygonCoordinates;
        delete cleaned.polygon_coords;
        // A manually supplied lat/lng is independent and must not be erased.
        scrubbed = true;
    }

    if (cleaned.area === old.area) { cleaned.area = null; scrubbed = true; }
    if (cleaned.budget === old.budget) { cleaned.budget = null; scrubbed = true; }
    if (cleaned.jobs === old.jobs) { cleaned.jobs = null; scrubbed = true; }

    if (cleaned.infrastructure && typeof cleaned.infrastructure === 'object') {
        const infra = { ...cleaned.infrastructure };
        for (const key of ['gas', 'power', 'water', 'road']) {
            if (infra[key] === old.infrastructure[key as keyof typeof old.infrastructure]) {
                delete infra[key];
                scrubbed = true;
            }
        }
        cleaned.infrastructure = infra;
    }

    if (scrubbed) {
        cleaned.dataQuality = 'needs_verification';
        cleaned.dataQualityNote = 'Avtomatik yuklangan ayrim maydonlar tasdiqlanmagan. Rasmiy manba bilan tekshirish zarur.';
    }
    return cleaned;
}
