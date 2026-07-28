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

type Lang = 'uz' | 'ru' | 'en' | 'zh';
type Tab = 'home' | 'ai' | 'map' | 'about';

const VALID_TABS: Tab[] = ['home', 'ai', 'map', 'about'];

function getTabFromLocation(): Tab {
  if (typeof window === 'undefined') return 'home';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return VALID_TABS.includes(tab as Tab) ? tab as Tab : 'home';
}

const DISTRICT_PASSPORT = {
  districtName: {
    uz: 'Piskent tumani',
    ru: 'Пискентский район',
    en: 'Piskent district',
    zh: '皮斯肯特区',
  },
  createdDate: {
    uz: '1926-yil 29-sentabr',
    ru: '29 сентября 1926 года',
    en: 'September 29, 1926',
    zh: '1926年9月29日',
  },
  description: {
    uz: `Piskent tumani Toshkent viloyatining ma’muriy hududlaridan biri bo‘lib, ma’muriy markazi Piskent shahri hisoblanadi. Tuman 1926-yil 29-sentabrda tashkil topgan. Umumiy maydoni 749,09 kv.km, mahallalar soni 23 ta.

Tumanda qishloq xo‘jaligi, sanoat, xizmat ko‘rsatish, logistika va boshqa yo‘nalishlarda investitsiya loyihalarini amalga oshirish uchun imkoniyatlar mavjud. Aholi soni 105,1 ming kishini, jami mehnat resurslari 55 922 nafarni, iqtisodiy faol aholi esa 46 575 nafarni tashkil etadi.`,
    ru: `Пискентский район является одной из административных территорий Ташкентской области. Административный центр района — город Пискент. Район был образован 29 сентября 1926 года. Общая площадь составляет 749,09 кв.км, количество махаллей — 23.

В районе имеются возможности для реализации инвестиционных проектов в сферах сельского хозяйства, промышленности, услуг, логистики и других направлениях. Численность населения составляет 105,1 тыс. человек, общий объём трудовых ресурсов — 55 922 человека, экономически активное население — 46 575 человек.`,
    en: `Piskent district is one of the administrative territories of Tashkent region. The administrative center of the district is the city of Piskent. The district was established on September 29, 1926. Its total area is 749.09 sq. km, and it includes 23 mahallas.

The district offers opportunities for investment projects in agriculture, industry, services, logistics, and other sectors. The population is 105.1 thousand people, total labor resources amount to 55,922 people, and the economically active population is 46,575 people.`,
    zh: `皮斯肯特区是塔什干州的行政区域之一，行政中心为皮斯肯特市。该区成立于1926年9月29日，总面积为749.09平方公里，共有23个社区。

该区在农业、工业、服务业、物流及其他领域具备实施投资项目的潜力。人口为10.51万人，劳动力资源总数为55,922人，经济活动人口为46,575人。`,
  },
  area: 749.09,
  population: 105100,
  laborResources: 55922,
  economicallyActivePopulation: 46575,
  mahallas: 23,
  households: 19074,
  families: 27850,
  mayorName: 'Aripov Muzaffar Akbarovich',
  contactDepartment: {
    uz: 'Investitsiyalar, sanoat va savdo bo‘limi',
    ru: 'Отдел инвестиций, промышленности и торговли',
    en: 'Department of Investment, Industry and Trade',
    zh: '投资、工业和贸易部门',
  },
  contactResponsible: 'Nazirqulov Doniyor Rahmonjon o‘g‘li',
  contactPhone: '+998 99 512 75 70',
  investmentSectors: [
    { icon: '🌾', key: 'agriculture' },
    { icon: '🏭', key: 'industrySector' },
    { icon: '🏢', key: 'servicesSector' },
    { icon: '🚛', key: 'logisticsSector' },
    { icon: '🧱', key: 'constructionMaterials' },
    { icon: '🍞', key: 'foodIndustry' },
    { icon: '🧵', key: 'lightIndustry' },
    { icon: '🛒', key: 'tradeService' },
  ],
  communications: {
    drinkingWaterNetworkKm: '255,8 km',
    drinkingWaterCoveragePercent: '75,4%',
    electricityNetworkKm: '1068,4 km',
    gasNetworkKm: '536,5 km',
    gasCoveragePercent: '87,1%',
    roadsKm: '201 km',
  },
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
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [selectedPlot, setSelectedPlot] = useState(null);

  const [mapViewport, setMapViewport] = useState({ center: [40.9022, 69.3444], zoom: 13 });
  const [lang, setLang] = useState<Lang>('uz');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Стейты управления скрытым режимом админа
  const [isAdminMode] = useState<boolean>(false);
  const [adminMarkerCoords, setAdminMarkerCoords] = useState<[number, number] | null>(null);
  const t = (translations as any)[lang] || translations.uz;

  React.useEffect(() => {
    const syncTabWithUrl = () => {
      setActiveTab(getTabFromLocation());
      setIsMobileMenuOpen(false);
    };

    syncTabWithUrl();
    window.addEventListener('popstate', syncTabWithUrl);
    return () => window.removeEventListener('popstate', syncTabWithUrl);
  }, []);

  const showValue = (value: unknown, suffix = '') => {
    const text = String(value ?? '').trim();
    return text ? `${text}${suffix}` : t.noData;
  };

  const formatPlainNumber = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return showValue(value);
    if (lang === 'zh') return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(numeric);
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
    if (lang === 'en' || lang === 'zh') return `${numeric.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km²`;
    return `${numeric.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km²`;
  };

  const communicationCards = [
    { title: t.drinkingWaterNetworks, value: DISTRICT_PASSPORT.communications.drinkingWaterNetworkKm, detail: `${t.supplyLevel}: ${DISTRICT_PASSPORT.communications.drinkingWaterCoveragePercent}` },
    { title: t.electricityNetworks, value: DISTRICT_PASSPORT.communications.electricityNetworkKm },
    { title: t.naturalGasNetworks, value: DISTRICT_PASSPORT.communications.gasNetworkKm, detail: `${t.supplyLevel}: ${DISTRICT_PASSPORT.communications.gasCoveragePercent}` },
    { title: t.roadsNetworks, value: DISTRICT_PASSPORT.communications.roadsKm },
  ];

  const contactRows = [
    [t.responsibleDepartment, DISTRICT_PASSPORT.contactDepartment[lang]],
    [t.responsibleOfficer, DISTRICT_PASSPORT.contactResponsible],
    [t.phone, DISTRICT_PASSPORT.contactPhone],
  ];

  // Дополнительные служебные переводы для каркаса, которых может не быть в translations.ts
  const localLabels = {
    uz: {
      portalInfo: "📍 Piskent tuman investitsiya portali",

	      mapTab: "🗺️ Investitsiya xaritasi",
	      aiTab: "🤖 AI Maslahatchi",
	      aboutTab: `🏛️ ${t.aboutTab}`,
	      ga: "GA",
	      ta: "TA"
	    },
    ru: {
      portalInfo: "📍 Инвестиционный портал Пискентского района",

	      mapTab: "🗺️ Инвестиционная карта",
	      aiTab: "🤖 AI Консультант",
	      aboutTab: `🏛️ ${t.aboutTab}`,
	      ga: "ГА",
	      ta: "ЕД"
	    },
    en: {
      portalInfo: "📍 Piskent District Investment Portal",

	      mapTab: "🗺️ Investment Map",
	      aiTab: "🤖 AI Consultant",
	      aboutTab: `🏛️ ${t.aboutTab}`,
	      ga: "HA",
	      ta: "LOTS"
	    },
    zh: {
      portalInfo: "📍 皮斯肯特地区投资门户网站",

	      mapTab: "🗺️ 投资地图",
	      aiTab: "🤖 AI 投资顾问",
	      aboutTab: `🏛️ ${t.aboutTab}`,
	      ga: "公顷",
	      ta: "个"
	    }
  }[lang] || {
    portalInfo: "📍 Piskent tuman investitsiya portali",

	    mapTab: "🗺️ Investitsiya xaritasi",
	    aiTab: "🤖 AI Maslahatchi",
	    aboutTab: `🏛️ ${t.aboutTab}`,
	    ga: "GA",
	    ta: "TA"
	  };

  const heroLabels = {
    uz: {
      homeTab: 'Bosh sahifa',
      badge: 'PISKENT TUMANI',
      title: 'Investitsiya imkoniyatlari bir joyda',
      description: 'Piskent tumanidagi investitsiya obyektlari, yer maydonlari va infratuzilma ma’lumotlarini interaktiv xarita orqali o‘rganing hamda AI maslahatchidan tavsiya oling.',
      mapButton: 'Investitsiya xaritasi',
      aiButton: 'AI Maslahatchi',
      stats: [
        ['Investitsiya obyektlari', 'Obyektlar katalogi'],
        ['Yer maydonlari', 'Yer va bino takliflari'],
        ['Asosiy sohalar', 'Sanoat • Agro • Servis'],
        ['Axborot ochiqligi', 'Tizimlashtirilgan ma’lumotlar'],
      ],
    },
    ru: {
      homeTab: 'Главная',
      badge: 'ПИСКЕНТСКИЙ РАЙОН',
      title: 'Инвестиционные возможности в одном месте',
      description: 'Изучайте инвестиционные объекты, земельные участки и инфраструктуру Пискентского района на интерактивной карте и получайте рекомендации AI-консультанта.',
      mapButton: 'Инвестиционная карта',
      aiButton: 'AI-консультант',
      stats: [
        ['Инвестиционные объекты', 'Каталог объектов'],
        ['Земельные участки', 'Предложения земли и зданий'],
        ['Основные отрасли', 'Промышленность • Агро • Сервис'],
        ['Открытость информации', 'Систематизированные данные'],
      ],
    },
    en: {
      homeTab: 'Home',
      badge: 'PISKENT DISTRICT',
      title: 'Investment opportunities in one place',
      description: 'Explore investment properties, land plots, and infrastructure data in Piskent district through an interactive map and receive recommendations from the AI consultant.',
      mapButton: 'Investment map',
      aiButton: 'AI Consultant',
      stats: [
        ['Investment properties', 'Property catalogue'],
        ['Land plots', 'Land and building offers'],
        ['Core sectors', 'Industry • Agro • Services'],
        ['Information openness', 'Structured public data'],
      ],
    },
    zh: {
      homeTab: '首页',
      badge: '皮斯肯特区',
      title: '投资机会一站式平台',
      description: '通过互动地图了解皮斯肯特区的投资项目、土地和基础设施信息，并获取AI顾问的建议。',
      mapButton: '投资地图',
      aiButton: 'AI顾问',
      stats: [
        ['投资项目', '项目目录'],
        ['土地资源', '土地与建筑方案'],
        ['重点行业', '工业 • 农业 • 服务业'],
        ['信息公开', '结构化公开数据'],
      ],
    },
  }[lang];

  const handleShowOnMap = (plot: any) => {
    if (plot && plot.polygonCoordinates && plot.polygonCoordinates[0]) {
      setMapViewport({ center: plot.polygonCoordinates[0], zoom: 15 });
      setSelectedPlot(plot);
      handleTabChange('map');
    }
  };

  const handleTabChange = (tabName: Tab) => {
    if (!VALID_TABS.includes(tabName)) return;

    setActiveTab(tabName);
    setIsMobileMenuOpen(false);

    const url = new URL(window.location.href);
    if (url.searchParams.get('tab') === tabName) return;
    url.searchParams.set('tab', tabName);
    window.history.pushState(null, '', `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (isAdminMode) {
      setAdminMarkerCoords([lat, lng]);
      console.log(`📍 Координаты админа: ${lat}, ${lng}`);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#050a14] text-slate-100 font-sans overflow-hidden flex-col md:flex-row select-none">

      {/* ========================================================= */}
      {/* 1. БОКОВОЕ МЕНЮ (SIDEBAR) — БЕЗ ЛИШНИХ ПУНКТОВ            */}
      {/* ========================================================= */}
      {activeTab !== 'home' && (
        <div className={`
          fixed inset-y-0 left-0 w-64 bg-[#091120] border-r border-slate-700/60 flex flex-col justify-between z-50 transition-transform duration-300
          md:relative md:transform-none
          ${isMobileMenuOpen ? 'transform-none' : '-translate-x-full md:translate-x-0'}
        `}>
          <div>
            {/* Брендинг */}
            <div className="p-5 border-b border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-cyan-700 rounded-md border border-cyan-500/30 flex items-center justify-center font-bold text-white">P</div>
                <div>
                  <h1 className="font-bold text-sm tracking-wide text-white">Piskent Invest AI</h1>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                    {lang === 'zh' ? '政府官方门户' : lang === 'ru' ? 'Государственный Портал' : lang === 'en' ? 'Official Portal' : 'Davlat Portali'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white text-lg">✕</button>
            </div>

            <nav className="p-4 space-y-1">
              <button onClick={() => handleTabChange('home')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-transparent text-xs font-semibold text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-slate-200">
                <span className="h-2 w-2 rounded-sm border border-current" />
                {heroLabels.homeTab}
              </button>
              <button onClick={() => handleTabChange('ai')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-xs font-semibold transition-colors ${activeTab === 'ai' ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50' : 'text-slate-400 border-transparent hover:bg-slate-800/50 hover:text-slate-200'}`}>
                {localLabels.aiTab}
              </button>
              <button onClick={() => handleTabChange('map')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-xs font-semibold transition-colors ${activeTab === 'map' ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50' : 'text-slate-400 border-transparent hover:bg-slate-800/50 hover:text-slate-200'}`}>
                {localLabels.mapTab}
              </button>
              <button onClick={() => handleTabChange('about')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-xs font-semibold transition-colors ${activeTab === 'about' ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50' : 'text-slate-400 border-transparent hover:bg-slate-800/50 hover:text-slate-200'}`}>
                {localLabels.aboutTab}
              </button>
            </nav>
          </div>

          <div className="p-4 border-t border-slate-700/60">
            <div className="text-[10px] text-slate-500 text-center font-medium">
              v1.1 • Piskent tumani
            </div>
          </div>
        </div>
      )}

      {/* Задний фон на мобилках */}
      {activeTab !== 'home' && isMobileMenuOpen && (
        <div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/50 z-40 md:hidden" />
      )}

      {/* ========================================================= */}
      {/* 2. РАБОЧАЯ ОБЛАСТЬ (ШАПКА И КОНТЕНТ)                       */}
      {/* ========================================================= */}
      <div className="flex-1 h-full relative flex flex-col overflow-hidden w-full">

        {/* АДАПТИВНАЯ ШАПКА САЙТА */}
        <header className="h-14 w-full bg-[#091120]/95 backdrop-blur border-b border-slate-700/60 flex items-center justify-between px-4 md:px-6 z-20">
          <div className="flex items-center gap-3">
            {activeTab !== 'home' && (
              <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 bg-slate-800/70 rounded-lg text-white border border-slate-700 text-sm">
                ☰
              </button>
            )}
            <div className="text-[10px] md:text-[11px] text-slate-400 font-medium truncate max-w-[180px] sm:max-w-none">
              {localLabels.portalInfo}
            </div>
          </div>

          {activeTab === 'home' && (
            <nav className="hidden items-center gap-1 lg:flex">
              <button onClick={() => handleTabChange('map')} className="rounded-lg px-3 py-2 text-[10px] font-semibold text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-cyan-200">
                {heroLabels.mapButton}
              </button>
              <button onClick={() => handleTabChange('ai')} className="rounded-lg px-3 py-2 text-[10px] font-semibold text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-cyan-200">
                {heroLabels.aiButton}
              </button>
              <button onClick={() => handleTabChange('about')} className="rounded-lg px-3 py-2 text-[10px] font-semibold text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-cyan-200">
                {t.aboutTab}
              </button>
            </nav>
          )}

          {/* Переключатель языков */}
          <div className="flex items-center gap-1 bg-[#050a14] p-0.5 rounded-lg border border-slate-700/70">
            {(['uz', 'ru', 'en', 'zh'] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`px-2 py-0.5 rounded-md md:px-2.5 md:py-1 text-[9px] md:text-[10px] font-bold uppercase transition-colors ${lang === l ? 'bg-cyan-800 text-cyan-50' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>
            ))}
          </div>
        </header>

        {/* НАПОЛНЕНИЕ СТРАНИЦ */}
        <div className="flex-1 w-full relative overflow-hidden">

          {/* ЭКРАН 0: LANDING / HERO */}
          {activeTab === 'home' && (
            <div className="h-full w-full overflow-y-auto bg-[#050b16]">
              <section className="relative min-h-full overflow-hidden px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
                <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-cyan-900/10 blur-3xl" />
                <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-900/10 blur-3xl" />

                <div className="relative mx-auto max-w-[1500px]">
                  <div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-8 xl:grid-cols-[0.78fr_1.22fr] xl:gap-12">
                    <div className="max-w-2xl">
                      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-700/40 bg-cyan-950/30 px-3 py-1.5 text-[10px] font-bold tracking-[0.22em] text-cyan-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        {heroLabels.badge}
                      </div>

                      <p className="mt-6 text-sm font-semibold tracking-[0.18em] text-slate-400">Piskent Invest AI</p>
                      <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-[3.5rem]">
                        {heroLabels.title}
                      </h1>
                      <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                        {heroLabels.description}
                      </p>

                      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                        <button
                          onClick={() => handleTabChange('map')}
                          className="inline-flex min-h-11 items-center justify-center gap-3 rounded-lg border border-cyan-600 bg-cyan-700 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-950/20 transition-colors hover:bg-cyan-600"
                        >
                          <span className="h-2 w-2 rounded-full border-2 border-white" />
                          {heroLabels.mapButton}
                        </button>
                        <button
                          onClick={() => handleTabChange('ai')}
                          className="inline-flex min-h-11 items-center justify-center gap-3 rounded-lg border border-slate-600/80 bg-slate-900/70 px-5 py-3 text-xs font-bold text-slate-100 transition-colors hover:border-cyan-700/60 hover:bg-slate-800"
                        >
                          <span className="grid h-4 w-4 grid-cols-2 gap-0.5">
                            <span className="rounded-[2px] bg-cyan-400/80" />
                            <span className="rounded-[2px] bg-cyan-400/40" />
                            <span className="rounded-[2px] bg-cyan-400/40" />
                            <span className="rounded-[2px] bg-cyan-400/80" />
                          </span>
                          {heroLabels.aiButton}
                        </button>
                      </div>
                    </div>

                    <div className="relative mx-auto flex w-full max-w-4xl items-center justify-center py-4 sm:py-6 lg:min-h-[540px] lg:py-0">
                      <div className="pointer-events-none absolute inset-[12%] rounded-[45%] bg-cyan-500/15 blur-[80px]" />
                      <div className="pointer-events-none absolute bottom-[12%] left-[10%] right-[5%] h-16 rounded-[50%] bg-black/65 blur-2xl" />
                      <div className="hero-map-float relative z-10 w-full max-w-[760px] xl:max-w-[840px]">
                        <img
                          src="/hero/piskent-hero-map.png"
                          alt="Piskent Invest AI 3D map"
                          className="h-auto max-h-[430px] w-full object-contain drop-shadow-[0_28px_42px_rgba(0,0,0,0.42)] sm:max-h-[500px] lg:max-h-[570px]"
                        />
                        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                          <span className="hero-map-pulse left-[28%] top-[31%]" />
                          <span className="hero-map-pulse hero-map-pulse-delayed left-[56%] top-[47%]" />
                          <span className="hero-map-pulse hero-map-pulse-late right-[21%] top-[27%]" />
                          <span className="hero-data-flow hero-data-flow-one hidden sm:block" />
                          <span className="hero-data-flow hero-data-flow-two hidden sm:block" />
                          <span className="hero-data-flow hero-data-flow-three hidden sm:block" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 grid grid-cols-2 gap-3 lg:mt-5 lg:grid-cols-4">
                    {heroLabels.stats.map(([label, value], index) => (
                      <div key={label} className="group relative overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-br from-[#0b1728]/95 to-[#07101d]/95 p-4 shadow-[0_16px_36px_rgba(0,0,0,0.18)] backdrop-blur sm:p-5">
                        <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent" />
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-700/40 bg-cyan-950/45 text-[9px] font-bold text-cyan-300 shadow-inner shadow-cyan-300/5">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
                        </div>
                        <p className="mt-3 text-xs font-semibold leading-5 text-slate-200 sm:text-sm">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ЭКРАН 1: AI MASLAHATCHI */}
          {activeTab === 'ai' && (
            <div className="w-full h-full p-4 md:p-6 bg-[#060c18] overflow-y-auto md:overflow-hidden">
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
	            <div className="w-full h-full overflow-y-auto bg-[#060c18] p-4 md:p-6">
	              <div className="mx-auto max-w-6xl space-y-5">
		                <div className="relative overflow-hidden rounded-xl border border-slate-700/60 bg-[#0a1324] shadow-lg shadow-black/10">
		                  <div className="relative grid gap-5 lg:grid-cols-[1fr_280px] p-5 md:p-8">
		                    <div>
		                      <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">{t.aboutTitle}</span>
		                      <h2 className="mt-3 max-w-3xl text-2xl md:text-4xl font-black text-white tracking-tight">
		                        {DISTRICT_PASSPORT.districtName[lang]}
				                      </h2>
		                      <p className="mt-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
		                        {t.createdDate}: {DISTRICT_PASSPORT.createdDate[lang]}
		                      </p>
				                      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
				                        {DISTRICT_PASSPORT.description[lang]}
				                      </p>
		                    </div>
		                    <div className="rounded-xl border border-slate-700/60 bg-[#07101e] p-4">
		                      <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">{t.mayor}</span>
		                      <div className="mt-3 flex items-center gap-4 lg:block">
		                        <div className="h-20 w-20 lg:h-40 lg:w-full rounded-xl bg-slate-800 overflow-hidden flex-shrink-0">
		                          <div className="h-full w-full flex items-center justify-center text-2xl font-black text-cyan-500 bg-cyan-500/5">M</div>
		                        </div>
		                        <p className="text-sm font-bold text-white lg:mt-3">{DISTRICT_PASSPORT.mayorName}</p>
		                      </div>
		                    </div>
		                  </div>
		                </div>

	                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
		                  {[
			                    [t.population, formatPopulation(DISTRICT_PASSPORT.population)],
			                    [t.workingPopulation, formatPlainNumber(DISTRICT_PASSPORT.laborResources)],
			                    [t.economicallyActivePopulation, formatPlainNumber(DISTRICT_PASSPORT.economicallyActivePopulation)],
			                    [t.mahallas, showValue(DISTRICT_PASSPORT.mahallas)],
			                    [t.areaKm2, formatArea(DISTRICT_PASSPORT.area)],
			                  ].map(([label, value]) => (
		                    <div key={String(label)} className="rounded-xl border border-slate-700/60 bg-[#0a1324] p-4 shadow-sm shadow-black/10">
		                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
		                      <span className="mt-2 block text-lg font-black text-cyan-400">{value}</span>
		                    </div>
		                  ))}
			                </div>

		                <div className="rounded-xl border border-slate-700/60 bg-[#0a1324] p-4 md:p-5 shadow-sm shadow-black/10">
		                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-4">{t.investmentSectors}</h3>
		                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
		                    {DISTRICT_PASSPORT.investmentSectors.map((sector) => (
		                      <div key={sector.key} className="rounded-lg border border-slate-700/50 bg-[#07101e] p-3 flex items-center gap-3">
		                        <span className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-sm">{sector.icon}</span>
		                        <span className="text-xs font-bold text-slate-200 leading-snug">{t[sector.key]}</span>
		                      </div>
		                    ))}
		                  </div>
		                </div>

		                <div className="rounded-xl border border-slate-700/60 bg-[#0a1324] p-4 md:p-5 shadow-sm shadow-black/10">
		                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-4">{t.communication}</h3>
		                  <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
		                    {communicationCards.map((item) => (
		                      <div key={item.title} className="rounded-lg border border-slate-700/50 bg-[#07101e] p-4">
		                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-relaxed">{item.title}</span>
		                        <span className="mt-2 block text-lg font-black text-cyan-400">{item.value}</span>
		                        {item.detail && <span className="mt-2 block text-[11px] font-medium text-slate-400">{item.detail}</span>}
		                      </div>
		                    ))}
		                  </div>
		                </div>

		                <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/15 p-4 md:p-5">
		                  <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400 mb-3">{t.contact}</h3>
		                  <div className="grid md:grid-cols-3 gap-3">
		                    {contactRows.map(([label, value]) => (
		                      <div key={`${label}-${value}`} className="rounded-xl border border-cyan-500/10 bg-[#071127]/70 p-3">
		                        <span className="block text-[10px] font-bold uppercase tracking-wider text-cyan-400">{label}</span>
		                        <span className={`mt-1 block text-sm text-slate-200 ${label === t.phone ? 'font-mono' : 'font-bold'}`}>{value}</span>
		                      </div>
		                    ))}
		                  </div>
		                </div>
	              </div>
	            </div>
	          )}
		        </div>

        <style jsx>{`
          .hero-map-float {
            animation: heroMapFloat 10s ease-in-out infinite;
            transform-origin: 50% 60%;
          }

          .hero-map-pulse {
            position: absolute;
            width: 8px;
            height: 8px;
            border: 1px solid rgba(207, 250, 254, 0.92);
            border-radius: 999px;
            background: rgba(34, 211, 238, 0.88);
            box-shadow: 0 0 10px rgba(34, 211, 238, 0.8);
            animation: heroMapPulse 8s ease-out infinite;
          }

          .hero-map-pulse::after {
            content: '';
            position: absolute;
            inset: -5px;
            border: 1px solid rgba(103, 232, 249, 0.45);
            border-radius: inherit;
          }

          .hero-map-pulse-delayed { animation-delay: -2.7s; }
          .hero-map-pulse-late { animation-delay: -5.4s; }

          .hero-data-flow {
            position: absolute;
            width: 5px;
            height: 5px;
            border-radius: 999px;
            background: rgba(103, 232, 249, 0.9);
            box-shadow: 0 0 5px rgba(103, 232, 249, 0.9), 0 0 12px rgba(34, 211, 238, 0.45);
            opacity: 0;
          }

          .hero-data-flow::after {
            content: '';
            position: absolute;
            right: 4px;
            top: 2px;
            width: 18px;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(103, 232, 249, 0.4));
            transform: rotate(-18deg);
            transform-origin: right center;
          }

          .hero-data-flow-one {
            left: 24%;
            top: 63%;
            animation: heroDataFlowOne 10s ease-in-out infinite;
          }

          .hero-data-flow-two {
            left: 43%;
            top: 69%;
            animation: heroDataFlowTwo 11.5s ease-in-out -3.8s infinite;
          }

          .hero-data-flow-three {
            left: 61%;
            top: 43%;
            animation: heroDataFlowThree 9s ease-in-out -6s infinite;
          }

          @keyframes heroMapFloat {
            0%, 100% { transform: translate3d(0, 0, 0); }
            50% { transform: translate3d(0, -6px, 0); }
          }

          @keyframes heroMapPulse {
            0%, 55%, 100% {
              opacity: 0.38;
              transform: scale(0.78);
              box-shadow: 0 0 6px rgba(34, 211, 238, 0.45);
            }
            18% {
              opacity: 0.95;
              transform: scale(1);
              box-shadow: 0 0 18px rgba(34, 211, 238, 0.75);
            }
            34% {
              opacity: 0.48;
              transform: scale(1.65);
            }
          }

          @keyframes heroDataFlowOne {
            0%, 100% {
              opacity: 0;
              transform: translate3d(0, 0, 0);
            }
            18% { opacity: 0.35; }
            45% { opacity: 0.85; }
            82% { opacity: 0.45; }
            92% {
              opacity: 0;
              transform: translate3d(150px, -56px, 0);
            }
          }

          @keyframes heroDataFlowTwo {
            0%, 100% {
              opacity: 0;
              transform: translate3d(0, 0, 0);
            }
            20% { opacity: 0.3; }
            48% { opacity: 0.75; }
            84% { opacity: 0.4; }
            94% {
              opacity: 0;
              transform: translate3d(112px, -82px, 0);
            }
          }

          @keyframes heroDataFlowThree {
            0%, 100% {
              opacity: 0;
              transform: translate3d(0, 0, 0);
            }
            16% { opacity: 0.28; }
            44% { opacity: 0.72; }
            80% { opacity: 0.4; }
            92% {
              opacity: 0;
              transform: translate3d(92px, 34px, 0);
            }
          }

          @media (max-width: 640px) {
            .hero-map-float { animation-duration: 12s; }
            .hero-map-pulse { opacity: 0.55; }
          }

          @media (prefers-reduced-motion: reduce) {
            .hero-map-float,
            .hero-map-pulse,
            .hero-data-flow {
              animation: none;
            }

            .hero-map-pulse { opacity: 0.5; }
            .hero-data-flow { opacity: 0.25; }
          }
        `}</style>

	      </div>
    </div>
  );
}
