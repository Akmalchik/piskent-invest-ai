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

// Компонент для красивого плавного набегания цифр (CountUp)
function AnimatedNumber({ value }: { value: number }) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;

    let totalDuration = 1500;
    let incrementTime = Math.max(Math.floor(totalDuration / end), 15);

    let timer = setInterval(() => {
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
  const [mapViewport, setMapViewport] = useState({ center: [40.9022, 69.3444], zoom: 13 });
  const [lang, setLang] = useState<'uz' | 'ru' | 'en' | 'zh'>('uz');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Стейты управления скрытым режимом админа
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [adminMarkerCoords, setAdminMarkerCoords] = useState<[number, number] | null>(null);

  // Подключаем твой официальный словарь переводов
  const t = translations[lang] || translations['uz'];

  // Дополнительные служебные переводы для каркаса, которых может не быть в translations.ts
  const localLabels = {
    uz: {
      portalInfo: "📍 Piskent tuman investitsiya portali",
      adminOn: "🔒 Admin rejimini yoqish",
      adminOff: "🔓 Admin: Foydalanuvchi rejimi",
      mapTab: "🗺️ Investitsiya xaritasi",
      aiTab: "🤖 AI Maslahatchi",
      ga: "GA",
      ta: "TA"
    },
    ru: {
      portalInfo: "📍 Инвестиционный портал Пискентского района",
      adminOn: "🔒 Включить режим админа",
      adminOff: "🔓 Админ: Режим инвестора",
      mapTab: "🗺️ Инвестиционная карта",
      aiTab: "🤖 AI Консультант",
      ga: "ГА",
      ta: "ЕД"
    },
    en: {
      portalInfo: "📍 Piskent District Investment Portal",
      adminOn: "🔒 Enable Admin Mode",
      adminOff: "🔓 Admin: User Mode",
      mapTab: "🗺️ Investment Map",
      aiTab: "🤖 AI Consultant",
      ga: "HA",
      ta: "LOTS"
    },
    zh: {
      portalInfo: "📍 皮斯肯特地区投资门户网站",
      adminOn: "🔒 开启管理员模式",
      adminOff: "🔓 管理员：投资者模式",
      mapTab: "🗺️ 投资地图",
      aiTab: "🤖 AI 投资顾问",
      ga: "公顷",
      ta: "个"
    }
  }[lang] || {
    portalInfo: "📍 Piskent tuman investitsiya portali",
    adminOn: "🔒 Admin rejimini yoqish",
    adminOff: "🔓 Admin: Foydalanuvchi rejimi",
    mapTab: "🗺️ Investitsiya xaritasi",
    aiTab: "🤖 AI Maslahatchi",
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
                  {lang === 'zh' ? '政府官方门户' : lang === 'ru' ? 'Государственный Портал' : 'Davlat Portali'}
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
          </nav>
        </div>

        {/* УПРАВЛЯЕМАЯ СЕКРЕТНАЯ АДМИНКА ДЛЯ ПРЕЗЕНТАЦИИ ХОКИМУ */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={() => {
              setIsAdminMode(!isAdminMode);
              setAdminMarkerCoords(null);
            }}
            className={`w-full py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border text-center ${isAdminMode
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-inner'
              : 'bg-slate-900/40 text-slate-500 border-slate-800/60 hover:text-slate-300 hover:border-slate-700'
              }`}
          >
            {isAdminMode ? localLabels.adminOff : localLabels.adminOn}
          </button>
          <div className="text-[10px] text-slate-500 text-center font-medium">v1.1 • Piskent tumani</div>
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
              <span>{lang === 'zh' ? '总规划面积' : lang === 'ru' ? 'Площадь' : 'Maydonlar'}:</span>
              {/* Ставим заглушку 0, пока база пустая */}
              <AnimatedNumber value={0} />
              <span className="text-[10px] text-slate-500">{localLabels.ga}</span>
            </div>
            <span className="text-slate-800">•</span>
            <div className="flex items-center gap-1.5">
              <span>{lang === 'zh' ? '空闲投资土地' : lang === 'ru' ? 'Свободные лоты' : 'Bo\'sh lotlar'}:</span>
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
            <div className="w-full h-full flex flex-col md:flex-row p-4 md:p-6 gap-4 md:gap-6 bg-[#070d1e] overflow-y-auto md:overflow-hidden">
              <div className="w-full md:w-5/12 h-auto md:h-full shrink-0">
                <AiConsultant onSelectPlot={handleShowOnMap} lang={lang} isChatLayout={false} />
              </div>
              <div className="w-full md:w-7/12 h-[450px] md:h-full min-h-[350px]">
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
        </div>


      </div>
    </div>
  );
}