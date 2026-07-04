'use client';

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, useMap, useMapEvents } from 'react-leaflet';
import PlotCard from './PlotCard';
import L from 'leaflet';
import { useSearchParams } from 'next/navigation';

// Фикс для дефолтных иконок Leaflet, чтобы они не ломались при сборке Next.js
if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
}

// Ловит клики сотрудника отдела инвестиций Пискента
function MapClickHandler({ isAdminMode, onMapClick }: { isAdminMode: boolean, onMapClick?: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            if (isAdminMode && onMapClick) {
                onMapClick(e.latlng.lat, e.latlng.lng);
            }
        },

    });
    return null;
}

function toLatLng(value: any): [number, number] | null {
    if (!Array.isArray(value) || value.length < 2) return null;

    const lat = Number(value[0]);
    const lng = Number(value[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
}

function getPlotCenter(plot: any): [number, number] | null {
    const lat = Number(plot.lat);
    const lng = Number(plot.lng);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return [lat, lng];
    }

    const rawCoordinates = plot.polygonCoordinates || plot.polygon_coords;
    if (!Array.isArray(rawCoordinates) || rawCoordinates.length === 0) return null;

    const firstPoint = toLatLng(rawCoordinates);
    if (firstPoint) return firstPoint;

    const points = rawCoordinates
        .map((point: any) => toLatLng(point))
        .filter(Boolean) as [number, number][];

    if (points.length === 0) return null;
    if (points.length === 1) return points[0];

    const totals = points.reduce(
        (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
        [0, 0]
    );

    return [totals[0] / points.length, totals[1] / points.length];
}

function MapController({ viewport, plotId, plots }: { viewport?: any, plotId: string | null, plots: any[] }) {
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
    viewport: any,
    selectedPlot: any,
    onSelectPlot: any,
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
    const [plots, setPlots] = useState<any[]>([]);
    const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

    /*  // 1. ИСПРАВЛЕНО: Загружаем живые данные из нашего парсера e-auksion
      useEffect(() => {
          fetch('/scraped_plots.json')
              .then(res => {
                  if (res.ok) return res.json();
                  throw new Error('No scraped data');
              })
              .then(data => {
                  if (data && data.length > 0) {
                      setPlots(data);
                  } else {
                      loadFallbackPlots();
                  }
              })
              .catch(() => {
                  setPlots([]); // Теперь при ошибке карта будет пустой, а не рисовать солдатика
              });
  
          // ЗАМЕНИ ТАКУЮ ФУНКЦИЮ НА ЭТУ:
          function loadFallbackPlots() {
              // Просто ничего не делаем или задаем пустой массив, 
              // не глядя на localStorage
              setPlots([]);
          }
      }, [lang]);
      */
    useEffect(() => {
        fetch('/api/save-plots')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setPlots(data);
                }
            })
            .catch(err => {
                console.error('Ошибка загрузки лотов:', err);
                setPlots([]);
            });
    }, []);

    // ОБЪЕДИНЕННЫЙ ФИЛЬТР
    const filteredPlots = plots.filter(plot => {
        const matchesStatus = statusFilter === 'Barchasi' || plot.status === statusFilter;

        let matchesIndustry = true;
        if (selectedIndustry) {
            if (selectedIndustry === "Production") matchesIndustry = plot.industry === "Production";
            if (selectedIndustry === "Textile") matchesIndustry = plot.industry === "Textile";
            if (selectedIndustry === "Agro") matchesIndustry = plot.industry === "Agro";
            if (selectedIndustry === "Logistics") matchesIndustry = plot.industry === "Logistics";
        }
        return matchesStatus && matchesIndustry;
    });

    // Локальный словарь для перевода всей панели
    const localDict: Record<string, any> = {
        uz: {
            hide: "Yashirish", show: "Filtrni ko'rsatish",
            statusTitle: "🔍 Holat bo'yicha filtr", indTitle: "🏭 Yo'nalishlar bo'yicha",
            infraTitle: "⚡ Infratuzilma qatlamlari", gas: "Gaz tarmog'i", power: "Elektr tarmog'i", water: "Suv ta'minoti",
            all: "Barchasi", allInd: "Hamma yo'nalishlar",
            sanoat: "Sanoat va ishlab chiqarish", tekstil: "To'qimachilik va tekstil", agro: "Qishloq xo'jaligi va agro",
            logistika: "Logistika va transport", qurilish: "Qurilish materiallari", boshqa: "Boshqa yo'nalishlar"
        },
        ru: {
            hide: "Скрыть", show: "Показать фильтр",
            statusTitle: "🔍 Фильтр по статусу", indTitle: "🏭 По направлениям",
            infraTitle: "⚡ Инфраструктурные слои", gas: "Газовая сеть", power: "Электросеть", water: "Водоснабжение",
            all: "Все", allInd: "Все направления",
            sanoat: "Промышленность и производство", tekstil: "Текстиль и ткачество", agro: "Сельское хозяйство и агро",
            logistika: "Логистика и транспорт", qurilish: "Строительные материалы", boshqa: "Другие направления"
        },
        en: {
            hide: "Hide", show: "Show Filter",
            statusTitle: "🔍 Filter by Status", indTitle: "🏭 By Industry Branches",
            infraTitle: "⚡ Infrastructure Layers", gas: "Gas Network", power: "Power Grid", water: "Water Supply",
            all: "All", allInd: "All Industries",
            sanoat: "Industry & Manufacturing", tekstil: "Textile & Clothing", agro: "Agriculture & Agro",
            logistika: "Logistics & Transport", qurilish: "Building Materials", boshqa: "Other Industries"
        },
        zh: {
            hide: "隐藏", show: "显示 筛选",
            statusTitle: "🔍 按状态过滤", indTitle: "🏭 按行业领域",
            infraTitle: "⚡ 基础建设图层", gas: "天然气管网", power: "电网覆盖", water: "供水系统",
            all: "全部", allInd: "所有行业领域",
            sanoat: "工业与制造", tekstil: "纺织与服装加工", agro: "农业与农业深加工",
            logistika: "物流与仓储运输", qurilish: "新型建筑材料", boshqa: "其他多元行业"
        }
    };

    const t = localDict[lang] || localDict['uz'];

    return (
        <div className="w-full h-full relative">

            <MapContainer center={defaultCenter} zoom={defaultZoom} className="h-full w-full z-0" zoomControl={false}>

                {/* 2. ИСПРАВЛЕНО: Подключаем чистые тайлы Google Спутник (lyrs=s) БЕЗ точек POI, магазинов и туалетов */}
                {/* 2. ИСПРАВЛЕНО: Подключаем чистые тайлы Google Спутник */}
                {/* 2. ИСПРАВЛЕНО: Переключаем на чистую схематичную векторную карту как на E-Auksion! */}
                <TileLayer
                    attribution='&copy; Google Maps Road'
                    url="https://mt1.google.com/vt/lyrs=m&hl=ru&x={x}&y={y}&z={z}"
                />
                {/* 2. Контроллер для ссылок (летит к нужному лоту) */}
                <MapController viewport={viewport} plotId={plotIdFromUrl} plots={plots} />
                {/* 3. Контроллер для кликов админа */}
                <MapClickHandler isAdminMode={isAdminMode} onMapClick={onMapClick} />
                <MapClickHandler isAdminMode={isAdminMode} onMapClick={onMapClick} />

                {/* Отрисовка цветных круговых зон из координат объектов */}
                {filteredPlots.map((plot: any) => {
                    const center = getPlotCenter(plot);
                    if (!center) return null;

                    const isSelected = selectedPlot?.id === plot.id;

                    return (
                        <Circle
                            key={plot.id}
                            center={center}
                            radius={150}
                            pathOptions={{
                                color: isSelected ? '#ffffff' : plot.industry === 'Textile' ? '#ec4899' : '#06b6d4',
                                fillColor: plot.industry === 'Textile' ? '#ec4899' : '#06b6d4',
                                fillOpacity: isSelected ? 0.65 : 0.4,
                                weight: isSelected ? 3.5 : 2
                            }}
                            eventHandlers={{
                                click: () => onSelectPlot(plot),
                            }}
                        />
                    );
                })}

                {/* Показ временной булавки в админке */}
                {isAdminMode && adminMarkerCoords && (
                    <Marker position={adminMarkerCoords} />
                )}
            </MapContainer>

            {/* Интерфейс фильтров */}
            {!isAdminMode && !selectedPlot && (
                <div
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 w-72 max-h-[calc(100vh-40px)] pointer-events-auto"
                >
                    <button
                        onClick={() => setIsPanelVisible(!isPanelVisible)}
                        className="self-end bg-[#0b1329]/95 backdrop-blur border border-slate-800 text-white text-[10px] md:text-[11px] font-semibold px-2.5 py-1.5 rounded-xl flex items-center gap-2 shadow-2xl transition-all flex-shrink-0"
                    >
                        <span>{isPanelVisible ? '▶' : '◀'}</span>
                        {isPanelVisible ? t.hide : t.show}
                    </button>

                    {isPanelVisible && (
                        <div className="flex flex-col gap-2 overflow-y-auto pr-1 pb-4 scrollbar-none max-h-full">
                            <div className="bg-[#0b1329]/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 shadow-2xl flex flex-col gap-3.5 flex-shrink-0">
                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">{t.statusTitle}</h3>
                                    <div className="grid grid-cols-4 gap-1">
                                        {['Barchasi', 'Mavjud', 'E-auksion', 'Band'].map((id) => (
                                            <button
                                                key={id}
                                                onClick={() => setStatusFilter(id)}
                                                className={`py-1 rounded-lg text-[9px] font-bold border text-center transition-all ${statusFilter === id ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-[#040814]/60 text-slate-400 border-slate-800'}`}
                                            >
                                                {id === 'Barchasi' ? t.all : id === 'E-auksion' ? 'Auksion' : id}
                                            </button>
                                        ))}
                                    </div>
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

                            <div className="bg-[#0b1329]/95 backdrop-blur-md p-3 md:p-4 rounded-2xl border border-slate-800 shadow-2xl flex-shrink-0">
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
            )}

            {/* Выезжающая шторка карточки */}
            {!isAdminMode && selectedPlot && (
                <div className="fixed md:absolute z-[1000] bg-[#0b1329]/98 backdrop-blur-lg border border-slate-800 shadow-2xl overflow-y-auto animate-fade-in inset-x-0 bottom-0 h-[60vh] rounded-t-3xl md:inset-y-4 md:right-4 md:left-auto md:h-auto md:w-[420px] md:rounded-2xl">
                    <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto my-3 md:hidden" />
                    <PlotCard plot={selectedPlot} onClose={() => onSelectPlot(null)} lang={lang} />
                </div>
            )}
        </div>
    );
}
