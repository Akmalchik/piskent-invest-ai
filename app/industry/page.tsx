'use client';

import { useEffect, useState } from 'react';

type Lang = 'uz' | 'ru' | 'en' | 'zh';
type LocaleText = Record<Lang,string>;
const tx = (uz:string,ru:string,en:string,zh:string):LocaleText=>({uz,ru,en,zh});
const officialSources = {
  krasniy:'https://gov.uz/oz/piskent/news/view/210477',
  zhongtian:'https://kengash.gov.uz/ru/mirobod/news/35216',
  huading:'https://kengash.gov.uz/uz/piskent/news/41228',
  concrete:'https://kengash.gov.uz/ru/piskent/news/35212',
  industrialZone:'https://gov.uz/oz/toshvil/news/view/131329',
  statistics:'https://www.toshvilstat.uz/uz/matbuot-markazi/qo-mita-yangiliklar/17965-piskent-tumanida-faoliyat-yuritayotgan-korxonalar-soni-3',
  zhongtianExternal:'https://www.uzdaily.uz/ru/v-uzbekistane-realizovan-proekt-po-proizvodstvu-pigmentnykh-krasok-stoimostiu-28-mln/'
};
const copy={
  uz:{overline:'PISKENT INVEST AI / SANOAT',title:'Piskentning sanoat salohiyati',lead:'Haqiqiy ishlab chiqarish korxonalari, xorijiy investitsiyalar va hududning rivojlanish loyihalari. Har bir ma’lumot manbasi bilan berilgan.',back:'Bosh sahifa',map:'Investitsiya xaritasi',companies:'Korxonalar va ishlab chiqarish',numbers:'Rasmiy statistik ma’lumotlar',companyCount:'Korxona va tashkilotlar',small:'Kichik biznes subyektlari',foreign:'Xorijiy kapital ishtirokida',dated:'2025-yil yanvar–mart holati, 2025-yil 16-aprelda e’lon qilingan',sector:'Yo‘nalish',verified:'Manbada faoliyati qayd etilgan',details:'Manbani ochish',planned:'Rejalashtirilgan loyihalar',plannedCaption:'Taqdim etilgan loyihalar — foydalanishga topshirilgan korxonalar emas.',disclaimer:'Eslatma: ma’lumotlar faqat keltirilgan manbalar e’lon qilingan davrga tegishli. Rejadagi quvvat va ish o‘rinlari amaldagi natija sifatida ko‘rsatilmaydi. Suratlar korxonaga tegishli ekanligi tasdiqlanmagani uchun umumiy rasmlar qo‘shilmadi.',profile:'Iqtisodiy profil',source:'Statistika manbasi',noInvestment:'Bu bo‘lim sotuvga qo‘yilgan obyektlar ro‘yxati emas.'},
  ru:{overline:'PISKENT INVEST AI / ПРОМЫШЛЕННОСТЬ',title:'Промышленный потенциал Пискента',lead:'Реальные предприятия, иностранные инвестиции и проекты развития района. Все опубликованные сведения сопровождаются ссылками на источники.',back:'Главная',map:'Инвестиционная карта',companies:'Предприятия и производство',numbers:'Официальная статистика',companyCount:'Предприятий и организаций',small:'Субъектов малого бизнеса',foreign:'С иностранным капиталом',dated:'Январь–март 2025 года, опубликовано 16 апреля 2025 года',sector:'Отрасль',verified:'Деятельность отражена в источнике',details:'Открыть источник',planned:'Проекты развития',plannedCaption:'Представленные проекты не следует считать уже введёнными в эксплуатацию.',disclaimer:'Примечание: сведения относятся к датам публикации указанных источников. Плановые мощности и рабочие места не выдаются за достигнутые результаты. Изображения предприятий без подтверждённого происхождения не добавлены.',profile:'Экономический профиль',source:'Источник статистики',noInvestment:'Этот раздел не является перечнем предприятий, предлагаемых к продаже.'},
  en:{overline:'PISKENT INVEST AI / INDUSTRY',title:'Industrial potential of Piskent',lead:'Real companies, foreign investment and district development projects, with a source for every published claim.',back:'Home',map:'Investment map',companies:'Companies and production',numbers:'Official statistics',companyCount:'Enterprises and organisations',small:'Small businesses',foreign:'With foreign capital',dated:'January–March 2025; published 16 April 2025',sector:'Sector',verified:'Operations reported by the source',details:'View source',planned:'Development projects',plannedCaption:'Announced projects are not presented as operational facilities.',disclaimer:'Note: facts reflect the publication dates of the cited sources. Planned capacity and employment are not presented as achieved results. Unverified factory photographs have not been used.',profile:'Economic profile',source:'Statistics source',noInvestment:'This section is not a listing of companies for sale.'},
  zh:{overline:'PISKENT INVEST AI / 工业',title:'皮斯肯特工业发展潜力',lead:'了解本区的实际企业、外商投资及发展项目。每项信息均附有公开来源。',back:'首页',map:'投资地图',companies:'企业与生产',numbers:'官方统计数据',companyCount:'企业和机构',small:'小型企业',foreign:'外资参与企业',dated:'2025年1月至3月，2025年4月16日发布',sector:'行业',verified:'来源报道其经营活动',details:'查看来源',planned:'发展规划项目',plannedCaption:'已公布的规划项目不代表已投入运营。',disclaimer:'注：信息仅反映所引来源发布时的情况。规划产能及就业岗位不等于已实现成果。由于无法核实照片来源，本页面未使用企业照片。',profile:'经济概况',source:'统计数据来源',noInvestment:'本页面并非出售企业的清单。'}
} as const;

