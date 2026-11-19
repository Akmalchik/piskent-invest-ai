'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PlotRecord } from '@/lib/plotTypes';
import { visibleMapPlot } from '@/lib/publicPlotVisibility';

type Lang = 'uz' | 'ru' | 'en' | 'zh';
type Category = 'all' | 'land' | 'building' | 'land_building';

const words = {
  uz: {
    subtitle: 'Piskent tumani investitsiya portali', title: 'Investitsiya obyektlari',
    eyebrow: 'PISKENT INVEST AI / OBYEKTLAR', intro: 'Xaritadagi obyektlar — endi qulay foto-katalogda. Har bir obyekt uchun xaritada joylashuvini ko‘rishingiz mumkin.',
    map: 'Xarita', home: 'Bosh sahifa', all: 'Barchasi', land: 'Yer maydonlari',
    building: 'Binolar', land_building: 'Yer va bino', search: 'Obyekt nomi yoki raqamini kiriting',
    found: 'ta obyekt', area: 'Yer maydoni', buildingArea: 'Bino maydoni', status: 'Holati',
    source: 'Rasmiy manba', viewMap: 'Xaritada ko‘rish', seeSource: 'Manbani ko‘rish',
    photoMissing: 'Rasm mavjud emas', unknown: 'Ma’lumot yo‘q',
    loading: 'Obyektlar yuklanmoqda...', empty: 'Mos obyekt topilmadi',
    failed: 'Obyektlarni yuklab bo‘lmadi. Keyinroq urinib ko‘ring.',
    fallback: 'Asosiy ma’lumotlar bazasi vaqtincha ishlamayapti. Zaxira obyektlar ko‘rsatilmoqda.',
    notice: 'Obyektlar xarita bilan bir xil ma’lumotlar manbasidan olinadi. Tasdiqlanmagan ma’lumotlar investitsiya sharti sifatida ko‘rsatilmaydi.',
    total: 'Jami obyektlar', property: 'Obyekt turi', noSource: 'Manba havolasi mavjud emas',
    verification: 'Ma’lumotlar tekshirilmoqda'
  },
  ru: {
    subtitle: 'Инвестиционный портал Пискентского района', title: 'Инвестиционные объекты',
    eyebrow: 'PISKENT INVEST AI / ОБЪЕКТЫ', intro: 'Все объекты с карты — в удобном фотокаталоге. Откройте местоположение любого объекта одним нажатием.',
    map: 'Карта', home: 'Главная', all: 'Все объекты', land: 'Земельные участки',
    building: 'Здания', land_building: 'Земля и здание', search: 'Название или номер объекта',
    found: 'объектов', area: 'Площадь участка', buildingArea: 'Площадь здания', status: 'Статус',
    source: 'Официальный источник', viewMap: 'На карте', seeSource: 'Источник',
    photoMissing: 'Фотография отсутствует', unknown: 'Нет данных',
    loading: 'Загрузка объектов...', empty: 'Объекты не найдены',
    failed: 'Не удалось загрузить объекты. Повторите попытку позже.',
    fallback: 'Основная база временно недоступна. Показаны резервные объекты.',
    notice: 'Каталог и карта используют один источник данных. Неподтверждённые сведения не считаются инвестиционными условиями.',
    total: 'Всего объектов', property: 'Тип объекта', noSource: 'Ссылка на источник отсутствует',
    verification: 'Данные проверяются'
  },
  en: {
    subtitle: 'Piskent district investment portal', title: 'Investment properties',
    eyebrow: 'PISKENT INVEST AI / PROPERTIES', intro: 'All mapped properties in one visual catalogue. Open any property directly on the map.',
    map: 'Map', home: 'Home', all: 'All properties', land: 'Land plots',
    building: 'Buildings', land_building: 'Land and buildings', search: 'Search property name or ID',
    found: 'properties', area: 'Land area', buildingArea: 'Building area', status: 'Status',
    source: 'Official source', viewMap: 'View on map', seeSource: 'Source',
    photoMissing: 'No property photo', unknown: 'Not available',
    loading: 'Loading properties...', empty: 'No matching properties',
    failed: 'Could not load properties. Please try again.',
    fallback: 'The primary database is temporarily unavailable. Showing backup properties.',
    notice: 'The catalogue and map use the same source. Unverified information is not presented as confirmed investment terms.',
    total: 'Total properties', property: 'Property type', noSource: 'No source link',
    verification: 'Information under review'
  },
  zh: {
    subtitle: '皮斯肯特区投资门户', title: '投资项目',
    eyebrow: 'PISKENT INVEST AI / 投资项目', intro: '地图上的项目现在也可在图片目录中浏览。点击即可在地图上查看项目位置。',
    map: '地图', home: '首页', all: '全部项目', land: '土地',
    building: '建筑物', land_building: '土地与建筑', search: '搜索项目名称或编号',
    found: '个项目', area: '土地面积', buildingArea: '建筑面积', status: '状态',
    source: '官方来源', viewMap: '在地图上查看', seeSource: '查看来源',
    photoMissing: '暂无实景照片', unknown: '暂无数据',
    loading: '正在加载项目...', empty: '未找到符合条件的项目',
    failed: '加载失败，请稍后再试。',
    fallback: '主数据库暂时不可用，当前显示备份项目。',
    notice: '目录与地图使用同一数据来源。未经验证的信息不会被作为确认的投资条件展示。',
    total: '项目总数', property: '项目类型', noSource: '暂无来源链接',
    verification: '信息待核实'
  }
} as const;

