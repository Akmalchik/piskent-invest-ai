import type { PlotRecord } from './plotTypes';

export type PublicLang = 'uz' | 'ru' | 'en' | 'zh';
type Localized = Record<PublicLang, string>;

/**
 * Only generic designations and known controlled vocabulary are translated.
 * Real proper nouns, addresses, brand names and unrecognized descriptions are
 * preserved as entered by the administrator, without invented translations.
 */
const names: Record<string, Localized> = {
  "bo'sh yer maydoni": { uz:"Bo‘sh yer maydoni", ru:"Свободный земельный участок", en:"Vacant land plot", zh:"空置土地" },
  "noturar bino 1": { uz:"Noturar bino 1", ru:"Нежилое здание 1", en:"Non-residential building 1", zh:"非住宅建筑1号" },
  "noturar bino 2": { uz:"Noturar bino 2", ru:"Нежилое здание 2", en:"Non-residential building 2", zh:"非住宅建筑2号" },
  "noturar bino 3": { uz:"Noturar bino 3", ru:"Нежилое здание 3", en:"Non-residential building 3", zh:"非住宅建筑3号" },
  "ferma": { uz:"Ferma", ru:"Ферма", en:"Farm", zh:"农场" },
  "kollej bino va inshoati": { uz:"Kollej bino va inshootlari", ru:"Здания и сооружения колледжа", en:"College buildings and facilities", zh:"学院建筑及配套设施" },
  "g'isht ishlab chiqarish zavodi": { uz:"G‘isht ishlab chiqarish zavodi", ru:"Кирпичный завод", en:"Brick manufacturing plant", zh:"砖厂" },
};
const states: Record<string, Localized> = {
  mavjud: { uz:"Mavjud",ru:"Доступен",en:"Available",zh:"可用" },
  band: { uz:"Band",ru:"Занят",en:"Occupied",zh:"已占用" },
  "e-auksion": { uz:"E-auksion",ru:"Электронный аукцион",en:"E-auction",zh:"电子拍卖" },
  "e-auksionda": { uz:"E-auksionda",ru:"На электронном аукционе",en:"On e-auction",zh:"电子拍卖中" },
  "mavjud emas": { uz:"Mavjud emas",ru:"Нет",en:"Not available",zh:"不可用" },
  aniqlanmoqda: { uz:"Aniqlanmoqda",ru:"Уточняется",en:"Under review",zh:"待核实" },
  sotilgan: { uz:"Sotilgan",ru:"Продан",en:"Sold",zh:"已售出" },
  yakunlangan: { uz:"Yakunlangan",ru:"Завершён",en:"Completed",zh:"已结束" },
  arxiv: { uz:"Arxiv",ru:"Архив",en:"Archived",zh:"已归档" },
};
const sectors: Record<string, Localized> = {
  agro: { uz:"Qishloq xo‘jaligi",ru:"Сельское хозяйство",en:"Agriculture",zh:"农业" },
  agriculture: { uz:"Qishloq xo‘jaligi",ru:"Сельское хозяйство",en:"Agriculture",zh:"农业" },
  "qishloq xo'jaligi": { uz:"Qishloq xo‘jaligi",ru:"Сельское хозяйство",en:"Agriculture",zh:"农业" },
  production: { uz:"Sanoat / ishlab chiqarish",ru:"Промышленность / производство",en:"Industry / manufacturing",zh:"工业 / 制造业" },
  "sanoat / ishlab chiqarish": { uz:"Sanoat / ishlab chiqarish",ru:"Промышленность / производство",en:"Industry / manufacturing",zh:"工业 / 制造业" },
  logistics: { uz:"Logistika",ru:"Логистика",en:"Logistics",zh:"物流" },
  logistika: { uz:"Logistika",ru:"Логистика",en:"Logistics",zh:"物流" },
  textile: { uz:"To‘qimachilik",ru:"Текстиль",en:"Textiles",zh:"纺织业" },
  service: { uz:"Xizmat ko‘rsatish",ru:"Услуги",en:"Services",zh:"服务业" },
  trade: { uz:"Savdo",ru:"Торговля",en:"Trade",zh:"贸易" },
};
const utilities: Record<string, Localized> = {
  mavjud:states.mavjud,
  "mavjud emas":states["mavjud emas"],
  aniqlanmoqda:states.aniqlanmoqda,
  asfalt:{uz:"Asfalt",ru:"Асфальт",en:"Asphalt",zh:"沥青路"},
  "shag'al":{uz:"Shag‘al",ru:"Щебёночная дорога",en:"Gravel road",zh:"碎石路"},
  "tuproq yo'l":{uz:"Tuproq yo‘l",ru:"Грунтовая дорога",en:"Dirt road",zh:"土路"},
};
const ownership: Record<string, Localized> = {
  davlat: {uz:"Davlat obyekti",ru:"Государственный объект",en:"State-owned property",zh:"国有资产"},
  xususiy: {uz:"Xususiy obyekt",ru:"Частный объект",en:"Privately owned property",zh:"私有资产"},
  "e-auksion": states["e-auksion"],
};

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('en-US')
    .replace(/[‘’ʼ`´]/g,"'").replace(/\s+/g,' ').replace(/[.。]+$/g,'').trim();
}
function translate(value: unknown, lang: PublicLang, dictionary: Record<string,Localized>): string {
  const raw=String(value??'').trim();
  return dictionary[normalize(raw)]?.[lang] || raw;
}

export function localizePlotName(name: unknown, lang: PublicLang): string {
  return translate(name,lang,names);
}
export function localizePlotStatus(status: unknown, lang: PublicLang): string {
  return translate(status,lang,states);
}
export function localizePlotIndustry(industry: unknown, lang: PublicLang): string {
  return translate(industry,lang,sectors);
}
export function localizePlotInfrastructure(value: unknown, lang: PublicLang): string {
  return translate(value,lang,utilities);
}
export function localizePlotOwnership(value: unknown, lang: PublicLang): string {
  const norm=normalize(value);
  const key=norm.includes('davlat')?'davlat':norm.includes('xususiy')?'xususiy':norm.includes('auksion')?'e-auksion':norm;
  return translate(key,lang,ownership) || String(value??'');
}
export function localizePlotNameForSearch(plot: PlotRecord): string {
  return (['uz','ru','en','zh'] as const).map(lang=>localizePlotName(plot.name,lang)).join(' ');
}
