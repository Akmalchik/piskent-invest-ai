import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import { verifyAdminSession } from '@/lib/adminAuth';

const PLOTS_CACHE_TTL_MS = 60_000;
let plotsCache: { data: any[]; expiresAt: number } | null = null;
const PROPERTY_TYPES = ['land', 'building', 'land_building'];

function jsonWithCache(data: any[]) {
    return NextResponse.json(data, {
        headers: {
            'Cache-Control': 'no-store',
        },
    });
}

function rememberPlots(data: any[]) {
    plotsCache = {
        data,
        expiresAt: Date.now() + PLOTS_CACHE_TTL_MS,
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

// 1. МЕТОД GET: Чтение лотов из Supabase, а если пусто — чистка от лишних полей и автозаливка
export async function GET() {
    try {
        if (plotsCache && plotsCache.expiresAt > Date.now()) {
            return jsonWithCache(plotsCache.data);
        }

        // Проверяем, есть ли уже данные в таблице piskent_plots
        const { data: plots, error } = await supabase
            .from('piskent_plots')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        // ЕСЛИ В БАЗЕ СУПЕБЕЙС СЕЙЧАС ПУСТО (0 строк):
        if (!plots || plots.length === 0) {
            console.log('Таблица piskent_plots пуста. Фильтруем поля и исправляем кодировку...');

            const filePath = path.join(process.cwd(), 'public', 'scraped_plots.json');

            if (fs.existsSync(filePath)) {
                const fileData = fs.readFileSync(filePath, 'utf8');
                const localPlots = JSON.parse(fileData);

                if (Array.isArray(localPlots) && localPlots.length > 0) {

                    // МАППИНГ: Жестко вырезаем jobs и чиним текст электричества во всём массиве
                    const cleanedPlots = localPlots.map((plot: any) => {
                        // 1. Извлекаем jobs, чтобы оно НЕ попало в переменную cleanPlot
                        const { jobs, ...cleanPlot } = plot;

                        // 2. Чиним кодировку внутри оставшегося объекта
                        if (cleanPlot.infrastructure && cleanPlot.infrastructure.electricity) {
                            const powerText = String(cleanPlot.infrastructure.electricity);
                            if (powerText.includes('40') || powerText.includes('РєР’С‚')) {
                                cleanPlot.infrastructure.electricity = '40 кВт';
                            }
                        }

                        return cleanPlot;
                    });

                    // Удаляем дубликаты по id
                    const uniquePlots = Array.from(
                        new Map(cleanedPlots.map(p => [p.id, p])).values()
                    );

                    console.log(`Заливаем уникальных очищенных лотов в Supabase: ${uniquePlots.length}`);

                    // Массовая запись в базу данных
                    const { error: insertError } = await supabase
                        .from('piskent_plots')
                        .upsert(uniquePlots, { onConflict: 'id' });

                    if (insertError) throw insertError;

                    console.log('🎉 Автоматический перенос данных выполнен успешно!');
                    const normalizedPlots = uniquePlots.map(normalizePlot);
                    rememberPlots(normalizedPlots);
                    return jsonWithCache(normalizedPlots);
                }
            }
        }
        const normalizedPlots = (plots || []).map(normalizePlot);
        // Если в базе уже есть данные — просто отдаем их фронтенду на карту
        rememberPlots(normalizedPlots);
        return jsonWithCache(normalizedPlots);
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: `Ошибка бэкенда: ${error.message}` },
            { status: 500 }
        );
    }
}
// 2. МЕТОД POST: Сохранение изменений координат из формы админки (ОДИН ЭКЗЕМПЛЯР)
export async function POST(request: Request) {
    if (!(await verifyAdminSession())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const incomingData = await request.json();

        if (!incomingData) {
            return NextResponse.json({ success: false, error: 'Данные запроса пусты' }, { status: 400 });
        }

        const plotsToSave = Array.isArray(incomingData)
            ? incomingData.map(normalizePlotForDb)
            : normalizePlotForDb(incomingData);

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
    if (!(await verifyAdminSession())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
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
    if (!(await verifyAdminSession())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
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