function readLang(): Lang {
  if (typeof window === 'undefined') return 'uz';
  const language = new URLSearchParams(window.location.search).get('lang');
  return language === 'ru' || language === 'en' || language === 'zh' ? language : 'uz';
}

function categoryOf(plot: PlotRecord): Exclude<Category, 'all'> {
  const type = plot.property_type || plot.propertyType;
  if (type === 'building' || type === 'land_building') return type;
  return 'land';
}

function formatArea(value: unknown, unit: string, fallback: string) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `${number.toLocaleString('en-US')} ${unit}` : fallback;
}

function getPhoto(plot: PlotRecord) {
  const candidate = plot.image || plot.image_url || plot.photo_url;
  if (typeof candidate !== 'string') return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function Photo({ plot, missing }: { plot: PlotRecord; missing: string }) {
  const url = getPhoto(plot);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return (
    <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-gradient-to-br from-[#101f35] via-[#0a1324] to-[#07101e]">
      {url && !broken ? (
        // External E-auksion/Supabase images may be hosted on unconfigured domains.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={plot.name} loading="lazy" onError={() => setBroken(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-center text-slate-500">
          <svg aria-hidden="true" width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
          </svg>
          <span className="px-4 text-xs font-medium">{missing}</span>
        </div>
      )}
    </div>
  );
}

export default function CatalogPage() {
  const [lang, setLang] = useState<Lang>('uz');
  const [items, setItems] = useState<PlotRecord[]>([]);
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => { setLang(readLang()); }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch('/api/save-plots', { cache: 'no-store' });
        if (!response.ok) throw new Error('Load failed');
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid data shape');
        if (mounted) {
          setItems((data as PlotRecord[]).filter(visibleMapPlot));
          setNotice(response.headers.get('X-Data-Source') === 'local-fallback' ? 'fallback' : '');
        }
      } catch {
        if (mounted) { setItems([]); setError(true); }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const d = words[lang];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter(plot =>
      (category === 'all' || categoryOf(plot) === category) &&
      (!term || [plot.name, String(plot.id), plot.industry || ''].some(value => value.toLowerCase().includes(term)))
    );
  }, [items, category, query]);
  const navSuffix = `?lang=${lang}`;
  const mapUrl = (id: PlotRecord['id']) => `/?tab=map&plotId=${encodeURIComponent(String(id))}&lang=${lang}`;

  return (
    <main className="min-h-screen bg-[#050a14] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-700/60 bg-[#091120]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <a href={`/${navSuffix}`} className="text-base font-extrabold tracking-tight">
            PISKENT <span className="text-cyan-400">INVEST AI</span>
            <span className="mt-0.5 block text-[10px] font-medium tracking-normal text-slate-400">{d.subtitle}</span>
          </a>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Primary">
            <a href={`/${navSuffix}`} className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-slate-800/60 hover:text-cyan-200">{d.home}</a>
            <a href={`/?tab=map&lang=${lang}`} className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-slate-800/60 hover:text-cyan-200">{d.map}</a>
            <div className="ml-1 flex rounded-lg border border-slate-700 bg-[#050a14] p-0.5" aria-label="Language">
              {(['uz','ru','en','zh'] as Lang[]).map(language => (
                <button type="button" key={language}
                  aria-pressed={lang === language}
                  onClick={() => {
                    setLang(language);
                    window.history.replaceState(null, '', `/catalog?lang=${language}`);
                  }}
                  className={`rounded-md px-2 py-1.5 text-[10px] font-bold uppercase ${lang === language ? 'bg-cyan-800 text-cyan-50' : 'text-slate-400 hover:text-slate-200'}`}>{language}</button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 md:py-12">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-cyan-300">
              <span className="h-px w-7 bg-cyan-500" />{d.eyebrow}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{d.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{d.intro}</p>
          </div>
          <div className="min-w-[154px] rounded-xl border border-slate-700/60 bg-[#0a1324] px-5 py-4">
            <span className="text-xs font-medium text-slate-400">{d.total}</span>
            <div className="text-3xl font-bold tabular-nums">{items.length}</div>
          </div>
        </div>
        <div className="mb-6 rounded-lg border-l-2 border-cyan-500 bg-[#0a1324] px-4 py-3 text-xs leading-relaxed text-slate-300">
          {d.notice}
        </div>
        {notice === 'fallback' && <p role="status" className="mb-5 rounded-lg border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-200">{d.fallback}</p>}

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {(['all','land','building','land_building'] as Category[]).map(value => (
            <button key={value} type="button" aria-pressed={category === value}
              onClick={() => setCategory(value)}
              className={`rounded-lg border px-4 py-2.5 text-xs font-bold transition ${category === value ? 'border-cyan-700 bg-cyan-950/60 text-cyan-200' : 'border-slate-700 bg-[#0a1324] text-slate-300 hover:border-cyan-600 hover:text-cyan-200'}`}>{d[value]}</button>
          ))}
          <input aria-label={d.search} placeholder={d.search} value={query} onChange={e => setQuery(e.target.value)}
            className="ml-auto min-w-[220px] flex-1 rounded-lg border border-slate-700 bg-[#0a1324] px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500 sm:max-w-[340px]" />
        </div>

        {loading ? <p role="status" className="rounded-xl border border-slate-700 bg-[#0a1324] p-9 text-center text-sm text-slate-400">{d.loading}</p>
          : error ? <p role="alert" className="rounded-xl border border-rose-800/50 bg-rose-950/30 p-9 text-center text-sm text-rose-200">{d.failed}</p>
          : filtered.length === 0 ? <p className="rounded-xl border border-slate-700 bg-[#0a1324] p-9 text-center text-sm text-slate-400">{d.empty}</p>
          : <>
            <p className="mb-3 text-xs text-slate-400">{filtered.length} {d.found}</p>
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label={d.title}>
              {filtered.map(plot => {
                const kind = categoryOf(plot);
                const source = plot.auksionUrl || plot.auksion_url || plot.auction_url;
                const verifiedSource = typeof source === 'string' && /^https:\/\/(?:[a-z0-9-]+\.)?e-auksion\.uz(?:\/|$)/i.test(source);
                return (
                  <article key={String(plot.id)} className="group flex overflow-hidden flex-col rounded-xl border border-slate-700/70 bg-[#0a1324] shadow-lg shadow-black/10 transition-all hover:border-cyan-700/70 hover:shadow-cyan-950/20">
                    <Photo plot={plot} missing={d.photoMissing} />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded bg-cyan-950/70 border border-cyan-700/40 px-2 py-1 text-[10px] font-bold uppercase text-cyan-200">{d[kind]}</span>
                        {plot.dataQuality === 'needs_verification' &&
                          <span className="rounded bg-amber-950/30 border border-amber-700/40 px-2 py-1 text-[10px] font-semibold text-amber-200">{d.verification}</span>}
                      </div>
                      <h2 className="mb-3 text-base font-bold leading-snug">{plot.name}</h2>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><p className="mb-1 text-slate-400">{d.area}</p>
                          <p className="font-bold">{formatArea(plot.area, lang === 'ru' ? 'га' : 'ha', d.unknown)}</p></div>
                        <div><p className="mb-1 text-slate-400">{kind === 'building' ? d.buildingArea : d.status}</p>
                          <p className="font-bold">{kind === 'building' ? formatArea(plot.building_area_m2, 'm²', d.unknown) : plot.status || d.unknown}</p></div>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2 pt-5">
                        <a href={mapUrl(plot.id)} className="flex-1 rounded-lg bg-cyan-700 px-3 py-2.5 text-center text-xs font-bold text-white transition-colors hover:bg-cyan-600">{d.viewMap}</a>
                        {verifiedSource
                          ? <a href={source} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-600 px-3 py-2.5 text-center text-xs font-bold text-slate-200 hover:border-cyan-500 hover:text-cyan-200">{d.seeSource} ↗</a>
                          : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          </>}
      </div>
    </main>
  );
}
