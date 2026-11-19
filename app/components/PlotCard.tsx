'use client';

import React from 'react';
import type { PlotRecord } from '@/lib/plotTypes';
import { localizePlotName, localizePlotStatus, localizePlotIndustry, localizePlotInfrastructure, localizePlotOwnership, type PublicLang } from '@/lib/plotLocalization';

export default function PlotCard({ plot, onClose, lang }: { plot: PlotRecord | null, onClose: () => void, lang: string }) {
    if (!plot) return null;

    // Сверхточный словарь локализации для карточки лота на 4 языка
    const cardDict = {
        uz: {
            area: "MAYDONI",
            jobs: "ISH O'RINLARI",
            industry: "Soha / Yo‘nalish",
            objectType: "Obyekt turi",
            landArea: "Yer maydoni",
            buildingArea: "Bino maydoni",
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
            noPhoto: "Rasm mavjud emas",
            loading: "Yuklanmoqda...",
            noData: "Ma'lumot kiritilmagan",
            noAuctionLink: "Havola hozircha yo'q",
            contactTitle: "Aloqa",
            contactDepartment: "Investitsiyalar, sanoat va savdo bo‘limi"
        },
        ru: {
            area: "ПЛОЩАДЬ",
            jobs: "РАБОЧИЕ МЕСТА",
            industry: "Сфера бизнеса / отрасль",
            objectType: "Тип объекта",
            landArea: "Площадь участка",
            buildingArea: "Площадь здания",
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
            noPhoto: "Фото отсутствует",
            loading: "Загрузка...",
            noData: "Данные не указаны",
            noAuctionLink: "Ссылка пока не добавлена",
            contactTitle: "Контакты",
            contactDepartment: "Отдел инвестиций, промышленности и торговли"
        },
        en: {
            area: "TOTAL AREA",
            jobs: "JOBS CREATED",
            industry: "Business sector / industry",
            objectType: "Object type",
            landArea: "Land area",
            buildingArea: "Building area",
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
            noPhoto: "No property photo",
            loading: "Loading...",
            noData: "No data entered",
            noAuctionLink: "No auction link yet",
            contactTitle: "Contact",
            contactDepartment: "Department of Investment, Industry and Trade"
        },
        zh: {
            area: "规划土地面积",
            jobs: "创造就业岗位",
            industry: "规划行业领域",
            objectType: "对象类型",
            landArea: "土地面积",
            buildingArea: "建筑面积",
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
            noPhoto: "暂无实景照片",
            loading: "加载中...",
            noData: "暂无数据",
            noAuctionLink: "暂无拍卖链接",
            contactTitle: "联系方式",
            contactDepartment: "投资、工业和贸易部门"
        }
    };

    const d = cardDict[lang as keyof typeof cardDict] || cardDict['uz'];

    const language: PublicLang = lang === 'ru' || lang === 'en' || lang === 'zh' ? lang : 'uz';
    const normalizePropertyType = (value: unknown) => {
        const normalizedValue = String(value || '').trim();
        return ['building', 'land_building'].includes(normalizedValue) ? normalizedValue : 'land';
    };
    const formatPropertyType = (value: unknown) => {
        const normalizedValue = normalizePropertyType(value);
        const labels: Record<string, Record<string, string>> = {
            uz: { land: 'Yer maydoni', building: 'Bino', land_building: 'Bino va yer maydoni' },
            ru: { land: 'Земельный участок', building: 'Здание', land_building: 'Здание с участком' },
            en: { land: 'Land plot', building: 'Building', land_building: 'Building with land' },
            zh: { land: '土地', building: '建筑物', land_building: '建筑物及土地' },
        };

        return labels[lang]?.[normalizedValue] || labels.uz[normalizedValue];
    };
    const propertyType = normalizePropertyType(plot.property_type || plot.propertyType);
    const landAreaUnit = lang === 'ru' ? 'га' : lang === 'zh' ? '公顷' : lang === 'uz' ? 'ga' : 'ha';
    const formatBuildingArea = (value: unknown) => {
        if (value === undefined || value === null || value === '') return d.noData;

        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return d.noData;

        return `${Number.isInteger(numericValue) ? numericValue.toFixed(0) : String(numericValue)} ${lang === 'zh' ? '平方米' : 'm²'}`;
    };
    const areaRows = propertyType === 'building'
        ? [{ label: d.buildingArea, value: formatBuildingArea(plot.building_area_m2 ?? plot.buildingAreaM2) }]
        : propertyType === 'land_building'
            ? [
                { label: d.landArea, value: plot.area === null || plot.area === undefined || plot.area === '' ? d.noData : `${plot.area} ${landAreaUnit}` },
                { label: d.buildingArea, value: formatBuildingArea(plot.building_area_m2 ?? plot.buildingAreaM2) },
            ]
            : [{ label: d.landArea, value: plot.area === null || plot.area === undefined || plot.area === '' ? d.noData : `${plot.area} ${landAreaUnit}` }];
    const ownershipType = plot.ownership_type || plot.ownershipType;

    return (
        <div className="p-4 md:p-6 text-white h-full flex flex-col justify-between select-none">
            <div className="overflow-y-auto pr-1">

                {/* Шапка карточки */}
                <div className="flex justify-between items-start mb-4 gap-2">
                    <h2 className="text-sm md:text-base font-bold text-slate-100 tracking-wide leading-snug">{localizePlotName(plot.name, language)}</h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white text-sm bg-slate-800/60 border border-slate-700 rounded-lg transition-colors flex-shrink-0">✕</button>
                </div>

                {/* ========================================================= */}
                {/* СТРОКА С ЖИВОЙ ФОТОГРАФИЕЙ С САЙТА E-AUKSION               */}
                {/* ========================================================= */}
                <div className="w-full h-44 bg-[#050a14] rounded-xl border border-slate-700/60 overflow-hidden mb-4 relative flex items-center justify-center">
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-500">
                        <span className="text-2xl" aria-hidden="true">🏭</span>
                        <span className="text-[10px] font-semibold uppercase">{d.noPhoto}</span>
                    </div>
                    {plot.image ? (
                        <img
                            src={plot.image}
                            alt={localizePlotName(plot.name, language)}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                            onError={(e) => {
                                // Do not misrepresent a stock photo as the actual property.
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    ) : null}
                    <div className="absolute top-3 left-3 bg-emerald-900/90 border border-emerald-600/40 text-emerald-100 text-[9px] font-bold uppercase px-2 py-1 rounded-md tracking-wider">
                        {localizePlotStatus(plot.status, language) || d.noData}
                    </div>
                    {ownershipType && (
                        <div className="absolute top-3 right-3 bg-slate-950/90 border border-slate-600/60 text-slate-100 text-[9px] font-bold px-2 py-1 rounded-md">
                            {localizePlotOwnership(ownershipType, language)}
                        </div>
                    )}
                </div>

                {/* ========================================================= */}
                {/* АНАЛИТИЧЕСКИЙ БЛОК: AI INVESTMENT SCORE (МУЛЬТИЯЗЫЧНЫЙ)    */}
                {/* ========================================================= */}
                {plot.dataQuality === 'needs_verification' ? (
                    <div className="mb-4 rounded-lg border border-amber-600/30 bg-amber-900/10 p-3 text-xs text-amber-200">
                        {lang === 'ru' ? 'Характеристики объекта требуют проверки' : lang === 'en' ? 'Property details require verification' : lang === 'zh' ? '项目资料待核实' : 'Obyekt ma’lumotlari tekshirilmoqda'}
                    </div>
                ) : (() => {
                    let score = 50;
                    if (Number(plot.area) > 2) score += 15;
                    if (Number(plot.area) > 10) score += 10;
                    if (plot.infrastructure?.gas === 'Mavjud') score += 10;
                    if (plot.infrastructure?.power && !String(plot.infrastructure.power).includes("Yo'q")) score += 10;
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

                {/* Параметры площади */}
                <div className="mb-3 space-y-2">
                    {areaRows.map((row) => (
                        <div key={row.label} className="bg-[#0a1324] p-4 rounded-lg border border-slate-700/50">
                            <span className="text-[9px] text-slate-400 block font-bold tracking-wide uppercase mb-1">
                                {row.label}
                            </span>
                            <span className="text-sm font-black text-white">
                                {row.value}
                            </span>
                        </div>
                    ))}
                </div>
                {/* Сфера бизнеса */}
                <div className="bg-[#0a1324] p-3 rounded-lg border border-slate-700/50 mb-3">
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">{d.industry}</span>
                    <span className="text-xs md:text-sm font-bold text-cyan-400">{localizePlotIndustry(plot.industry, language) || d.noData}</span>
                </div>
                <div className="bg-[#0a1324] p-3 rounded-lg border border-slate-700/50 mb-5">
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">{d.objectType}</span>
                    <span className="text-xs md:text-sm font-bold text-white">{formatPropertyType(plot.property_type || plot.propertyType)}</span>
                </div>

                {/* Инфраструктура */}
                <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-2.5 tracking-wider">{d.infraTitle}</h3>
                <div className="space-y-1.5">
                    {plot.infrastructure && Object.keys(plot.infrastructure).length > 0 ? (
                        Object.entries(plot.infrastructure).map(([key, value]: [string, unknown]) => {
                            // Переводим названия сетей на лету
                            let label = key;
                            if (key === 'gas') label = d.gas;
                            if (key === 'power') label = d.power;
                            if (key === 'water') label = d.water;
                            if (key === 'road') label = d.road;

                            const valDisplay = localizePlotInfrastructure(value, language) || d.noData;

                            return (
                                <div key={key} className="flex justify-between items-center text-xs bg-[#0a1324] px-3 py-2 rounded-lg border border-slate-700/40">
                                    <span className="text-slate-400 text-[11px] font-medium">{label}</span>
                                    <span className="font-bold text-[11px] text-slate-200">{valDisplay}</span>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-[11px] text-slate-500 italic p-2 bg-[#101f42]/10 rounded-lg text-center">
                            {d.loading}
                        </div>
                    )}
                </div>

                <div className="mt-4 p-3 rounded-lg border border-slate-700/60 bg-[#0a1324]">
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block mb-2">{d.contactTitle}</span>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                        {d.contactDepartment}
                    </p>
                    <p className="text-[11px] text-white leading-relaxed font-bold">
                        Nazirqulov Doniyor Rahmonjon o‘g‘li
                    </p>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-mono">
                        +998 99 512 75 70
                    </p>
                </div>
            </div>

            {/* Главная кнопка перехода к торгам */}
            <div className="mt-4">
                {plot.auksionUrl ? (
                    <a
                        href={plot.auksionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-white font-bold text-center text-[10px] md:text-xs uppercase tracking-wider rounded-lg block transition-colors active:scale-[0.98]"
                    >
                        {d.btn}
                    </a>
                ) : (
                    <div className="w-full py-3 bg-slate-800 text-slate-500 font-bold text-center text-[10px] md:text-xs uppercase tracking-wider rounded-xl border border-slate-700 cursor-not-allowed">
                        {d.noAuctionLink}
                    </div>
                )}
            </div>
        </div>
    );
}
