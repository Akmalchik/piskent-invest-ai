'use client';

import { useMemo, useState } from 'react';
import showcase from '@/data/curated-showcase-20.json';

type Category = 'all' | 'land' | 'building';

export default function CandidateCatalog() {
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const labels = {
    all: 'Barcha obyektlar',
    land: 'Yer maydonlari',
    building: 'Bino va inshootlar',
  };
  const candidates = useMemo(
    () => showcase.items.filter((item) =>
      (category === 'all' || item.kind === category) &&
      [item.title, item.lotId ?? '', item.address ?? ''].some(
        value => value.toLowerCase().includes(query.trim().toLowerCase())
      )
    ),
    [category, query]
  );

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#132237]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div>
            <a href="/" className="font-bold tracking-wide text-[#132237]">PISKENT <span className="text-emerald-700">INVEST AI</span></a>
            <p className="text-xs text-slate-500">Investitsiya takliflari · Tanlab olingan nomzodlar</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <a href="/?tab=map" className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">Xarita</a>
            <a href="/" className="rounded-lg bg-[#142940] px-4 py-2 font-semibold text-white hover:bg-[#25445d]">Bosh sahifa</a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Investitsiya imkoniyatlari / Ko‘rib chiqish uchun</p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">20 ta tanlangan obyekt</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              10 ta yer maydoni va 10 ta bino-inshoot nomzodi. Ushbu ro‘yxat ko‘rgazmali va dastlabki
              saralash uchun tuzilgan. Obyektning hozir sotuvda ekanligi, maydoni, narxi,
              manzili va huquqiy holati rasmiy manbadan alohida tasdiqlanishi kerak.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-3">
              <div className="text-2xl font-extrabold">10</div><div className="text-xs text-slate-500">Yer maydoni</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-3">
              <div className="text-2xl font-extrabold">10</div><div className="text-xs text-slate-500">Bino-inshoot</div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950" role="note">
          <strong>Ma’lumotlar tekshirilmoqda.</strong> Bu ro‘yxat tasdiqlangan, sotuvdagi 20 ta faol lot degani emas.
          Eski arxivdagi yer uchastkalarining koordinatalari va maydonlari sun’iy yaratilganligi aniqlangan;
          shu sababli ular xaritada belgilanishi va tasdiqlangan maydon sifatida ko‘rsatilishi mumkin emas.
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {(Object.keys(labels) as Category[]).map(value => (
            <button key={value} type="button" onClick={() => setCategory(value)}
              aria-pressed={category === value}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${category === value
                ? 'border-[#142940] bg-[#142940] text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}>
              {labels[value]}
            </button>
          ))}
          <label className="ml-auto flex min-w-[220px] flex-1 items-center rounded-lg border border-slate-200 bg-white sm:max-w-sm">
            <span className="px-3 text-slate-400" aria-hidden="true">⌕</span>
            <input className="w-full bg-transparent px-1 py-2.5 text-sm outline-none"
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Lot raqami yoki obyekt nomi..."
              aria-label="Obyektlarni qidirish" />
          </label>
        </div>
        <p className="mb-3 text-xs text-slate-500">{candidates.length} ta natija</p>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Saralangan nomzodlar">
          {candidates.map((item) => {
            const isArchived = item.source === 'finished-auction';
            const isLocal = item.source === 'internal-fallback';
            return (
              <article key={item.id} className="flex min-h-[246px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${item.kind === 'land'
                    ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'}`}>
                    {item.kind === 'land' ? 'Yer maydoni' : 'Bino-inshoot'}
                  </span>
                  <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${isArchived
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-amber-50 text-amber-800'}`}>
                    {isArchived ? 'Savdo sanasi o‘tgan' : 'Tekshirilmoqda'}
                  </span>
                </div>

                <h2 className="mb-2 text-base font-bold leading-snug">{item.title}</h2>
                <p className="text-xs text-slate-500">{item.sourceLabel}</p>
                {item.address && <p className="mt-1 text-xs text-slate-600">{item.address}</p>}
                {item.lotId && <p className="mt-1 text-xs text-slate-500">Lot: №{item.lotId}</p>}

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 p-3"><div className="mb-1 text-slate-500">Maydon</div><div className="font-semibold">Tasdiqlanmagan</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="mb-1 text-slate-500">Xaritadagi joy</div><div className="font-semibold">Tekshirilmoqda</div></div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <button type="button" aria-expanded={expanded === item.id}
                    className="mb-2 text-xs font-semibold text-emerald-800 underline underline-offset-4"
                    onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                    {expanded === item.id ? 'Batafsilni yopish' : 'Ma’lumot holati'}
                  </button>
                  {expanded === item.id && (
                    <p className="mb-3 text-xs leading-5 text-slate-600">
                      {item.notes}
                      {isLocal && ' Ushbu obyekt ichki katalogdan olingan, faol auksion loti sifatida tasdiqlanmagan.'}
                      {item.auctionDate && ` Savdo sanasi: ${item.auctionDate}.`}
                    </p>
                  )}
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="block rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-bold text-[#142940] hover:border-slate-400">
                      {isArchived ? 'Arxiv lotini tekshirish ↗' : 'Manbani ochish ↗'}
                    </a>
                  ) : (
                    <span className="block rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
                      Rasmiy lot havolasi mavjud emas
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
        {candidates.length === 0 && <p className="rounded-xl border bg-white p-8 text-center text-slate-500">Hech qanday obyekt topilmadi.</p>}
        <p className="mt-8 text-xs text-slate-500">Saralash sanasi: {showcase.selectionDate} · Ma’lumotlar avtomatik ravishda Supabase bazasiga yozilmaydi.</p>
      </div>
    </main>
  );
}
