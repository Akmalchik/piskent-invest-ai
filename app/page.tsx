'use client'; // Код работает в браузере

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { translations } from './components/translations';

// Загружаем карту динамически только в браузере
const MyInvestmentMap = dynamic(() => import('./components/MyInvestmentMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-[#0b1329] flex items-center justify-center text-xs text-slate-400">Xarita yuklanmoqda...</div>
});
import AiConsultant from './components/AiConsultant';

type DistrictProfile = {
  district_name?: string;
  hero_image?: string;
  population?: string | number;
  working_population?: string | number;
  mahallas?: string | number;
  area_km2?: string | number;
  electricity_percent?: string | number;
  gas_percent?: string | number;
  water_percent?: string | number;
  roads_percent?: string | number;
  description?: string;
  mayor_name?: string;
  mayor_photo?: string;
  deputy_name?: string;
  deputy_photo?: string;
  investment_department_name?: string;
  investment_head_name?: string;
  investment_phone?: string;
  investment_phone2?: string;
};

// Компонент для красивого плавного набегания цифр (CountUp)
function AnimatedNumber({ value }: { value: number }) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;

    const totalDuration = 1500;
    const incrementTime = Math.max(Math.floor(totalDuration / end), 15);

    const timer = setInterval(() => {
      start += Math.ceil(end / 60);
      if (start >= end) {
        clearInterval(timer);
        start = end;
      }
      setCount(start);
    }, incrementTime);

    return () => clearInterval(timer);
  }, [value]);

  return <span className="font-mono font-black text-cyan-400">{count.toLocaleString()}</span>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('ai');
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [districtProfile, setDistrictProfile] = useState<DistrictProfile | null>(null);

  const [mapViewport, setMapViewport] = useState({ center: [40.9022, 69.3444], zoom: 13 });
  const [lang, setLang] = useState<'uz' | 'ru' | 'en' | 'zh'>('uz');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Стейты управления скрытым режимом админа
  const [isAdminMode] = useState<boolean>(false);
  const [adminMarkerCoords, setAdminMarkerCoords] = useState<[number, number] | null>(null);
  const t = (translations as any)[lang] || translations.uz;

  React.useEffect(() => {
    fetch('/api/district-profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => setDistrictProfile(data || {}))
      .catch(() => setDistrictProfile({}));
  }, []);

  const showValue = (value: unknown, suffix = '') => {
    const text = String(value ?? '').trim();
    return text ? `${text}${suffix}` : t.noData;
  };

  const formatPlainNumber = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return showValue(value);
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(numeric);
  };

  const formatPopulation = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return showValue(value);
    if (lang === 'ru') return `${(numeric / 1000).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} тыс.`;
    if (lang === 'en') return `${(numeric / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} thousand`;
    if (lang === 'zh') return `${(numeric / 10000).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}万`;
    return `${(numeric / 1000).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ming`;
  };

  const formatArea = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return showValue(value, ' km²');
    return `${numeric.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km²`;
  };

  const communicationCards = [
    { title: t.drinkingWaterNetworks, value: '255,8 km', detail: `${t.supplyLevel}: 75,4%` },
    { title: t.electricityNetworks, value: '1068,4 km' },
    { title: t.sewageNetworks, value: '1,1 km' },
    { title: t.naturalGasNetworks, value: '536,5 km', detail: `${t.supplyLevel}: 87,1%` },
    { title: t.roadsNetworks, value: '201 km' },
  ];

  const contactRows = [
    [t.responsibleDepartment, districtProfile?.investment_department_name],
    [t.responsibleOfficer, districtProfile?.investment_head_name],
    [t.phone, districtProfile?.investment_phone],
    [t.phone, districtProfile?.investment_phone2],
  ].reduce((rows: Array<[string, string]>, [label, value]) => {
    const text = String(value || '').trim();
    const normalizedText = text.toLowerCase().replace(/[‘’`]/g, "'");
    const textDigits = text.replace(/\D/g, '');
    const isDuplicate = rows.some(([, existing]) => {
      const existingDigits = existing.replace(/\D/g, '');
      return existing === text || Boolean(textDigits && existingDigits && existingDigits === textDigits);
    });
    const isBlockedPerson = /to'?xtayev|алишер/i.test(normalizedText);

    if (text && !isDuplicate && !isBlockedPerson) {
      rows.push([String(label), text]);
    }

    return rows;
  }, []);

  // Дополнительные служебные переводы для каркаса, которых может не быть в translations.ts
  const localLabels = {
    uz: {
      portalInfo: "📍 Piskent tuman investitsiya portali",

	      mapTab: "🗺️ Investitsiya xaritasi",
	      aiTab: "🤖 AI Maslahatchi",
	      aboutTab: t.aboutTab,
	      ga: "GA",
	      ta: "TA"
	    },
    ru: {
      portalInfo: "📍 Инвестиционный портал Пискентского района",

	      mapTab: "🗺️ Инвестиционная карта",
	      aiTab: "🤖 AI Консультант",
	      aboutTab: t.aboutTab,
	      ga: "ГА",
	      ta: "ЕД"
	    },
    en: {
      portalInfo: "📍 Piskent District Investment Portal",

	      mapTab: "🗺️ Investment Map",
	      aiTab: "🤖 AI Consultant",
	      aboutTab: t.aboutTab,
	      ga: "HA",
	      ta: "LOTS"
	    },
    zh: {
      portalInfo: "📍 皮斯肯特地区投资门户网站",

	      mapTab: "🗺️ 投资地图",
	      aiTab: "🤖 AI 投资顾问",
	      aboutTab: t.aboutTab,
	      ga: "公顷",
	      ta: "个"
	    }
  }[lang] || {
    portalInfo: "📍 Piskent tuman investitsiya portali",

	    mapTab: "🗺️ Investitsiya xaritasi",
	    aiTab: "🤖 AI Maslahatchi",
	    aboutTab: t.aboutTab,
	    ga: "GA",
	    ta: "TA"
	  };

  const handleShowOnMap = (plot: any) => {
    if (plot && plot.polygonCoordinates && plot.polygonCoordinates[0]) {
      setMapViewport({ center: plot.polygonCoordinates[0], zoom: 15 });
      setSelectedPlot(plot);
      setActiveTab('map');
    }
  };

  const handleTabChange = (tabName: any) => {
    setActiveTab(tabName);
    setIsMobileMenuOpen(false);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (isAdminMode) {
      setAdminMarkerCoords([lat, lng]);
      console.log(`📍 Координаты админа: ${lat}, ${lng}`);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#030712] text-slate-100 font-sans overflow-hidden flex-col md:flex-row select-none">

      {/* ========================================================= */}
      {/* 1. БОКОВОЕ МЕНЮ (SIDEBAR) — БЕЗ ЛИШНИХ ПУНКТОВ            */}
      {/* ========================================================= */}
      <div className={`
        fixed inset-y-0 left-0 w-64 bg-[#0b1329] border-r border-slate-800 flex flex-col justify-between z-50 transition-transform duration-300
        md:relative md:transform-none
        ${isMobileMenuOpen ? 'transform-none' : '-translate-x-full md:translate-x-0'}
      `}>
        <div>
          {/* Брендинг */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/30">P</div>
              <div>
                <h1 className="font-bold text-sm tracking-wide text-white">Piskent Invest AI</h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                  {lang === 'zh' ? '政府官方门户' : lang === 'ru' ? 'Государственный Портал' : lang === 'en' ? 'Official Portal' : 'Davlat Portali'}
                </p>
              </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white text-lg">✕</button>
          </div>

          {/* Кнопки переключения страниц (ОСТАЛОСЬ СТРОГО ДВА СЕКТОРА) */}
          <nav className="p-4 space-y-1">
            <button onClick={() => handleTabChange('ai')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${activeTab === 'ai' ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-800/50'}`}>
              {localLabels.aiTab}
            </button>
	            <button onClick={() => handleTabChange('map')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${activeTab === 'map' ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-800/50'}`}>
	              {localLabels.mapTab}
	            </button>
	            <button onClick={() => handleTabChange('about')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${activeTab === 'about' ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-800/50'}`}>
	              {localLabels.aboutTab}
	            </button>
	          </nav>
        </div>

        {/* Финальный вид подвала: только версия, никакой кнопки админки */}
        <div className="p-4 border-t border-slate-800">
          <div className="text-[10px] text-slate-500 text-center font-medium">
            v1.1 • Piskent tumani
          </div>
        </div>
      </div>

      {/* Задний фон на мобилках */}
      {isMobileMenuOpen && (
        <div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/50 z-40 md:hidden" />
      )}

      {/* ========================================================= */}
      {/* 2. РАБОЧАЯ ОБЛАСТЬ (ШАПКА И КОНТЕНТ)                       */}
      {/* ========================================================= */}
      <div className="flex-1 h-full relative flex flex-col overflow-hidden w-full">

        {/* АДАПТИВНАЯ ШАПКА САЙТА */}
        <header className="h-14 w-full bg-[#0b1329]/60 backdrop-blur border-b border-slate-800 flex items-center justify-between px-4 md:px-6 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 bg-[#132247] rounded-lg text-white border border-slate-800 text-sm">
              ☰
            </button>
            <div className="text-[10px] md:text-[11px] text-slate-400 font-medium truncate max-w-[180px] sm:max-w-none">
              {localLabels.portalInfo}
            </div>
          </div>

          {/* ЖИВОЙ СЧЁТЧИК KPI НА 4 ЯЗЫКАХ */}
          <div className="hidden lg:flex items-center gap-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l border-r border-slate-800/80 px-6 mx-4">
            <div className="flex items-center gap-1.5">
              <span>{lang === 'zh' ? '总规划面积' : lang === 'ru' ? 'Площадь' : lang === 'en' ? 'Areas' : 'Maydonlar'}:</span>
              {/* Ставим заглушку 0, пока база пустая */}
              <AnimatedNumber value={0} />
              <span className="text-[10px] text-slate-500">{localLabels.ga}</span>
            </div>
            <span className="text-slate-800">•</span>
            <div className="flex items-center gap-1.5">
              <span>{lang === 'zh' ? '空闲投资土地' : lang === 'ru' ? 'Свободные лоты' : lang === 'en' ? 'Available lots' : 'Bo\'sh lotlar'}:</span>
              {/* Ставим заглушку 0 лотов */}
              <AnimatedNumber value={0} />
              <span className="text-[10px] text-slate-500">{localLabels.ta}</span>
            </div>
          </div>
          {/* Переключатель языков */}
          <div className="flex items-center gap-1 bg-[#040814] p-0.5 rounded-lg border border-slate-800">
            {(['uz', 'ru', 'en', 'zh'] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`px-2 py-0.5 rounded md:px-2.5 md:py-1 text-[9px] md:text-[10px] font-black uppercase transition-all ${lang === l ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400'}`}>{l}</button>
            ))}
          </div>
        </header>

        {/* НАПОЛНЕНИЕ СТРАНИЦ */}
        <div className="flex-1 w-full relative overflow-hidden">

          {/* ЭКРАН 1: AI MASLAHATCHI */}
          {activeTab === 'ai' && (
            <div className="w-full h-full p-4 md:p-6 bg-[#070d1e] overflow-y-auto md:overflow-hidden">
              <div className="w-full h-[calc(100vh-7rem)] md:h-full min-h-[450px]">
                <AiConsultant onSelectPlot={handleShowOnMap} lang={lang} isChatLayout={true} />
              </div>
            </div>
          )}

          {/* ЭКРАН 2: INVESTITSIYA XARITASI */}
	          {activeTab === 'map' && (
	            <div className="w-full h-full relative">
	              <MyInvestmentMap
                viewport={mapViewport}
                selectedPlot={selectedPlot}
                onSelectPlot={setSelectedPlot}
                lang={lang}
                isAdminMode={isAdminMode}
                onMapClick={handleMapClick}
                adminMarkerCoords={adminMarkerCoords}
	              />
	            </div>
	          )}

	          {activeTab === 'about' && (
	            <div className="w-full h-full overflow-y-auto bg-[#070d1e] p-4 md:p-6">
	              <div className="mx-auto max-w-6xl space-y-5">
		                <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#0b1329]">
		                  {districtProfile?.hero_image && (
		                    <img src={districtProfile.hero_image} alt={districtProfile.district_name || t.aboutTitle} className="absolute inset-0 h-full w-full object-cover opacity-25" />
		                  )}
		                  <div className="relative grid gap-5 lg:grid-cols-[1fr_280px] p-5 md:p-8 bg-gradient-to-r from-[#0b1329] via-[#0b1329]/95 to-[#0b1329]/75">
		                    <div>
		                      <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">{t.aboutTitle}</span>
		                      <h2 className="mt-3 max-w-3xl text-2xl md:text-4xl font-black text-white tracking-tight">
		                        {showValue(districtProfile?.district_name)}
		                      </h2>
		                      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
		                        {showValue(districtProfile?.description)}
		                      </p>
		                    </div>
		                    <div className="rounded-xl border border-cyan-500/20 bg-[#071127]/85 p-4">
		                      <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">{t.mayor}</span>
		                      <div className="mt-3 flex items-center gap-4 lg:block">
		                        <div className="h-20 w-20 lg:h-40 lg:w-full rounded-xl bg-slate-800 overflow-hidden flex-shrink-0">
		                          {districtProfile?.mayor_photo ? (
		                            <img src={districtProfile.mayor_photo} alt={districtProfile.mayor_name || t.mayor} className="h-full w-full object-cover" />
		                          ) : (
		                            <div className="h-full w-full flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-500 text-center px-2">
		                              {t.noData}
		                            </div>
		                          )}
		                        </div>
		                        <p className="text-sm font-bold text-white lg:mt-3">{showValue(districtProfile?.mayor_name)}</p>
		                      </div>
		                    </div>
		                  </div>
		                </div>

	                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
	                  {[
		                    [t.population, formatPopulation(districtProfile?.population)],
		                    [t.workingPopulation, formatPlainNumber(districtProfile?.working_population)],
		                    [t.mahallas, showValue(districtProfile?.mahallas)],
		                    [t.areaKm2, formatArea(districtProfile?.area_km2)],
		                  ].map(([label, value]) => (
		                    <div key={String(label)} className="rounded-xl border border-slate-800 bg-[#0b1329] p-4">
		                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
		                      <span className="mt-2 block text-lg font-black text-cyan-400">{value}</span>
		                    </div>
		                  ))}
		                </div>

		                <div className="rounded-xl border border-slate-800 bg-[#0b1329] p-4 md:p-5">
		                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-4">{t.communication}</h3>
		                  <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
		                    {communicationCards.map((item) => (
		                      <div key={item.title} className="rounded-xl border border-slate-800 bg-[#071127] p-4">
		                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-relaxed">{item.title}</span>
		                        <span className="mt-2 block text-lg font-black text-cyan-400">{item.value}</span>
		                        {item.detail && <span className="mt-2 block text-[11px] font-medium text-slate-400">{item.detail}</span>}
		                      </div>
		                    ))}
		                  </div>
		                </div>

		                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 md:p-5">
		                  <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400 mb-3">{t.contact}</h3>
		                  {contactRows.length > 0 ? (
		                    <div className="grid md:grid-cols-2 gap-3">
		                      {contactRows.map(([label, value]) => (
		                        <div key={`${label}-${value}`} className="rounded-xl border border-cyan-500/10 bg-[#071127]/70 p-3">
		                          <span className="block text-[10px] font-bold uppercase tracking-wider text-cyan-400">{label}</span>
		                          <span className={`mt-1 block text-sm text-slate-200 ${label === t.phone ? 'font-mono' : 'font-bold'}`}>{value}</span>
		                        </div>
		                      ))}
		                    </div>
		                  ) : (
		                    <p className="text-sm text-slate-300">{t.noData}</p>
		                  )}
		                </div>
	              </div>
	            </div>
	          )}
	        </div>


      </div>
    </div>
  );
}
