import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, getSupabaseClient } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import { verifyAdminSession } from '@/lib/adminAuth';
import { hasAcceptableJsonSize, isSameOriginRequest } from '@/lib/requestSecurity';

const PLOTS_CACHE_TTL_MS = 60_000;
let plotsCache: { data: any[]; expiresAt: number; source: string } | null = null;
const PROPERTY_TYPES = ['land', 'building', 'land_building'];

function jsonWithCache(data: any[], source = 'supabase') {
    return NextResponse.json(data, {
        headers: {
            'Cache-Control': 'no-store',
            'X-Data-Source': source,
        },
    });
}

function rememberPlots(data: any[], source = 'supabase') {
    plotsCache = {
        data,
        expiresAt: Date.now() + PLOTS_CACHE_TTL_MS,
        source,
    };
}

function clearPlotsCache() {
    plotsCache = null;
}

function getPlotImage(plot: any) {
    return plot.image || plot.image_url || plot.photo_url || null;
}

function normalizePropertyType(value: unknown) {
    const normalizedValue = String(value || '').trim();
    return PROPERTY_TYPES.includes(normalizedValue) ? normalizedValue : 'land';
}

function normalizeBuildingArea(value: unknown) {
    if (value === undefined || value === null || value === '') return null;

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizePlot(plot: any) {
    const incomingPropertyType = plot.property_type !== undefined ? plot.property_type : plot.propertyType;
    const incomingBuildingArea = plot.building_area_m2 !== undefined ? plot.building_area_m2 : plot.buildingAreaM2;

    return {
        ...plot,
        image: getPlotImage(plot),
        auksionUrl: plot.auksionUrl || plot.auksion_url || plot.auction_url,
        ownership_type: plot.ownership_type || plot.ownershipType,
        property_type: normalizePropertyType(incomingPropertyType),
        building_area_m2: normalizeBuildingArea(incomingBuildingArea),
        polygonCoordinates: plot.polygonCoordinates || plot.polygon_coords,
    };
}

function normalizePlotForDb(plot: any) {
    const dbPlot = normalizePlot(plot);

    if (dbPlot.image && !isAllowedHttpsUrl(dbPlot.image)) {
        throw new Error('Ссылка на изображение должна использовать HTTPS');
    }
    if (dbPlot.auksionUrl && !isAllowedAuctionUrl(dbPlot.auksionUrl)) {
        throw new Error('Ссылка на аукцион должна вести на e-auksion.uz по HTTPS');
    }

    delete dbPlot.image_url;
    delete dbPlot.polygon_coords;
    delete dbPlot.auksion_url;
    delete dbPlot.ownershipType;
    delete dbPlot.propertyType;
    delete dbPlot.buildingAreaM2;

    return {
        ...dbPlot,
        image: getPlotImage(plot),
    };
}

function isAllowedHttpsUrl(value: string) {
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

function isAllowedAuctionUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && (url.hostname === 'e-auksion.uz' || url.hostname.endsWith('.e-auksion.uz'));
    } catch {
        return false;
    }
}

async function authorizeMutation(request: Request) {
    if (!isSameOriginRequest(request)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!hasAcceptableJsonSize(request)) {
        return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    }
    if (!(await verifyAdminSession())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return null;
}

function readLocalPlots() {
    const filePath = path.join(process.cwd(), 'public', 'fallback_plots.json');
    const parsedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!Array.isArray(parsedData)) {
        throw new Error('Local plots fallback must contain an array');
    }

    return parsedData.map(normalizePlot);
}

// Reading must remain available even when Supabase is paused or misconfigured.
export async function GET() {
    try {
        if (plotsCache && plotsCache.expiresAt > Date.now()) {
            return jsonWithCache(plotsCache.data, plotsCache.source);
        }

        const supabase = getSupabaseClient();
        const { data: plots, error } = await supabase
            .from('piskent_plots')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        if (!plots || plots.length === 0) {
            const localPlots = readLocalPlots();
            rememberPlots(localPlots, 'local-fallback');
            return jsonWithCache(localPlots, 'local-fallback');
        }

        const normalizedPlots = (plots || []).map(normalizePlot);
        rememberPlots(normalizedPlots);
        return jsonWithCache(normalizedPlots);
    } catch (error) {
        console.error('Supabase plots read failed, using local fallback:', error);

        try {
            const localPlots = readLocalPlots();
            rememberPlots(localPlots, 'local-fallback');
            return jsonWithCache(localPlots, 'local-fallback');
        } catch (fallbackError) {
            const message = fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error';
            return NextResponse.json(
                { success: false, error: `Ошибка загрузки лотов: ${message}` },
                { status: 500 }
            );
        }
    }
}
// 2. МЕТОД POST: Сохранение изменений координат из формы админки (ОДИН ЭКЗЕМПЛЯР)
export async function POST(request: Request) {
    const authError = await authorizeMutation(request);
    if (authError) return authError;

    try {
        const supabase = getSupabaseAdminClient();
        const incomingData = await request.json();

        if (!incomingData) {
            return NextResponse.json({ success: false, error: 'Данные запроса пусты' }, { status: 400 });
        }

        const plotsToSave = Array.isArray(incomingData)
            ? incomingData.map(normalizePlotForDb)
            : normalizePlotForDb(incomingData);

        if (Array.isArray(plotsToSave) && plotsToSave.length > 500) {
            return NextResponse.json({ success: false, error: 'Слишком много объектов' }, { status: 400 });
        }

        const { error } = await supabase
            .from('piskent_plots')
            .upsert(plotsToSave, { onConflict: 'id' });

        if (error) throw error;

        clearPlotsCache();
        return NextResponse.json({ success: true, message: 'Координаты лотов успешно обновлены!' });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: `Ошибка записи в Supabase: ${error.message}` },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    const authError = await authorizeMutation(request);
    if (authError) return authError;

    try {
        const supabase = getSupabaseAdminClient();
        const incomingData = await request.json();

        if (!incomingData || !incomingData.id) {
            return NextResponse.json({ success: false, error: 'ID объекта обязателен для обновления' }, { status: 400 });
        }

        const plotToUpdate = normalizePlotForDb(incomingData);

        const { error } = await supabase
            .from('piskent_plots')
            .update(plotToUpdate)
            .eq('id', incomingData.id);

        if (error) throw error;

        clearPlotsCache();
        return NextResponse.json({ success: true, message: 'Объект успешно обновлен!' });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: `Ошибка обновления в Supabase: ${error.message}` },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    const authError = await authorizeMutation(request);
    if (authError) return authError;

    try {
        const supabase = getSupabaseAdminClient();
        const incomingData = await request.json();

        if (!incomingData || incomingData.id === undefined || incomingData.id === null) {
            return NextResponse.json({ success: false, error: 'ID объекта обязателен для удаления' }, { status: 400 });
        }

        const { error } = await supabase
            .from('piskent_plots')
            .delete()
            .eq('id', incomingData.id);

        if (error) throw error;

        clearPlotsCache();
        return NextResponse.json({ success: true, message: 'Объект успешно удален!' });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: `Ошибка удаления в Supabase: ${error.message}` },
            { status: 500 }
        );
    }
}