const companies=[
  {id:'zhongtian',name:'ZHONGTIAN SILICON-CHEMICAL',sector:tx('Kimyo sanoati va pigmentlar','Химия и пигменты','Chemicals and pigments','化工及颜料'),
  detail:tx('Rasmiy xabarda pigment bo‘yoqlar ishlab chiqarish korxonasi qayd etilgan. 2025-yilda ishga tushirilgani haqida ham xabar berilgan.','В официальном сообщении предприятие указано как производитель пигментных красок; также сообщалось о запуске проекта в 2025 году.','Public reports describe a pigment manufacturing facility and a project launched in 2025.','公开报道介绍了颜料生产企业及其2025年启动的项目。'),
  extra:tx('10 ming tonna/yil — xabarda ko‘rsatilgan loyiha quvvati','10 тыс. тонн/год — проектная мощность по публикации','10,000 t/year — reported design capacity','年产1万吨 — 报道所述设计产能'),
  source:officialSources.zhongtian},
  {id:'huading',name:'HUADING INDUSTRIAL',sector:tx('Pillachilik va qayta ishlash','Шелководство и переработка','Sericulture and processing','蚕桑及加工'),
  detail:tx('Tuman Kengashi xabariga ko‘ra, Mingtepa MFYdagi korxona ish boshlagan va dastlabki bosqichda 20 nafar fuqaroni ish bilan ta’minlagan.','По сообщению районного Кенгаша, предприятие в махалле Мингтепа приступило к работе и на первом этапе обеспечило занятость 20 человек.','The district council reported operations had begun in Mingtepa, with 20 local employees at the initial stage.','区议会报道，明格特帕社区的企业已开始运营，初期雇用了20名当地居民。'),
  extra:tx('100 ta ish o‘rni — reja, amaldagi natija emas','100 рабочих мест — план, не фактический результат','100 jobs — planned, not achieved','100个岗位 — 规划目标，非实际完成数'),
  source:officialSources.huading},
  {id:'krasniy',name:'KRASNIY MAYAK',sector:tx('Agrologistika va sovutgich ombor','Агрологистика и холодильное хранение','Agri-logistics and cold storage','农业物流及冷链仓储'),
  detail:tx('2026-yil 25-avgustdagi hokimlik xabarida 500 tonnalik sovutgich ombori ishga tushirilgani qayd etilgan.','Хокимият 25 августа 2026 года сообщил о вводе холодильного склада на 500 тонн.','The district administration reported commissioning a 500-tonne refrigerated warehouse on 25 August 2026.','区政府于2026年8月25日报道，500吨冷藏仓库已投入运营。'),
  extra:tx('500 tonna — ombor sig‘imi','500 тонн — вместимость склада','500 tonnes — storage capacity','500吨 — 仓储容量'),
  source:officialSources.krasniy},
  {id:'concrete',name:'GONG SI',sector:tx('Beton va qurilish materiallari','Бетон и строительные материалы','Concrete and building materials','混凝土及建材'),
  detail:tx('Mahalliy Kengash xabarida xorijiy korxonaning beton mahsulotlari ishlab chiqarishi yoritilgan. Aniq joriy quvvat ko‘rsatilmagan.','Местный Кенгаш описал производство бетонных изделий на предприятии с иностранным участием; текущие объёмы не подтверждены.','The local council reported concrete products manufactured by a foreign-invested company; current output is unconfirmed.','地方议会介绍了一家外资企业的混凝土制品生产情况；当前产量尚未核实。'),
  extra:null,source:officialSources.concrete}
] as const;

