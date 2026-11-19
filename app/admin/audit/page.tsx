'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { PlotRecord } from '@/lib/plotTypes';
import { auditPlots, type AuditRow } from '@/lib/plotAudit';

type Filter = 'all' | 'review' | 'possible_archive' | 'geometry' | 'duplicates';

export default function PlotsAuditPage() {
  const [auth, setAuth] = useState<'checking'|'authenticated'|'denied'>('checking');
  const [data, setData] = useState<PlotRecord[]>([]);
  const [dataSource, setDataSource] = useState<'supabase'|'local-fallback'|null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/save-plots?adminRaw=1', { cache: 'no-store' });
      if (!response.ok) throw new Error('Не удалось загрузить записи: HTTP ' + response.status);
      const source = response.headers.get('X-Data-Source') === 'local-fallback' ? 'local-fallback' : 'supabase';
      const plots: unknown = await response.json();
      if (!Array.isArray(plots)) throw new Error('Ответ API не является списком');
      setData(plots as PlotRecord[]);
      setDataSource(source);
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      setData([]);
      setDataSource(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch('/api/admin/session', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { authenticated:false })
      .then(v => setAuth(v.authenticated ? 'authenticated':'denied'))
      .catch(() => setAuth('denied'));
  }, []);

  useEffect(() => { if (auth === 'authenticated') void load(); }, [auth,load]);

  const audit = useMemo(() => auditPlots(data), [data]);
  const counts = useMemo(() => ({
    total:audit.length,
    missingCoordinates:audit.filter(x=>!x.hasLocation).length,
    noPhotos:audit.filter(x=>!x.hasPhoto).length,
    noSource:audit.filter(x=>!x.sourceUrl).length,
    synthetic:audit.filter(x=>x.legacySynthetic).length,
    possibleArchive:audit.filter(x=>x.status==='possible_archive').length,
    duplicate:audit.filter(x=>x.reasons.some(s=>/дубликат|дублируется|повторяется/i.test(s))).length,
    allFlagged:audit.filter(x=>x.reasons.length>0).length
  }),[audit]);
  const rows = useMemo(() => audit.filter(row => {
    if (filter === 'possible_archive' && row.status !== 'possible_archive') return false;
    if (filter === 'review' && row.status !== 'review') return false;
    if (filter === 'geometry' && row.hasLocation && !row.legacySynthetic && !row.reasons.some(r=>r.includes('полигон'))) return false;
    if (filter === 'duplicates' && !row.reasons.some(r=>/дубликат|дублируется|повторяется/i.test(r))) return false;
    const term = query.trim().toLowerCase();
    return !term || row.id.includes(term) || row.name.toLowerCase().includes(term) || row.sourceUrl?.toLowerCase().includes(term);
  }),[audit,filter,query]);

  const downloadCsv = () => {
    const cols = ['ID','Название','Предварительный статус','Есть координаты','Есть фото','Источник','Замечания'];
    const quote = (value:unknown) => '"'+String(value??'').replace(/"/g,'""')+'"';
    const lines = [cols,...audit.map((row: AuditRow) => [
      row.id,row.name,row.status,row.hasLocation?'да':'нет',row.hasPhoto?'да':'нет',
      row.sourceUrl||'',row.reasons.join('; ')
    ])].map(v=>v.map(quote).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF'+lines],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='piskent-audit-'+new Date().toISOString().slice(0,10)+'.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (auth==='checking') return <main className="min-h-screen bg-slate-950 p-8 text-slate-100">Проверка доступа…</main>;
  if (auth==='denied') return <main className="min-h-screen bg-slate-950 p-8 text-slate-100"><h1 className="mb-3 text-xl font-bold">Требуется вход администратора</h1><Link href="/admin" className="text-cyan-300 underline">Войти через админ-панель</Link></main>;

  return <main className="min-h-screen bg-[#f8faf9] px-4 py-8 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Piskent Invest AI · Admin</div>
          <h1 className="mt-1 text-2xl font-bold">Аудит инвестиционных объектов</h1>
          <p className="mt-1 text-sm text-slate-600">Только чтение. Этот экран не изменяет и не удаляет строки Supabase.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">← Админ-панель</Link>
          <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-emerald-700 bg-white px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50">Обновить</button>
          <button onClick={downloadCsv} disabled={loading||!audit.length} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Скачать CSV</button>
        </div>
      </div>

      {dataSource === 'local-fallback' && <div role="alert" className="mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">
        Supabase не удалось прочитать или база пуста: API вернул резервный JSON. Ниже НЕ аудит живой базы. Не принимай решения о публикации по этой выборке.
      </div>}
      {dataSource === 'supabase' && <div role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        Источник ответа API: Supabase. Выводы ниже автоматические и не заменяют проверку официальных документов, статуса торгов и координат.
      </div>}
      {error && <div role="alert" className="mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
      {loading && <p className="mb-4 text-sm text-slate-500">Чтение записей…</p>}

      <section aria-label="Сводка" className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Всего строк',counts.total],['Без координат',counts.missingCoordinates],
          ['Без фото',counts.noPhotos],['Без ссылки',counts.noSource],
          ['Старые синтетические геометрии',counts.synthetic],['Возможный архив',counts.possibleArchive],
          ['Возможные дубли',counts.duplicate],['Строки с замечаниями',counts.allFlagged]
        ].map(([label,value])=><div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
        </div>)}
      </section>

      <div className="mb-4 rounded-lg border-l-2 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Ни одна запись не считается автоматически подтверждённой.</strong> Статус «Проверить» означает ожидание официальных источников; «Возможный архив» — сигнал проверить актуальность, а не основание для удаления.
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {([
          ['all','Все'],['review','Проверить'],['possible_archive','Возможный архив'],
          ['geometry','Геометрия'],['duplicates','Дубли']
        ] as [Filter,string][]).map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}
          className={`rounded-lg border px-4 py-2 text-xs font-bold ${filter===value?'border-emerald-700 bg-emerald-700 text-white':'border-slate-200 bg-white'}`}>{label}</button>)}
        <input aria-label="Поиск объектов" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по ID, названию или ссылке"
          className="min-w-[250px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm lg:max-w-sm"/>
      </div>
      <p className="mb-2 text-xs text-slate-500">Показано {rows.length} из {audit.length}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[850px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600"><tr>
            <th className="p-3">ID и объект</th><th className="p-3">Статус</th><th className="p-3">Точка / фото</th><th className="p-3">Источник</th><th className="p-3">Замечания</th>
          </tr></thead>
          <tbody>{rows.map(row=><tr key={row.id} className="border-t border-slate-100 align-top">
            <td className="p-3"><div className="font-semibold">{row.name}</div><div className="text-xs text-slate-500">{row.id}</div></td>
            <td className="p-3"><span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{row.status==='possible_archive'?'Возможный архив':'Проверить'}</span></td>
            <td className="p-3 text-xs">{row.hasLocation?'Точка записана':'Точки нет'}<div>{row.hasPhoto?'Фото указано':'Фото нет'}</div></td>
            <td className="p-3 text-xs">{row.sourceUrl?<a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">Открыть ↗</a>:'Не указан'}</td>
            <td className="p-3"><ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">{row.reasons.length?row.reasons.map((reason,i)=><li key={i}>{reason}</li>):<li>Нет автоматических замечаний; официальная проверка обязательна</li>}</ul></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  </main>;
}
