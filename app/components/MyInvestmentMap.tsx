'use client';

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, LayerGroup, CircleMarker, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import PlotCard from './PlotCard';
import type { PlotRecord, MapViewport } from '@/lib/plotTypes';
import { plotCenter as getPlotCenter, visibleMapPlot } from '@/lib/publicPlotVisibility';
import L from 'leaflet';
import { useSearchParams } from 'next/navigation';

// Фикс для дефолтных иконок Leaflet, чтобы они не ломались при сборке Next.js
if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
}

// Ловит клики сотрудника отдела инвестиций Пискента
function MapClickHandler({
    isAdminMode,
    onMapClick,
    onPublicMapClick,
}: {
    isAdminMode: boolean,
    onMapClick?: (lat: number, lng: number) => void,
    onPublicMapClick?: () => void,
}) {
    useMapEvents({
        click(e) {
            if (isAdminMode && onMapClick) {
                onMapClick(e.latlng.lat, e.latlng.lng);
            } else {
                onPublicMapClick?.();
            }
        },

    });
    return null;
}

function MapZoomObserver({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
    const map = useMapEvents({
        zoomend() {
            onZoomChange(map.getZoom());
        },
    });
    useEffect(() => {
        onZoomChange(map.getZoom());
    }, [map, onZoomChange]);
    return null;
}

// At district overview, multiple nearby banks are represented by one marker.
function BankClusterMarker({ center, count }: { center: [number, number]; count: number }) {
    const map = useMap();
    return (
        <Marker
            position={center}
            icon={L.divIcon({
                className: 'poi-map-icon',
                html: `<div class="poi-cluster" aria-label="${count} banks"><span>🏦</span><b>${count}</b></div>`,
                iconSize: [34, 34],
                iconAnchor: [17, 17],
            })}
            eventHandlers={{
                click: () => map.flyTo(center, 16, { duration: 0.65 }),
            }}
        />
    );
}

// Never show a stock photo as a photograph of a real plot.

function getPlotImage(plot: PlotRecord) {
    return plot.image || plot.image_url || plot.photo_url || null;
}

function withPlotImage(plot: PlotRecord) {
    return {
        ...plot,
        image: getPlotImage(plot),
    };
}

function normalizePropertyType(value: unknown) {
    const normalizedValue = String(value || '').trim();
    return ['building', 'land_building'].includes(normalizedValue) ? normalizedValue : 'land';
}

function MapController({ viewport, plotId, plots }: { viewport?: MapViewport | null, plotId: string | null, plots: PlotRecord[] }) {
    const map = useMap();

    // 1. Логика зума (твоя старая)
    useEffect(() => {
        if (viewport && viewport.center) {
            map.setView(viewport.center, viewport.zoom, { animate: true });
        }
    }, [viewport, map]);

    // 2. Логика прыжка к участку (новая)
    useEffect(() => {
        if (plotId && plots.length > 0) {
            const targetPlot = plots.find((p) => p.id.toString() === plotId);
            const targetCenter = targetPlot ? getPlotCenter(targetPlot) : null;
            if (targetCenter) {
                map.flyTo(targetCenter, 18, { duration: 2 });
            }
        }
    }, [plotId, plots, map]);

    return null;
}


export default function MyInvestmentMap({
    viewport,
    selectedPlot,
    onSelectPlot,
    lang,
    isAdminMode = false,
    onMapClick,
    adminMarkerCoords
}: {
    viewport: MapViewport | null | undefined,
    selectedPlot: PlotRecord | null,
    onSelectPlot: (plot: PlotRecord | null) => void,
    lang: string,
    isAdminMode?: boolean,
    onMapClick?: (lat: number, lng: number) => void,
    adminMarkerCoords?: [number, number] | null
}) {
    const defaultCenter: [number, number] = [40.8934, 69.3122];
    const defaultZoom = 13;
    const searchParams = useSearchParams();
    const plotIdFromUrl = searchParams.get('plotId');
    const [statusFilter, setStatusFilter] = useState('Barchasi');
    const [isPanelVisible, setIsPanelVisible] = useState(true);
    const [isMobilePanelVisible, setIsMobilePanelVisible] = useState(false);
    const [plots, setPlots] = useState<PlotRecord[]>([]);
    const [dataNotice, setDataNotice] = useState<string | null>(null);
    const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
    const [propertyTypeFilter, setPropertyTypeFilter] = useState('all');
    const [showBanks, setShowBanks] = useState(true);
    const [showGovernment, setShowGovernment] = useState(true);
    const [baseMap, setBaseMap] = useState<'light' | 'satellite'>('light');
    const [mapZoom, setMapZoom] = useState(defaultZoom);

    useEffect(() => {
        let isCancelled = false;

        async function loadPlots() {
            try {
                const response = await fetch('/api/save-plots', { cache: 'no-store' });
                if (!response.ok) throw new Error(`API returned ${response.status}`);

                const data = await response.json();
                if (!Array.isArray(data)) throw new Error('API response is not an array');

                if (!isCancelled) {
                    setPlots(data.map(withPlotImage));
                    setDataNotice(
                        response.headers.get('X-Data-Source') === 'local-fallback'
                            ? 'База временно недоступна. Показаны резервные данные.'
                            : null
                    );
                }
            } catch (apiError) {
                console.error('Ошибка API лотов, загружаем локальные данные:', apiError);

                try {
                    const fallbackResponse = await fetch('/fallback_plots.json', { cache: 'no-store' });
                    if (!fallbackResponse.ok) throw new Error(`Fallback returned ${fallbackResponse.status}`);
                    const fallbackData = await fallbackResponse.json();
                    if (!Array.isArray(fallbackData)) throw new Error('Fallback is not an array');

                    if (!isCancelled) {
                        setPlots(fallbackData.map(withPlotImage));
                        setDataNotice('База временно недоступна. Показаны резервные данные.');
                    }
                } catch (fallbackError) {
                    console.error('Ошибка резервных данных:', fallbackError);
                    if (!isCancelled) setDataNotice('Не удалось загрузить объекты карты.');
                }
            }
        }

        loadPlots();
        return () => {
            isCancelled = true;
        };
    }, []);

    // Deep links open the exact mapped property, not merely the approximate viewport.
    useEffect(() => {
        if (!plotIdFromUrl || !plots.length) return;
        const found = plots.find(plot => String(plot.id) === plotIdFromUrl && visibleMapPlot(plot));
        if (found) onSelectPlot(withPlotImage(found));
    }, [plotIdFromUrl, plots, onSelectPlot]);

    // ОБЪЕДИНЕННЫЙ ФИЛЬТР
    const filteredPlots = plots.filter(plot => {
        if (!visibleMapPlot(plot)) return false;
        const matchesStatus = statusFilter === 'Barchasi' || plot.status === statusFilter;
        const plotPropertyType = normalizePropertyType(plot.property_type || plot.propertyType);
        const matchesPropertyType = propertyTypeFilter === 'all' || plotPropertyType === propertyTypeFilter;

        let matchesIndustry = true;
        if (selectedIndustry) {
            if (selectedIndustry === "Production") matchesIndustry = plot.industry === "Production";
            if (selectedIndustry === "Textile") matchesIndustry = plot.industry === "Textile";
            if (selectedIndustry === "Agro") matchesIndustry = plot.industry === "Agro";
            if (selectedIndustry === "Logistics") matchesIndustry = plot.industry === "Logistics";
        }
        return matchesStatus && matchesPropertyType && matchesIndustry;
    });

    // Локальный словарь для перевода всей панели
    const localDict = {
        uz: {
            hide: "Yashirish", show: "Filtrni ko'rsatish", mobileFilters: "🔍 Filtrlar", close: "Yopish",
            statusTitle: "🔍 Holat bo'yicha filtr", indTitle: "🏭 Yo'nalishlar bo'yicha",
            infraTitle: "⚡ Infratuzilma qatlamlari", gas: "Gaz tarmog'i", power: "Elektr tarmog'i", water: "Suv ta'minoti",
            all: "Barchasi", allInd: "Hamma yo'nalishlar",
            propertyTypeTitle: "🏷 Obyekt turi",
            propertyTypeLabels: { all: "Barcha obyektlar", land: "Yer maydoni", building: "Bino", land_building: "Bino va yer maydoni" },
            statusLabels: { Barchasi: "Barchasi", Mavjud: "Mavjud", "E-auksion": "Auksion", Band: "Band" },
            sanoat: "Sanoat va ishlab chiqarish", tekstil: "To'qimachilik va tekstil", agro: "Qishloq xo'jaligi va agro",
            logistika: "Logistika va transport", qurilish: "Qurilish materiallari", boshqa: "Boshqa yo'nalishlar"
        },
        ru: {
            hide: "Скрыть", show: "Показать фильтр", mobileFilters: "🔍 Фильтры", close: "Закрыть",
            statusTitle: "🔍 Фильтр по статусу", indTitle: "🏭 По направлениям",
            infraTitle: "⚡ Инфраструктурные слои", gas: "Газовая сеть", power: "Электросеть", water: "Водоснабжение",
            all: "Все", allInd: "Все направления",
            propertyTypeTitle: "🏷 Тип объекта",
            propertyTypeLabels: { all: "Все объекты", land: "Земельные участки", building: "Здания", land_building: "Здания с участком" },
            statusLabels: { Barchasi: "Все", Mavjud: "Свободен", "E-auksion": "Аукцион", Band: "Занят" },
            sanoat: "Промышленность и производство", tekstil: "Текстиль и ткачество", agro: "Сельское хозяйство и агро",
            logistika: "Логистика и транспорт", qurilish: "Строительные материалы", boshqa: "Другие направления"
        },
        en: {
            hide: "Hide", show: "Show Filter", mobileFilters: "🔍 Filters", close: "Close",
            statusTitle: "🔍 Filter by Status", indTitle: "🏭 By Industry Branches",
            infraTitle: "⚡ Infrastructure Layers", gas: "Gas Network", power: "Power Grid", water: "Water Supply",
            all: "All", allInd: "All Industries",
            propertyTypeTitle: "🏷 Object type",
            propertyTypeLabels: { all: "All objects", land: "Land plots", building: "Buildings", land_building: "Buildings with land" },
            statusLabels: { Barchasi: "All", Mavjud: "Available", "E-auksion": "Auction", Band: "Reserved" },
            sanoat: "Industry & Manufacturing", tekstil: "Textile & Clothing", agro: "Agriculture & Agro",
            logistika: "Logistics & Transport", qurilish: "Building Materials", boshqa: "Other Industries"
        },
        zh: {
            hide: "隐藏", show: "显示 筛选", mobileFilters: "🔍 筛选", close: "关闭",
            statusTitle: "🔍 按状态过滤", indTitle: "🏭 按行业领域",
            infraTitle: "⚡ 基础建设图层", gas: "天然气管网", power: "电网覆盖", water: "供水系统",
            all: "全部", allInd: "所有行业领域",
            propertyTypeTitle: "🏷 对象类型",
            propertyTypeLabels: { all: "全部对象", land: "土地", building: "建筑物", land_building: "建筑物及土地" },
            statusLabels: { Barchasi: "全部", Mavjud: "可用", "E-auksion": "拍卖", Band: "已预留" },
            sanoat: "工业与制造", tekstil: "纺织与服装加工", agro: "农业与农业深加工",
            logistika: "物流与仓储运输", qurilish: "新型建筑材料", boshqa: "其他多元行业"
        }
    };

    const t = localDict[lang as keyof typeof localDict] || localDict['uz'];
    // Public points of interest are kept independent of investment plots.
    // Coordinates are from OpenStreetMap, viewed via Mapcarta (Nov 2026).
    const places = [
        { id: 'xalq', category: 'bank', name: 'Xalq banki', address: 'Amir Temur ko‘chasi, 173', coords: [40.89607, 69.35043] as [number, number] },
        { id: 'agro', category: 'bank', name: 'Agrobank', address: 'Mustaqillik ko‘chasi, 1', coords: [40.89871, 69.35277] as [number, number] },
        { id: 'mkbank', category: 'bank', name: 'MKBANK (Mikrokreditbank)', address: 'Piskent, Toshkent viloyati', coords: [40.8982582, 69.3529847] as [number, number] },
        { id: 'hokimlik', category: 'government', name: 'Piskent tumani hokimligi', address: 'Amir Temur ko‘chasi, 138', coords: [40.89715, 69.35148] as [number, number] },
    ] as const;
    const poiText = ({
        uz: { title: '🏦 Banklar va tashkilotlar', banks: 'Banklar', gov: 'Hokimlik', address: 'Manzil', note: 'Xarita ma’lumotlari asosida' },
        ru: { title: '🏦 Банки и учреждения', banks: 'Банки', gov: 'Хокимият', address: 'Адрес', note: 'По картографическим данным' },
        en: { title: '🏦 Banks and offices', banks: 'Banks', gov: 'District administration', address: 'Address', note: 'Based on map data' },
        zh: { title: '🏦 银行和政府机构', banks: '银行', gov: '区政府', address: '地址', note: '基于地图数据' },
    })[lang as 'uz' | 'ru' | 'en' | 'zh'] || { title: '🏦 Banklar va tashkilotlar', banks: 'Banklar', gov: 'Hokimlik', address: 'Manzil', note: 'Xarita ma’lumotlari asosida' };
    const poiSwitches = (
        <div className="flex flex-col gap-2 text-xs text-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showBanks} onChange={e => setShowBanks(e.target.checked)} className="accent-cyan-500" />
                <span>🏦 {poiText.banks}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showGovernment} onChange={e => setShowGovernment(e.target.checked)} className="accent-cyan-500" />
                <span>🏛️ {poiText.gov}</span>
            </label>
        </div>
    );

    return (
        <div className="w-full h-full relative">
            {dataNotice && (
                <div className="absolute left-1/2 top-3 z-[1200] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg border border-amber-500/40 bg-amber-950/95 px-3 py-2 text-center text-xs text-amber-100 shadow-lg">
                    {dataNotice}
                </div>
            )}

            <MapContainer center={defaultCenter} zoom={defaultZoom} className="h-full w-full z-0" zoomControl={false}>

                {baseMap === 'light' ? (
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        maxZoom={19}
                    />
                ) : (
                    <LayerGroup>
                        <TileLayer
                            attribution='Tiles &copy; Esri'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            maxZoom={19}
                        />
                        <TileLayer
                            attribution='Tiles &copy; Esri'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
                        />
                        <TileLayer
                            attribution='Tiles &copy; Esri'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                        />
                    </LayerGroup>
                )}
                <MapZoomObserver onZoomChange={setMapZoom} />
                {/* 2. Контроллер для ссылок (летит к нужному лоту) */}
                <MapController viewport={viewport} plotId={plotIdFromUrl} plots={plots.filter(visibleMapPlot)} />
                {/* 3. Контроллер для кликов админа */}
                <MapClickHandler
                    isAdminMode={isAdminMode}
                    onMapClick={onMapClick}
                    onPublicMapClick={() => {
                        setIsMobilePanelVisible(false);
                        onSelectPlot(null);
                    }}
                />

                {/* Investment-oriented POI layers; hidden while editing plots. */}
                {!isAdminMode && showBanks && mapZoom <= 14 && (
                    <BankClusterMarker
                        center={[40.89768, 69.35206]}
                        count={places.filter(place => place.category === 'bank').length}
                    />
                )}
                {!isAdminMode && places.filter(place =>
                    place.category === 'bank'
                        ? showBanks && mapZoom > 14
                        : showGovernment
                ).map(place => (
                    <Marker
                        key={place.id}
                        position={place.coords}
                        icon={L.divIcon({
                            className: 'poi-map-icon',
                            html: place.category === 'bank'
                                ? `<div class="poi-pin poi-pin-bank ${mapZoom >= 17 ? '' : 'poi-pin-compact'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10h18L12 4 3 10Z"/><path d="M5 10v9m5-9v9m4-9v9m5-9v9M3 20h18"/></svg>${mapZoom >= 17 ? '<span>BANK</span>' : ''}</div>`
                                : `<div class="poi-pin poi-pin-government ${mapZoom >= 17 ? '' : 'poi-pin-compact'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 21v-4h4v4"/></svg></div>`,
                            iconSize: mapZoom >= 17 ? (place.category === 'bank' ? [48, 48] : [40, 42]) : [26, 28],
                            iconAnchor: mapZoom >= 17 ? (place.category === 'bank' ? [24, 46] : [20, 40]) : [13, 26],
                            popupAnchor: mapZoom >= 17 ? [0, -40] : [0, -23],
                        })}
                    >
                        <Popup closeButton={false}>
                            <div className="poi-popup">
                                <div className="poi-popup-label">{place.category === 'bank' ? poiText.banks : poiText.gov}</div>
                                <strong>{place.name}</strong>
                                <div>{place.address}</div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Отрисовка объектов как точек с постоянным размером в пикселях */}
                {filteredPlots.map((plot: PlotRecord) => {
                    const center = getPlotCenter(plot);
                    if (!center) return null;

                    const isSelected = selectedPlot?.id === plot.id;

                    return (
                        <CircleMarker
                            key={plot.id}
                            center={center}
                            radius={isSelected ? 10 : 8}
                            bubblingMouseEvents={false}
                            pathOptions={{
                                stroke: true,
                                color: isSelected ? '#ffffff' : plot.industry === 'Textile' ? '#ec4899' : '#06b6d4',
                                fillColor: plot.industry === 'Textile' ? '#ec4899' : '#06b6d4',
                                fillOpacity: isSelected ? 0.9 : 0.75,
                                weight: isSelected ? 3 : 2
                            }}
                            eventHandlers={{
                                click: () => onSelectPlot(withPlotImage(plot)),
                            }}
                        />
                    );
                })}

                {/* Показ временной булавки в админке */}
                {isAdminMode && adminMarkerCoords && (
                    <Marker position={adminMarkerCoords} />
                )}
            </MapContainer>

            {/* Custom basemap selector, independent from filter panel and Leaflet controls. */}
            <div className="absolute left-3 top-3 z-[1000] flex overflow-hidden rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur md:left-4 md:top-4" role="group" aria-label="Map style">
                {([
                    { value: 'light', label: ({ uz: 'Xarita', ru: 'Карта', en: 'Map', zh: '地图' })[lang as 'uz' | 'ru' | 'en' | 'zh'] || 'Xarita' },
                    { value: 'satellite', label: ({ uz: 'Sun’iy yo‘ldosh', ru: 'Спутник', en: 'Satellite', zh: '卫星' })[lang as 'uz' | 'ru' | 'en' | 'zh'] || 'Sun’iy yo‘ldosh' },
                ] as const).map(option => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setBaseMap(option.value)}
                        aria-pressed={baseMap === option.value}
                        className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${baseMap === option.value ? 'bg-[#0b2545] text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {/* Интерфейс фильтров */}
            {!isAdminMode && !selectedPlot && (
                <>
                <div
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute top-4 right-4 z-[1000] hidden md:flex flex-col gap-2 w-72 max-h-[calc(100vh-40px)] pointer-events-auto"
                >
                    <button
                        onClick={() => setIsPanelVisible(!isPanelVisible)}
                        className="self-end bg-[#091120]/95 backdrop-blur border border-slate-700/70 text-slate-100 text-[10px] md:text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-2 shadow-lg shadow-black/20 transition-colors flex-shrink-0"
                    >
                        <span>{isPanelVisible ? '▶' : '◀'}</span>
                        {isPanelVisible ? t.hide : t.show}
                    </button>

                    {isPanelVisible && (
                        <div className="flex flex-col gap-2 overflow-y-auto pr-1 pb-4 scrollbar-none max-h-full">
                            <div className="bg-[#091120]/95 backdrop-blur-md p-3.5 rounded-xl border border-slate-700/70 shadow-lg shadow-black/20 flex flex-col gap-3.5 flex-shrink-0">
                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">{t.statusTitle}</h3>
                                    <div className="grid grid-cols-4 gap-1">
                                        {['Barchasi', 'Mavjud', 'E-auksion', 'Band'].map((id) => (
                                            <button
                                                key={id}
                                                onClick={() => setStatusFilter(id)}
                                                className={`py-1 rounded-md text-[9px] font-bold border text-center transition-colors ${statusFilter === id ? 'bg-cyan-800 text-cyan-50 border-cyan-700' : 'bg-[#050a14]/70 text-slate-400 border-slate-700/70'}`}
                                            >
                                                {t.statusLabels[id as keyof typeof t.statusLabels] || id}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t border-slate-800/50" />

                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">{t.propertyTypeTitle}</h3>
                                    <select
                                        value={propertyTypeFilter}
                                        onChange={(e) => setPropertyTypeFilter(e.target.value)}
                                        className="w-full bg-[#040814]/90 text-slate-300 border border-slate-800 px-3 py-2 rounded-xl text-[11px] font-medium outline-none cursor-pointer focus:border-cyan-500 transition-all"
                                    >
                                        {['all', 'land', 'building', 'land_building'].map((type) => (
                                            <option key={type} value={type}>{t.propertyTypeLabels[type as keyof typeof t.propertyTypeLabels]}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="border-t border-slate-800/50" />

                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">{t.indTitle}</h3>
                                    <select
                                        value={selectedIndustry || ''}
                                        onChange={(e) => setSelectedIndustry(e.target.value || null)}
                                        className="w-full bg-[#040814]/90 text-slate-300 border border-slate-800 px-3 py-2 rounded-xl text-[11px] font-medium outline-none cursor-pointer focus:border-cyan-500 transition-all"
                                    >
                                        <option value="">🔍 {t.all} ({t.allInd})</option>
                                        <option value="Production">🏭 {t.sanoat}</option>
                                        <option value="Textile">🧵 {t.tekstil}</option>
                                        <option value="Agro">🌾 {t.agro}</option>
                                        <option value="Logistics">📦 {t.logistika}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="bg-[#091120]/95 backdrop-blur-md p-3 md:p-4 rounded-xl border border-slate-700/70 shadow-lg shadow-black/20 flex-shrink-0">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{poiText.title}</h3>
                                {poiSwitches}
                            </div>

                            <div className="bg-[#091120]/95 backdrop-blur-md p-3 md:p-4 rounded-xl border border-slate-700/70 shadow-lg shadow-black/20 flex-shrink-0">
                                <h3 className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">{t.infraTitle}</h3>
                                <div className="space-y-2">
                                    {[
                                        { label: t.gas, percent: "78%", color: "bg-amber-500" },
                                        { label: t.power, percent: "98%", color: "bg-yellow-400" },
                                        { label: t.water, percent: "84%", color: "bg-blue-500" }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex flex-col gap-1">
                                            <div className="flex justify-between items-center text-[9px] md:text-[10px] text-slate-300">
                                                <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${item.color}`}></span><span>{item.label}</span></div>
                                                <span className="font-bold text-slate-400">{item.percent}</span>
                                            </div>
                                            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${item.color}`} style={{ width: item.percent }}></div></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div
                    onPointerDown={(e) => e.stopPropagation()}
                    className="md:hidden pointer-events-auto"
                >
                    {!isMobilePanelVisible && (
                        <button
                            onClick={() => setIsMobilePanelVisible(true)}
                            className="absolute left-4 bottom-4 z-[1000] bg-[#091120]/95 backdrop-blur border border-slate-700/70 text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-lg shadow-black/20"
                        >
                            {t.mobileFilters}
                        </button>
                    )}

                    {isMobilePanelVisible && (
                        <div className="absolute inset-x-3 bottom-4 z-[1100] max-h-[65vh] overflow-y-auto rounded-xl border border-slate-700/70 bg-[#091120]/98 backdrop-blur-md p-3.5 shadow-xl shadow-black/25 scrollbar-none">
                            <div className="mb-3 flex items-center justify-between">
                                <span className="text-xs font-bold text-white">{t.mobileFilters}</span>
                                <button
                                    onClick={() => setIsMobilePanelVisible(false)}
                                    aria-label={t.close}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 text-lg text-slate-300"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="flex flex-col gap-3.5">
                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">{t.statusTitle}</h3>
                                    <div className="grid grid-cols-4 gap-1">
                                        {['Barchasi', 'Mavjud', 'E-auksion', 'Band'].map((id) => (
                                            <button
                                                key={id}
                                                onClick={() => setStatusFilter(id)}
                                                className={`py-2 rounded-md text-[9px] font-bold border text-center transition-colors ${statusFilter === id ? 'bg-cyan-800 text-cyan-50 border-cyan-700' : 'bg-[#050a14]/70 text-slate-400 border-slate-700/70'}`}
                                            >
                                                {t.statusLabels[id as keyof typeof t.statusLabels] || id}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t border-slate-800/50" />

                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">{t.propertyTypeTitle}</h3>
                                    <select
                                        value={propertyTypeFilter}
                                        onChange={(e) => setPropertyTypeFilter(e.target.value)}
                                        className="w-full bg-[#040814]/90 text-slate-300 border border-slate-800 px-3 py-2.5 rounded-xl text-[11px] font-medium outline-none cursor-pointer focus:border-cyan-500 transition-all"
                                    >
                                        {['all', 'land', 'building', 'land_building'].map((type) => (
                                            <option key={type} value={type}>{t.propertyTypeLabels[type as keyof typeof t.propertyTypeLabels]}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="border-t border-slate-800/50" />

                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">{t.indTitle}</h3>
                                    <select
                                        value={selectedIndustry || ''}
                                        onChange={(e) => setSelectedIndustry(e.target.value || null)}
                                        className="w-full bg-[#040814]/90 text-slate-300 border border-slate-800 px-3 py-2.5 rounded-xl text-[11px] font-medium outline-none cursor-pointer focus:border-cyan-500 transition-all"
                                    >
                                        <option value="">🔍 {t.all} ({t.allInd})</option>
                                        <option value="Production">🏭 {t.sanoat}</option>
                                        <option value="Textile">🧵 {t.tekstil}</option>
                                        <option value="Agro">🌾 {t.agro}</option>
                                        <option value="Logistics">📦 {t.logistika}</option>
                                    </select>
                                </div>

                                <div className="border-t border-slate-800/50" />
                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{poiText.title}</h3>
                                    {poiSwitches}
                                </div>

                                <div className="border-t border-slate-800/50" />

                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">{t.infraTitle}</h3>
                                    <div className="space-y-2">
                                        {[
                                            { label: t.gas, percent: "78%", color: "bg-amber-500" },
                                            { label: t.power, percent: "98%", color: "bg-yellow-400" },
                                            { label: t.water, percent: "84%", color: "bg-blue-500" }
                                        ].map((item, idx) => (
                                            <div key={idx} className="flex flex-col gap-1">
                                                <div className="flex justify-between items-center text-[10px] text-slate-300">
                                                    <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${item.color}`}></span><span>{item.label}</span></div>
                                                    <span className="font-bold text-slate-400">{item.percent}</span>
                                                </div>
                                                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${item.color}`} style={{ width: item.percent }}></div></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                </>
            )}

            {/* Выезжающая шторка карточки */}
            {!isAdminMode && selectedPlot && (
                <div className="fixed md:absolute z-[1000] bg-[#091120]/98 backdrop-blur-lg border border-slate-700/70 shadow-xl shadow-black/30 overflow-y-auto animate-fade-in inset-x-0 bottom-0 h-[60vh] rounded-t-3xl md:inset-y-4 md:right-4 md:left-auto md:h-auto md:w-[420px] md:rounded-xl">
                    <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto my-3 md:hidden" />
                    <PlotCard plot={withPlotImage(selectedPlot)} onClose={() => onSelectPlot(null)} lang={lang} />
                </div>
            )}
        </div>
    );
}