const project={
  title:tx('Yangi Piskent sanoat zonasi va Piskent Texnopark','Промышленная зона «Янги Пискент» и «Пискент Технопарк»','Yangi Piskent industrial zone and Piskent Technopark','“新皮斯肯特”工业区及皮斯肯特科技园'),
  details:tx('2026-yil 12-fevralda viloyat hokimligi ushbu loyihalar taqdim qilinganini xabar qilgan. Ushbu xabar ularning to‘liq ishga tushganini tasdiqlamaydi.','12 февраля 2026 года областной хокимият сообщил о презентации этих проектов. Публикация не подтверждает их полного ввода в эксплуатацию.','The regional administration reported these plans were presented on 12 February 2026; this does not confirm completion or operational status.','州政府于2026年2月12日报道了这些项目的展示，不能据此认定项目已建成或投入运营。')
};

export default function IndustryPage(){
  const [lang,setLang]=useState<Lang>('uz');
  useEffect(()=>{
    const v=new URLSearchParams(window.location.search).get('lang');
    if(v==='uz'||v==='ru'||v==='en'||v==='zh')setLang(v);
  },[]);
  const t=copy[lang];
  return <main className="min-h-screen bg-[#050a14] text-slate-100">
    <header className="sticky top-0 z-40 border-b border-slate-700/60 bg-[#091120]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <a href={`/?lang=${lang}`} className="text-base font-black tracking-tight">PISKENT <span className="text-cyan-400">INVEST AI</span></a>
        <nav className="flex flex-wrap items-center gap-2">
          <a href={`/?lang=${lang}`} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">{t.back}</a>
          <a href={`/?tab=map&lang=${lang}`} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">{t.map}</a>
          <div className="flex rounded-lg border border-slate-700 bg-[#050a14] p-1">
            {(['uz','ru','en','zh'] as Lang[]).map(l=><button key={l} aria-pressed={lang===l} onClick={()=>{setLang(l);window.history.replaceState(null,'',`/industry?lang=${l}`);}} className={`rounded px-2.5 py-1.5 text-[11px] font-bold uppercase ${lang===l?'bg-cyan-800 text-white':'text-slate-400 hover:text-white'}`}>{l}</button>)}
          </div>
        </nav>
      </div>
    </header>
    <div className="mx-auto max-w-7xl space-y-10 px-5 py-9 sm:px-8 md:py-14">
      <section className="relative overflow-hidden rounded-2xl border border-cyan-700/20 bg-[#0b1729] p-6 sm:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[45px] border-cyan-900/15" aria-hidden="true"/>
        <div className="relative max-w-3xl">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[.18em] text-cyan-400">{t.overline}</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-5xl">{t.title}</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">{t.lead}</p>
          <p className="mt-4 text-xs text-amber-200/90">{t.noInvestment}</p>
        </div>
      </section>

      <section aria-label={t.numbers}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-black">{t.numbers}</h2>
          <a href={officialSources.statistics} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-cyan-300 hover:underline">{t.source} ↗</a>
        </div>
        <p className="mb-4 text-xs text-slate-400">{t.dated}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[[t.companyCount,'1 027'],[t.small,'817'],[t.foreign,'36']].map(([label,value])=><div key={label} className="rounded-xl border border-slate-700/60 bg-[#0a1324] p-5">
            <p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-cyan-300">{value}</p>
          </div>)}
        </div>
      </section>

      <section aria-label={t.companies}>
        <h2 className="mb-5 text-xl font-black">{t.companies}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map(company=><article key={company.id} className="flex flex-col rounded-xl border border-slate-700/60 bg-[#0a1324] p-5 transition-colors hover:border-cyan-700/60 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-cyan-400">{company.sector[lang]}</p><h3 className="text-lg font-black leading-tight">{company.name}</h3></div>
              <span className="rounded-md border border-emerald-700/40 bg-emerald-950/25 px-2 py-1 text-[10px] font-semibold text-emerald-200">{t.verified}</span>
            </div>
            <p className="flex-1 text-sm leading-6 text-slate-300">{company.detail[lang]}</p>
            {company.extra&&<p className="mt-4 border-l-2 border-cyan-600 pl-3 text-xs font-semibold text-cyan-200">{company.extra[lang]}</p>}
            <a href={company.source} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex self-start rounded-lg border border-slate-600 px-4 py-2.5 text-xs font-bold text-slate-200 hover:border-cyan-500 hover:text-cyan-300">{t.details} ↗</a>
          </article>)}
        </div>
      </section>
      <section className="rounded-xl border border-slate-700/70 bg-[#0a1324] p-5 sm:p-7">
        <div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">{t.planned}</h2><span className="rounded-md bg-amber-950/60 px-2 py-1 text-xs font-semibold text-amber-200">{t.plannedCaption}</span></div>
        <h3 className="mt-4 text-base font-bold text-cyan-200">{project.title[lang]}</h3>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{project.details[lang]}</p>
        <a href={officialSources.industrialZone} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-xs font-bold text-cyan-300 hover:underline">{t.details} ↗</a>
      </section>
      <footer className="border-t border-slate-800 pt-5 text-xs leading-6 text-slate-400">{t.disclaimer}</footer>
    </div>
  </main>;
}
