'use client';

import React from 'react';

export default function PlotCard({ plot, onClose, lang }: { plot: any, onClose: () => void, lang: string }) {
    if (!plot) return null;

    // Сверхточный словарь локализации для карточки лота на 4 языка
    const cardDict: Record<string, any> = {
        uz: {
            area: "MAYDONI",
            jobs: "ISH O'RINLARI",
            industry: "Soha / Yo'nalish",
            infraTitle: "Infratuzilma (Kommunikatsiyalar):",
            gas: "Gaz tarmog'i",
            power: "Elektr quvvati",
            water: "Suv ta'minoti",
            road: "Yo'l infratuzilmasi",
            btn: "Auksionda ko'rish / Ishtirok etish 📄",
            ta: "ta",
            scoreTitle: "AI Investment Score",
            scoreHigh: "Sanoat va ishlab chiqarish uchun juda yuqori jozibadorlik",
            scoreMid: "O'rtacha jozibadorlik, infratuzilmani rivojlantirish tavsiya etiladi",
            noPhoto: "Foto yuklanmoqda..."
        },
        ru: {
            area: "ПЛОЩАДЬ",
            jobs: "РАБОЧИЕ МЕСТА",
            industry: "Сфера бизнеса / Отрасль",
            infraTitle: "Инфраструктура (Коммуникации):",
            gas: "Газоснабжение",
            power: "Электросеть",
            water: "Водоснабжение",
            road: "Дорожная сеть",
            btn: "Смотреть на аукционе / Участвовать 📄",
            ta: "чел.",
            scoreTitle: "Инвестиционный ИИ-Рейтинг",
            scoreHigh: "Очень высокая привлекательность для запуска производства",
            scoreMid: "Средняя привлекательность, рекомендуется развитие сетей",
            noPhoto: "Фото лота обрабатывается..."
        },
        en: {
            area: "TOTAL AREA",
            jobs: "JOBS CREATED",
            industry: "Business Industry Sector",
            infraTitle: "Infrastructure (Utilities):",
            gas: "Gas Supply",
            power: "Power Grid",
            water: "Water Supply",
            road: "Road Access",
            btn: "View on E-Auction / Participate 📄",
            ta: "jobs",
            scoreTitle: "AI Investment Score",
            scoreHigh: "Excellent investment appeal for manufacturing launch",
            scoreMid: "Moderate appeal, infrastructure development recommended",
            noPhoto: "Loading lot image..."
        },
        zh: {
            area: "规划土地面积",
            jobs: "创造就业岗位",
            industry: "规划行业领域",
            infraTitle: "基础设施（管网通信）：",
            gas: "天然气供应",
            power: "电力网络",
            water: "供水系统",
            road: "道路交通",
            btn: "前往电子拍卖官方页面 / 参与竞标 📄",
            ta: "个岗位",
            scoreTitle: "AI 投资综合评估指数",
            scoreHigh: "该土地非常适合启动大型现代工业与生产项目",
            scoreMid: "投资吸引力中等，建议进一步完善配套基础设施",
            noPhoto: "正在获取拍卖会现场图片..."
        }
    };

    const d = cardDict[lang] || cardDict['uz'];

    // Локальный перевод типов индустрии из парсера
    const getIndustryName = (ind: string) => {
        if (lang === 'zh') {
            if (ind === 'Production') return '🏭 工业与制造';
            if (ind === 'Textile') return '🧵 纺织与服装加工';
            if (ind === 'Agro') return '🌾 农业与食品加工';
            if (ind === 'Logistics') return '📦 物流与仓储运输';
        } else if (lang === 'ru') {
            if (ind === 'Production') return '🏭 Промышленность и производство';
            if (ind === 'Textile') return '🧵 Текстиль и ткачество';
            if (ind === 'Agro') return '🌾 Сельское хозяйство и агро';
            if (ind === 'Logistics') return '📦 Логистика и транспорт';
        } else if (lang === 'en') {
            if (ind === 'Production') return '🏭 Industry & Manufacturing';
            if (ind === 'Textile') return '🧵 Textile & Clothing';
            if (ind === 'Agro') return '🌾 Agriculture & Agro';
            if (ind === 'Logistics') return '📦 Logistics & Transport';
        }
        // По умолчанию узбекский
        if (ind === 'Production') return "🏭 Sanoat va ishlab chiqarish";
        if (ind === 'Textile') return "🧵 To'qimachilik va tekstil";
        if (ind === 'Agro') return "🌾 Qishloq xo'jaligi va agro";
        if (ind === 'Logistics') return "📦 Logistika va transport";
        return ind || "Sanoat va ishlab chiqarish";
    };

    return (
        <div className="p-4 md:p-6 text-white h-full flex flex-col justify-between select-none">
            <div className="overflow-y-auto pr-1">

                {/* Шапка карточки */}
                <div className="flex justify-between items-start mb-4 gap-2">
                    <h2 className="text-sm md:text-base font-black text-cyan-400 tracking-wide leading-snug">{plot.name}</h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white text-sm bg-slate-800/60 rounded-xl transition-all flex-shrink-0">✕</button>
                </div>

                {/* ========================================================= */}
                {/* СТРОКА С ЖИВОЙ ФОТОГРАФИЕЙ С САЙТА E-AUKSION               */}
                {/* ========================================================= */}
                <div className="w-full h-44 bg-[#040814] rounded-2xl border border-slate-800/80 overflow-hidden mb-4 relative flex items-center justify-center">
                    {plot.image ? (
                        <img
                            src={plot.image}
                            alt={plot.name}
                            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                            onError={(e) => {
                                // Защитный предохранитель: подставляет сочную картинку хаба, если сервер Е-Аукциона заблокировал хотлинк
                                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80";
                                (e.target as HTMLImageElement).onerror = null;
                            }}
                        />
                    ) : (
                        <div className="text-center text-slate-500 p-4">
                            <span className="text-2xl block mb-1">🏭</span>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{d.noPhoto}</span>
                        </div>
                    )}
                    <div className="absolute top-3 left-3 bg-cyan-600/90 backdrop-blur-sm text-white text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-md tracking-wider">
                        {plot.status || 'E-Auksion'}
                    </div>
                </div>

                {/* ========================================================= */}
                {/* АНАЛИТИЧЕСКИЙ БЛОК: AI INVESTMENT SCORE (МУЛЬТИЯЗЫЧНЫЙ)    */}
                {/* ========================================================= */}
                {(() => {
                    let score = 50;
                    if (plot.area > 2) score += 15;
                    if (plot.area > 10) score += 10;
                    if (plot.infrastructure?.gas === 'Mavjud') score += 10;
                    if (plot.infrastructure?.power && !plot.infrastructure.power.includes("Yo'q")) score += 10;
                    if (plot.infrastructure?.water === 'Mavjud') score += 10;
                    if (plot.infrastructure?.road === 'Asfalt') score += 10;
                    if (score > 100) score = 100;

                    const isHigh = score >= 85;
                    const scoreColor = isHigh ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-amber-400 border-amber-500/20 bg-amber-500/5';

                    return (
                        <div className={`p-3.5 rounded-xl border mb-4 flex items-center justify-between ${scoreColor}`}>
                            <div>
                                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">{d.scoreTitle}</span>
                                <p className="text-[11px] text-slate-200 leading-relaxed">
                                    {isHigh ? d.scoreHigh : d.scoreMid}
                                </p>
                            </div>
                            <div className="text-right flex flex-col items-center justify-center border-l border-slate-800/60 pl-3.5 min-w-[65px]">
                                <span className="text-xl font-black font-mono tracking-tighter">{score}</span>
                                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest -mt-1">/ 100</span>
                            </div>
                        </div>
                    );
                })()}

                {/* Параметры: Площадь и Рабочие места */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-[#101f42]/40 p-3 rounded-xl border border-slate-800/60">
                        <span className="text-[9px] text-slate-400 block font-bold tracking-wide">{d.area}</span>
                        <span className="text-xs md:text-sm font-black text-white">{plot.area} {lang === 'zh' ? d.ga : 'ga'}</span>
                    </div>
                    <div className="bg-[#101f42]/40 p-3 rounded-xl border border-slate-800/60">
                        <span className="text-[9px] text-slate-400 block font-bold tracking-wide">{d.jobs}</span>
                        <span className="text-xs md:text-sm font-black text-white">{plot.jobs || 0} {d.ta}</span>
                    </div>
                </div>

                {/* Сфера бизнеса */}
                <div className="bg-[#101f42]/40 p-3 rounded-xl border border-slate-800/60 mb-5">
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">{d.industry}</span>
                    <span className="text-xs md:text-sm font-bold text-cyan-400">{getIndustryName(plot.industry)}</span>
                </div>

                {/* Инфраструктура */}
                <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-2.5 tracking-wider">{d.infraTitle}</h3>
                <div className="space-y-1.5">
                    {plot.infrastructure ? (
                        Object.entries(plot.infrastructure).map(([key, value]: [string, any]) => {
                            // Переводим названия сетей на лету
                            let label = key;
                            if (key === 'gas') label = d.gas;
                            if (key === 'power') label = d.power;
                            if (key === 'water') label = d.water;
                            if (key === 'road') label = d.road;

                            // Локализация значений коммуникаций
                            let valDisplay = value;
                            if (value === 'Mavjud' && lang === 'zh') valDisplay = '已连通 (可用)';
                            if (value === 'Mavjud' && lang === 'ru') valDisplay = 'Доступно';
                            if (value === 'Mavjud' && lang === 'en') valDisplay = 'Available';

                            return (
                                <div key={key} className="flex justify-between items-center text-xs bg-[#101f42]/30 px-3 py-2 rounded-lg border border-slate-800/40">
                                    <span className="text-slate-400 text-[11px] font-medium">{label}</span>
                                    <span className="font-bold text-[11px] text-slate-200">{valDisplay}</span>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-[11px] text-slate-500 italic p-2 bg-[#101f42]/10 rounded-lg text-center">
                            Loading...
                        </div>
                    )}
                </div>
            </div>

            {/* Главная кнопка перехода к торгам */}
            <div className="mt-4">
                <a
                    href={plot.auksionUrl || "https://e-auksion.uz"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-center text-[10px] md:text-xs uppercase tracking-wider rounded-xl block transition-all shadow-lg shadow-amber-950/20 active:scale-[0.98]"
                >
                    {d.btn}
                </a>
            </div>
        </div>
    );
}