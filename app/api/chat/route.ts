import { NextRequest, NextResponse } from 'next/server';

type Lang = 'uz' | 'ru' | 'en' | 'zh';

type Plot = {
  id: string | number;
  name: string;
  property_type: string;
  area: unknown;
  building_area_m2: unknown;
  industry: string;
  status: string;
  ownership_type: string;
  infrastructure: Record<string, unknown>;
  auksionUrl: string;
  polygonCoordinates: unknown;
};

const CONTACT = {
  name: 'Nazirqulov Doniyor Rahmonjon o‘g‘li',
  department: {
    uz: 'Investitsiyalar, sanoat va savdo bo‘limi',
    ru: 'Отдел инвестиций, промышленности и торговли',
    en: 'Department of Investment, Industry and Trade',
    zh: '投资、工业和贸易部门',
  },
  phone: '+998 99 512 75 70',
};

const LANGUAGE_NAMES: Record<Lang, string> = {
  uz: 'Uzbek Latin',
  ru: 'Russian',
  en: 'English',
  zh: 'Chinese',
};

function normalizePlots(plots: any[]): Plot[] {
  return plots
    .filter(plot => plot?.id !== undefined && String(plot.name || '').trim())
    .map(plot => ({
      id: plot.id,
      name: String(plot.name).trim(),
      property_type: plot.property_type || plot.propertyType || 'land',
      area: plot.area ?? null,
      building_area_m2: plot.building_area_m2 ?? plot.buildingAreaM2 ?? null,
      industry: String(plot.industry || ''),
      status: String(plot.status || ''),
      ownership_type: String(plot.ownership_type || plot.ownershipType || ''),
      infrastructure: plot.infrastructure || {},
      auksionUrl: String(plot.auksionUrl || plot.auksion_url || plot.auction_url || ''),
      polygonCoordinates: plot.polygonCoordinates || plot.polygon_coords || null,
    }))
    .filter(plot => !/^test$/i.test(plot.name));
}

function normalizeLang(lang: unknown): Lang {
  return ['ru', 'en', 'zh'].includes(String(lang)) ? lang as Lang : 'uz';
}

function normalizeText(value: unknown) {
  return String(value || '').toLowerCase().replace(/[‘’`]/g, "'").trim();
}

function infraValue(plot: Plot, key: 'gas' | 'power' | 'water' | 'road') {
  const aliases = {
    gas: ['gas', 'gaz'],
    power: ['power', 'electricity', 'elektr'],
    water: ['water', 'suv'],
    road: ['road', 'yol', 'yo‘l'],
  }[key];
  const entry = aliases.map(alias => plot.infrastructure?.[alias]).find(value => value !== undefined && value !== null && String(value).trim());
  return normalizeText(entry);
}

function infraState(value: string): 'yes' | 'no' | 'unknown' {
  if (!value || /^(?:null|undefined)?$|aniqla|уточ|unknown|clarif|needs on-site|确认|需现场/.test(value)) return 'unknown';
  if (/^(?:false|no)$|mavjud emas|yo['’`]?q|нет|not available|unavailable|不可用|无/.test(value)) return 'no';
  if (/^(?:true|yes|ha|bor|mavjud|available|есть|有)$/.test(value)) return 'yes';
  return 'yes';
}

function translatedInfraValue(value: string, lang: Lang) {
  const values = {
    uz: { yes: 'mavjud', no: 'mavjud emas', unknown: 'joyida aniqlashtirish kerak' },
    ru: { yes: 'есть', no: 'нет', unknown: 'требуется уточнить на месте' },
    en: { yes: 'available', no: 'not available', unknown: 'needs on-site clarification' },
    zh: { yes: '有', no: '无', unknown: '需现场确认' },
  };
  return values[lang][infraState(value)];
}

function getIntent(message: string) {
  const text = normalizeText(message);
  if (/solishtir|taqqosla|сравни|compare|qaysi yaxshi|какой лучше|\b(?:yoki|или)\b/.test(text)) return 'compare';
  if (/sanoat|ishlab chiqarish|производ|цех|завод|factory|industry/.test(text)) return 'production';
  if (/turizm|туризм|tourism|hotel|mehmonxona|гостиниц/.test(text)) return 'tourism';
  if (/кафе|ресторан|service|xizmat|сервис|servis|savdo|торгов/.test(text)) return 'service';
  if (/sklad|ombor|склад|warehouse|logistika|логист/.test(text)) return 'logistics';
  if (/ferma|agro|ферм|qishloq xo['’`]?jaligi|farm|сельск/.test(text)) return 'agro';
  return 'general';
}

function isGreeting(message: string) {
  return /^(salom|assalomu alaykum|привет|здравствуйте|hello|hi|你好)[!.?\s]*$/i.test(message.trim());
}

function isContactRequest(message: string) {
  return /contact|контакт|телефон|aloqa|bog['’`]?lan|联系/i.test(message);
}

function isShowOnMapRequest(message: string) {
  return /xaritada ko['’`]?rsat|покажи на карте|show (?:it )?on (?:the )?map|在地图上显示/i.test(message);
}

function isDetailedRequest(message: string) {
  return /batafsil|подробнее|detailed|详细/i.test(message);
}

function isPriceRequest(message: string) {
  return /narx|qancha tur|сколько стоит|стоимост|цена|аренд|rent|price|cost/i.test(message);
}

function asksForAlternatives(message: string) {
  return /muqobil|alternativ|альтернатив|друг(?:ой|ие)|boshqa/i.test(message);
}

function isOffTopic(message: string) {
  const text = normalizeText(message);
  const creative = /she['’`]?r|стих|анекдот|шутк|recipe|рецепт|retsept|ob-havo|погод|weather|президент|president|roleplay|рассказ|hikoya|政治/;
  const investment = /joy|obyekt|объект|invest|yer|земл|bino|здани|maydon|площад|gaz|газ|elektr|электр|suv|вода|yo['’`]?l|дорог|sanoat|производ|turizm|туризм|service|сервис|xizmat|кафе|ресторан|sklad|ombor|склад|logist|agro|ferma|ферм|business|biznes|бизнес|auksion|аукцион/;
  return creative.test(text) || !investment.test(text);
}

function localText(lang: Lang, key: 'greeting' | 'offTopic' | 'notFound' | 'contact') {
  const texts = {
    greeting: {
      uz: 'Assalomu alaykum. Men Piskent tumanidagi investitsiya obyektlari bo‘yicha yordam bera olaman. Sizga yer maydoni, tayyor bino yoki ishlab chiqarish uchun obyekt kerakmi?',
      ru: 'Здравствуйте. Я помогу подобрать инвестиционный объект в Пискентском районе. Вам нужен земельный участок, готовое здание или объект для производства?',
      en: 'Hello. I can help you select an investment property in Piskent district. Do you need land, an existing building, or a production property?',
      zh: '您好。我可以帮助您选择皮斯肯特区的投资项目。您需要土地、现有建筑还是生产类项目？',
    },
    offTopic: {
      uz: 'Men Piskent tumanidagi investitsiya obyektlari bo‘yicha yordam bera olaman: obyektni faoliyat turi, maydon va infratuzilma bo‘yicha tanlab beraman.',
      ru: 'Я могу помочь по инвестиционным объектам Пискентского района: подобрать объект по виду деятельности, площади и инфраструктуре.',
      en: 'I can help with investment properties in Piskent district by activity type, area, and infrastructure.',
      zh: '我可以根据经营类型、面积和基础设施帮助您选择皮斯肯特区的投资项目。',
    },
    notFound: {
      uz: 'So‘ralgan obyekt bazada topilmadi. Obyekt nomini aniqroq yozing yoki faoliyat yo‘nalishini ko‘rsating.',
      ru: 'Запрошенный объект не найден в базе. Уточните название объекта или направление деятельности.',
      en: 'The requested property was not found in the database. Please clarify its name or activity type.',
      zh: '数据库中未找到该项目。请进一步明确项目名称或经营方向。',
    },
    contact: {
      uz: `${CONTACT.department.uz}\nMas’ul: ${CONTACT.name}\nTelefon: ${CONTACT.phone}`,
      ru: `${CONTACT.department.ru}\nОтветственный: ${CONTACT.name}\nТелефон: ${CONTACT.phone}`,
      en: `${CONTACT.department.en}\nContact: ${CONTACT.name}\nPhone: ${CONTACT.phone}`,
      zh: `${CONTACT.department.zh}\n联系人：${CONTACT.name}\n电话：${CONTACT.phone}`,
    },
  };
  return texts[key][lang];
}

function parseRequestedArea(message: string) {
  const match = message.match(/(\d+(?:[.,]\d+)?)\s*(?:ga|ha|gektar|гектар)/i);
  return match ? Number(match[1].replace(',', '.')) : null;
}

function presentationScore(plot: Plot) {
  const type = normalizeText(plot.property_type);
  const infraCount = (['gas', 'power', 'water', 'road'] as const)
    .filter(key => infraState(infraValue(plot, key)) === 'yes').length;
  let score = 0;
  if (/ferma|ферм|kollej|колледж/.test(normalizeText(plot.name))) score += 5;
  if (type === 'building' || type === 'land_building') score += 4;
  if (Number(plot.building_area_m2) > 0) score += 3;
  score += infraCount;
  if (plot.auksionUrl) score += 0.5;
  if (/bo['’`]?sh yer|пуст.*зем|empty land/.test(normalizeText(plot.name))) score -= 5;
  return score;
}

function candidateScore(plot: Plot, message: string, intent: string) {
  const plotText = normalizeText(`${plot.name} ${plot.industry} ${plot.property_type}`);
  const requestedArea = parseRequestedArea(message);
  const area = Number(plot.area);
  let score = presentationScore(plot);

  const intentPatterns: Record<string, RegExp> = {
    production: /sanoat|ishlab|production|industrial|производ|цех|завод/,
    tourism: /turizm|tourism|туризм|hotel|гостиниц|service|servis/,
    service: /service|servis|xizmat|сервис|кафе|ресторан|savdo|торгов/,
    logistics: /logist|warehouse|ombor|sklad|склад|логист/,
    agro: /agro|ferma|farm|qishloq|ферм|сельск/,
  };
  if (intentPatterns[intent]?.test(plotText)) score += 10;
  if (intent === 'production' && infraState(infraValue(plot, 'power')) === 'yes') score += 3;
  if (intent === 'tourism' && (infraState(infraValue(plot, 'road')) === 'yes' || /building/.test(plot.property_type))) score += 3;
  if (intent === 'logistics' && infraState(infraValue(plot, 'road')) === 'yes') score += 3;
  if (intent === 'agro' && infraState(infraValue(plot, 'water')) === 'yes') score += 3;
  if (requestedArea !== null && Number.isFinite(area)) {
    score += area >= requestedArea ? 4 : -Math.min(4, requestedArea - area);
  }
  return score;
}

function selectCandidates(message: string, plots: Plot[], intent: string) {
  const text = normalizeText(message);
  const requestedInfrastructure = ([
    { key: 'gas', pattern: /gaz|gas|газ/ },
    { key: 'power', pattern: /elektr|electric|электр/ },
    { key: 'water', pattern: /suv|water|вод/ },
    { key: 'road', pattern: /yo['’`]?l|road|дорог/ },
  ] as const)
    .filter(item => item.pattern.test(text) && /bor|mavjud|available|есть|kerak|нуж|with/.test(text))
    .map(item => item.key);
  const eligible = requestedInfrastructure.length > 0
    ? plots.filter(plot => requestedInfrastructure.every(key => infraState(infraValue(plot, key)) === 'yes'))
    : plots;

  return eligible
    .map(plot => ({ plot, score: candidateScore(plot, message, intent) }))
    .sort((a, b) => b.score - a.score || (Number(b.plot.area) || 0) - (Number(a.plot.area) || 0))
    .slice(0, 8)
    .map(item => item.plot);
}

function findNamedPlots(message: string, plots: Plot[], limit = 3) {
  const text = normalizeText(message).replace(/[^\p{L}\p{N}]+/gu, ' ');
  const found: Array<{ plot: Plot; index: number }> = [];
  const add = (plot: Plot | undefined, index: number) => {
    if (plot && !found.some(item => String(item.plot.id) === String(plot.id))) found.push({ plot, index });
  };

  for (const match of text.matchAll(/(?:^|\s)(\d+)\s*bin[oa](?=\s|$)|(?:^|\s)bin[oa]\s*(\d+)(?=\s|$)/g)) {
    const number = match[1] || match[2];
    const choices = plots
      .filter(plot => new RegExp(`\\b${number}\\b`).test(normalizeText(plot.name)) && /bin[oa]|building|здани/.test(normalizeText(plot.name)))
      .sort((a, b) => {
        const exactA = new RegExp(`^${number}[\\s-]*bin[oa]$`).test(normalizeText(a.name)) ? 1 : 0;
        const exactB = new RegExp(`^${number}[\\s-]*bin[oa]$`).test(normalizeText(b.name)) ? 1 : 0;
        return exactB - exactA;
      });
    add(choices[0], match.index ?? 0);
  }

  const aliases = [
    { query: /kol+ej/, plot: /kollej|колледж/ },
    { query: /ferm+a/, plot: /ferma|ферм/ },
  ];
  for (const alias of aliases) {
    const match = text.match(alias.query);
    if (match) add(plots.find(plot => alias.plot.test(normalizeText(plot.name))), match.index ?? 0);
  }

  for (const plot of plots) {
    const name = normalizeText(plot.name).replace(/[^\p{L}\p{N}]+/gu, ' ');
    const index = text.indexOf(name);
    if (name.length >= 4 && index >= 0) add(plot, index);
  }

  return found.sort((a, b) => a.index - b.index).slice(0, limit).map(item => item.plot);
}

function providerPlot(plot: Plot, lang: Lang) {
  return {
    id: String(plot.id),
    name: plot.name,
    property_type: plot.property_type,
    area: plot.area,
    building_area_m2: plot.building_area_m2,
    industry: plot.industry,
    status: plot.status,
    ownership_type: plot.ownership_type,
    infrastructure: {
      gas: translatedInfraValue(infraValue(plot, 'gas'), lang),
      power: translatedInfraValue(infraValue(plot, 'power'), lang),
      water: translatedInfraValue(infraValue(plot, 'water'), lang),
      road: translatedInfraValue(infraValue(plot, 'road'), lang),
    },
    auction_link_exists: Boolean(plot.auksionUrl),
  };
}

function providerPrompt(message: string, lang: Lang, candidates: Plot[], intent: string, detailed: boolean, scope: 'recommendation' | 'specific' | 'comparison') {
  const wordTarget = detailed ? '180-230' : '120-180';
  return `You are the grounded investment-property consultant for Piskent district.
Answer only in ${LANGUAGE_NAMES[lang]}, regardless of the user's message language.
Use only the candidate objects below. Never invent names, facts, prices, benefits, documents, deadlines, links, or guarantees.
Never rename an object. Copy candidate names exactly. Never mention or add an object outside Candidates.
Scope: ${scope}. ${scope === 'comparison' ? 'Compare every candidate and only these candidates.' : scope === 'specific' ? 'Answer only about the single candidate; do not recommend alternatives.' : intent === 'general' ? `Select exactly ${Math.min(3, candidates.length)} candidates.` : 'Select at most 3 candidates.'}
Use soft wording for business scenarios.
Return strict JSON only: {"answer":"...","recommendedIds":["id"]}.
Normal object format: **Exact object name** — one short grounded reason, then useful infrastructure on separate lines.
Infrastructure labels: ${lang === 'uz' ? 'Gaz / Elektr / Suv / Yo‘l' : lang === 'ru' ? 'Газ / Электричество / Вода / Дорога' : lang === 'en' ? 'Gas / Electricity / Water / Road' : '燃气 / 电力 / 供水 / 道路'}.
Infrastructure values in Candidates are already localized. Copy them exactly; never output raw ha, bor, yo'q, true, or false. Do not mention auction links.
${intent === 'general' ? `The answer must start with exactly: "${lang === 'uz' ? `Siz uchun dastlabki ko‘rib chiqish mumkin bo‘lgan ${Math.min(3, candidates.length)} ta obyekt:` : lang === 'ru' ? `Для первоначального рассмотрения можно предложить ${Math.min(3, candidates.length)} объекта:` : lang === 'en' ? `${Math.min(3, candidates.length)} properties for your initial consideration:` : `可供您初步考虑的${Math.min(3, candidates.length)}个项目：`}". Do not ask a question before the recommendations.` : ''}
For comparison, use short points for 2-3 objects, then a short conclusion. Do not use a table.
If the exact requested category is absent, say it is not separately marked in the database and offer the closest real candidates.
Target length: ${wordTarget} words, followed by one clarifying question. Intent: ${intent}.
User request: ${JSON.stringify(message)}
Candidates: ${JSON.stringify(candidates.map(plot => providerPlot(plot, lang)))}`;
}

function safeParseProvider(content: unknown) {
  try {
    const parsed = JSON.parse(String(content || ''));
    if (!parsed || typeof parsed.answer !== 'string' || !Array.isArray(parsed.recommendedIds)) return null;
    return {
      answer: parsed.answer.trim(),
      recommendedIds: parsed.recommendedIds.map((id: unknown) => String(id)).slice(0, 3),
    };
  } catch {
    return null;
  }
}

function validateProviderResult(result: ReturnType<typeof safeParseProvider>, candidates: Plot[], scope: 'recommendation' | 'specific' | 'comparison', intent: string) {
  if (!result?.answer) return null;
  const candidateIds = new Set(candidates.map(plot => String(plot.id)));
  const ids = [...new Set<string>(result.recommendedIds as string[])].filter(id => candidateIds.has(id)).slice(0, 3);
  if (ids.length === 0) return null;
  if (scope !== 'recommendation' && (ids.length !== candidates.length || candidates.some(plot => !ids.includes(String(plot.id))))) return null;
  if (scope === 'recommendation' && intent === 'general' && ids.length !== Math.min(3, candidates.length)) return null;
  const selected = scope === 'recommendation'
    ? ids.map(id => candidates.find(plot => String(plot.id) === id)!).filter(Boolean)
    : candidates;
  if (selected.some(plot => !normalizeText(result.answer).includes(normalizeText(plot.name)))) return null;
  const boldHeadings = [...result.answer.matchAll(/\*\*([^*]+)\*\*/g)].map(match => normalizeText(match[1]));
  if (boldHeadings.some(heading => !candidates.some(plot => normalizeText(plot.name) === heading))) return null;
  return { answer: result.answer, selected };
}

async function askProvider(message: string, lang: Lang, candidates: Plot[], intent: string, detailed: boolean, scope: 'recommendation' | 'specific' | 'comparison') {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' },
          temperature: attempt === 0 ? 0.2 : 0,
          max_tokens: detailed ? 1400 : 1000,
          messages: [
            { role: 'system', content: 'Return one valid JSON object only. Follow the grounding rules exactly.' },
            { role: 'user', content: providerPrompt(message, lang, candidates, intent, detailed, scope) },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const validated = validateProviderResult(safeParseProvider(data?.choices?.[0]?.message?.content), candidates, scope, intent);
      if (validated) return validated;
    } catch {
      // Retry once, then use the local grounded fallback.
    }
  }
  return null;
}

function infraLines(plot: Plot, lang: Lang) {
  const labels = {
    uz: { gas: 'Gaz', power: 'Elektr', water: 'Suv', road: 'Yo‘l' },
    ru: { gas: 'Газ', power: 'Электричество', water: 'Вода', road: 'Дорога' },
    en: { gas: 'Gas', power: 'Electricity', water: 'Water', road: 'Road' },
    zh: { gas: '燃气', power: '电力', water: '供水', road: '道路' },
  }[lang];
  return (['gas', 'power', 'water', 'road'] as const)
    .map(key => `${labels[key]}: ${translatedInfraValue(infraValue(plot, key), lang)}`)
    .join('\n');
}

function sanitizeInfrastructureAnswer(answer: string, lang: Lang) {
  const labels = {
    uz: { gas: 'Gaz', power: 'Elektr', water: 'Suv', road: 'Yo‘l' },
    ru: { gas: 'Газ', power: 'Электричество', water: 'Вода', road: 'Дорога' },
    en: { gas: 'Gas', power: 'Electricity', water: 'Water', road: 'Road' },
    zh: { gas: '燃气', power: '电力', water: '供水', road: '道路' },
  }[lang];
  const keys: Record<string, keyof typeof labels> = {
    gaz: 'gas', gas: 'gas', газ: 'gas', '燃气': 'gas',
    elektr: 'power', electricity: 'power', электричество: 'power', '电力': 'power',
    suv: 'water', water: 'water', вода: 'water', '供水': 'water',
    "yo'l": 'road', 'yo‘l': 'road', road: 'road', дорога: 'road', '道路': 'road',
  };
  return answer.replace(
    /^(\s*(?:[-*]\s*)?)(?:\*\*)?(Gaz|Gas|Газ|燃气|Elektr|Electricity|Электричество|电力|Suv|Water|Вода|供水|Yo['’‘`]l|Road|Дорога|道路)\s*:(?:\*\*)?\s*([^\r\n]*)/gim,
    (_match, indent: string, label: string, rawValue: string) => {
      const key = keys[normalizeText(label)];
      return `${indent}${labels[key]}: ${translatedInfraValue(normalizeText(rawValue), lang)}`;
    },
  );
}

function generalIntro(lang: Lang, count: number) {
  return {
    uz: `Siz uchun dastlabki ko‘rib chiqish mumkin bo‘lgan ${count} ta obyekt:`,
    ru: `Для первоначального рассмотрения можно предложить ${count} объекта:`,
    en: `${count} properties for your initial consideration:`,
    zh: `可供您初步考虑的${count}个项目：`,
  }[lang];
}

function generalQuestion(lang: Lang) {
  return {
    uz: 'Aniqroq tanlash uchun sizga tayyor bino kerakmi yoki yer maydoni ham muhimmi?',
    ru: 'Для более точного выбора вам нужно готовое здание или земельный участок тоже важен?',
    en: 'For a more precise selection, do you need an existing building, or is land area also important?',
    zh: '为了更准确地选择，您需要现有建筑，还是土地面积也很重要？',
  }[lang];
}

function formatProviderAnswer(answer: string, lang: Lang, intent: string, selectedCount: number) {
  let formatted = sanitizeInfrastructureAnswer(answer, lang).trim();
  if (intent !== 'general') return formatted;

  const lines = formatted.split('\n');
  const questions = lines.filter(line => /[?？]\s*$/.test(line.trim()));
  formatted = lines.filter(line => !/[?？]\s*$/.test(line.trim())).join('\n').trim();
  const intro = generalIntro(lang, selectedCount);
  if (!normalizeText(formatted).startsWith(normalizeText(intro))) formatted = `${intro}\n\n${formatted}`;
  return `${formatted}\n\n${questions[questions.length - 1]?.trim() || generalQuestion(lang)}`;
}

function fallbackReason(plot: Plot, intent: string, lang: Lang) {
  const hasBuilding = ['building', 'land_building'].includes(plot.property_type) || Number(plot.building_area_m2) > 0;
  const reasons: Record<Lang, Record<string, string>> = {
    uz: {
      general: hasBuilding ? 'Tayyor bino va mavjud infratuzilma sababli dastlabki variant sifatida ko‘rib chiqish mumkin.' : 'Maydoni va mavjud infratuzilmasi bo‘yicha ko‘rib chiqish mumkin.',
      production: 'Elektr, yo‘l va maydon ko‘rsatkichlari ishlab chiqarish loyihasi uchun tekshirishga arziydi.',
      tourism: 'Bino, yo‘l va joylashuv imkoniyatlarini turizm loyihasi uchun alohida baholash mumkin.',
      service: 'Bino va kirish imkoniyati servis loyihasi uchun mos variant bo‘lishi mumkin.',
      logistics: 'Maydon va yo‘l holati ombor yoki logistika uchun ko‘rib chiqishga imkon beradi.',
      agro: 'Yer, suv va kirish yo‘li agro loyiha uchun joyida baholanishi mumkin.',
      compare: 'Muhim ko‘rsatkichlari bazadagi ma’lumotlar asosida taqqoslandi.',
    },
    ru: {
      general: hasBuilding ? 'Можно рассмотреть как первоначальный вариант благодаря готовому зданию и указанной инфраструктуре.' : 'Можно рассмотреть по площади и имеющейся инфраструктуре.',
      production: 'Электричество, дорога и площадь заслуживают проверки для производственного проекта.',
      tourism: 'Здание, дорогу и расположение можно отдельно оценить для туристического проекта.',
      service: 'Здание и доступность могут подойти для сервисного проекта.',
      logistics: 'Площадь и дорожный доступ позволяют рассмотреть складской или логистический сценарий.',
      agro: 'Землю, воду и подъезд следует оценить на месте для агропроекта.',
      compare: 'Ключевые параметры сопоставлены по данным базы.',
    },
    en: {
      general: hasBuilding ? 'It can be considered as an initial option because an existing building and infrastructure are recorded.' : 'It can be considered based on its area and recorded infrastructure.',
      production: 'Its electricity, road access, and area are worth checking for production.',
      tourism: 'The building, road access, and location can be assessed separately for tourism.',
      service: 'The building and access may support a service project.',
      logistics: 'The area and road access make a warehouse or logistics scenario worth considering.',
      agro: 'The land, water, and access should be assessed on site for agriculture.',
      compare: 'Key parameters were compared using database records.',
    },
    zh: {
      general: hasBuilding ? '数据库记录了现有建筑和基础设施，可作为初步选项。' : '可根据面积和已记录的基础设施进行初步考虑。',
      production: '其电力、道路和面积值得用于生产项目的进一步核查。',
      tourism: '建筑、道路和位置可针对旅游项目单独评估。',
      service: '建筑和可达性可能适合服务类项目。',
      logistics: '面积和道路条件值得用于仓储或物流场景的评估。',
      agro: '土地、水源和道路应针对农业项目进行现场评估。',
      compare: '关键参数依据数据库记录进行了比较。',
    },
  };
  return reasons[lang][intent] || reasons[lang].general;
}

function generalReason(plot: Plot, lang: Lang) {
  const name = normalizeText(plot.name);
  const type = normalizeText(plot.property_type);
  const industry = normalizeText(plot.industry);
  const hasBuilding = ['building', 'land_building'].includes(type) || Number(plot.building_area_m2) > 0;
  const isLarge = Number(plot.area) >= 5;

  if (/kollej|колледж/.test(name)) {
    return {
      uz: 'katta maydoni sababli yirik loyiha uchun ko‘rib chiqish mumkin.',
      ru: 'благодаря большой площади можно рассмотреть для крупного проекта.',
      en: 'its large area makes it worth considering for a larger project.',
      zh: '面积较大，可考虑用于较大型项目。',
    }[lang];
  }
  if (/ferma|ферм/.test(name) || /agro|qishloq|farm|сельск/.test(industry)) {
    return {
      uz: 'mavjud infratuzilmasi bilan agro yoki ishlab chiqarish loyihasi uchun ko‘rib chiqish mumkin.',
      ru: 'имеющаяся инфраструктура позволяет рассмотреть объект для аграрного или производственного проекта.',
      en: 'its recorded infrastructure makes it worth considering for an agricultural or production project.',
      zh: '已记录的基础设施使其可用于农业或生产项目的初步评估。',
    }[lang];
  }
  if (isLarge) {
    return {
      uz: 'katta maydoni sababli yirik loyiha uchun ko‘rib chiqish mumkin.',
      ru: 'благодаря большой площади можно рассмотреть для крупного проекта.',
      en: 'its large area makes it worth considering for a larger project.',
      zh: '面积较大，可考虑用于较大型项目。',
    }[lang];
  }
  if (hasBuilding) {
    return {
      uz: 'tayyor bino sifatida kichikroq ishlab chiqarish yoki servis loyihasi uchun ko‘rib chiqish mumkin.',
      ru: 'готовое здание можно рассмотреть для небольшого производственного или сервисного проекта.',
      en: 'the existing building can be considered for a smaller production or service project.',
      zh: '现有建筑可考虑用于较小型的生产或服务项目。',
    }[lang];
  }
  return {
    uz: 'yer maydoni va mavjud kommunikatsiyalari bo‘yicha dastlabki variant sifatida ko‘rib chiqish mumkin.',
    ru: 'можно рассмотреть как первоначальный вариант с учётом площади участка и указанных коммуникаций.',
    en: 'it can be considered as an initial option based on its land area and recorded utilities.',
    zh: '可根据土地面积和已记录的配套设施作为初步选项。',
  }[lang];
}

function composeGeneralAnswer(selected: Plot[], lang: Lang) {
  const plots = selected.slice(0, 3);
  const blocks = plots.map(plot =>
    `**${plot.name}** — ${generalReason(plot, lang)}\n\n${infraLines(plot, lang)}\n\n[RECOMMEND_ID:${plot.id}]`
  );
  const ending = {
    uz: `Xulosa: agar tayyor infratuzilma muhim bo‘lsa, yuqoridagi obyektlarni dastlabki tanlov sifatida ko‘rib chiqish mumkin.\n\n${generalQuestion(lang)}`,
    ru: `Вывод: если важна готовая инфраструктура, перечисленные объекты можно рассмотреть как первоначальный выбор.\n\n${generalQuestion(lang)}`,
    en: `Conclusion: if existing infrastructure is important, the properties above can be considered as an initial shortlist.\n\n${generalQuestion(lang)}`,
    zh: `结论：如果现有基础设施很重要，可以将上述项目作为初步候选。\n\n${generalQuestion(lang)}`,
  }[lang];
  return [generalIntro(lang, plots.length), ...blocks, ending].join('\n\n');
}

function fallbackAnswer(candidates: Plot[], intent: string, lang: Lang) {
  const selected = candidates.slice(0, 3);
  const categoryIntro = intent !== 'general' && !selected.some(plot => {
    const pattern = {
      production: /sanoat|production|производ/,
      tourism: /turizm|tourism|туризм|hotel/,
      service: /service|servis|сервис|xizmat/,
      logistics: /logist|warehouse|ombor|склад/,
      agro: /agro|ferma|farm|ферм/,
      compare: /$^/,
    }[intent];
    return pattern?.test(normalizeText(`${plot.name} ${plot.industry}`));
  });
  const intro = intent === 'general' ? generalIntro(lang, selected.length) : categoryIntro ? {
    uz: 'So‘ralgan toifa bazada alohida belgilanmagan. Eng yaqin real variantlar:',
    ru: 'Запрошенная категория отдельно не отмечена в базе. Ближайшие реальные варианты:',
    en: 'The requested category is not separately marked in the database. Closest real options:',
    zh: '数据库中未单独标注该类别。最接近的真实选项如下：',
  }[lang] : '';
  const blocks = selected.map(plot =>
    `**${plot.name}** — ${fallbackReason(plot, intent, lang)}\n\n${infraLines(plot, lang)}\n\n[RECOMMEND_ID:${plot.id}]`
  );
  const featuredNames = selected.slice(0, 2).map(plot => plot.name).join(lang === 'ru' ? ' и ' : lang === 'en' ? ' and ' : lang === 'zh' ? '和' : ' va ');
  const ending = intent === 'general' ? {
    uz: `Xulosa: agar tayyor infratuzilma muhim bo‘lsa, ${featuredNames} obyektlarini birinchi navbatda ko‘rib chiqish mumkin.\n\n${generalQuestion(lang)}`,
    ru: `Вывод: если важна готовая инфраструктура, в первую очередь можно рассмотреть ${featuredNames}.\n\n${generalQuestion(lang)}`,
    en: `Conclusion: if existing infrastructure is important, ${featuredNames} can be considered first.\n\n${generalQuestion(lang)}`,
    zh: `结论：如果现有基础设施很重要，可以优先考虑${featuredNames}。\n\n${generalQuestion(lang)}`,
  }[lang] : {
    uz: `Xulosa: bu obyektlar dastlabki tanlov uchun ko‘rib chiqilishi mumkin.\n\n${generalQuestion(lang)}`,
    ru: `Вывод: эти объекты можно рассмотреть для первоначального выбора.\n\n${generalQuestion(lang)}`,
    en: `Conclusion: these properties can be considered for an initial shortlist.\n\n${generalQuestion(lang)}`,
    zh: `结论：这些项目可作为初步候选。\n\n${generalQuestion(lang)}`,
  }[lang];
  return { answer: [intro, ...blocks, ending].filter(Boolean).join('\n\n'), selected };
}

function priceAnswer(plot: Plot, lang: Lang) {
  const text = {
    uz: `Bazadagi ma’lumotlarda ${plot.name} narxi ko‘rsatilmagan. Narx va moliyaviy shartlarni mas’ul bo‘lim orqali aniqlashtirish kerak.`,
    ru: `В базе цена объекта «${plot.name}» не указана. Цену, аренду и финансовые условия необходимо уточнить у ответственного отдела.`,
    en: `The database does not show a price for ${plot.name}. The price, rent, and financial terms must be clarified with the responsible department.`,
    zh: `数据库中未显示“${plot.name}”的价格。价格、租赁和财务条件需要向负责部门确认。`,
  }[lang];
  return `${text}\n\n[RECOMMEND_ID:${plot.id}]`;
}

function comparisonFallback(plots: Plot[], lang: Lang) {
  const blocks = plots.map(plot => `**${plot.name}**\n${infraLines(plot, lang)}\n[RECOMMEND_ID:${plot.id}]`);
  const conclusion = {
    uz: 'Xulosa: obyektlar faqat bazada mavjud ko‘rsatkichlar bo‘yicha taqqoslandi; yakuniy tanlovni loyiha talablari asosida qilish kerak.',
    ru: 'Вывод: объекты сравнены только по имеющимся в базе показателям; итоговый выбор зависит от требований проекта.',
    en: 'Conclusion: the properties were compared only by the data available in the database; the final choice depends on project requirements.',
    zh: '结论：仅依据数据库现有信息进行了比较；最终选择取决于项目要求。',
  }[lang];
  return [...blocks, conclusion].join('\n\n');
}

function comparisonClarification(lang: Lang) {
  return {
    uz: 'Taqqoslash uchun ikki yoki uchta obyekt nomini aniqroq yozing: masalan, 1-bino va 2-bino.',
    ru: 'Для сравнения точнее укажите названия двух или трёх объектов, например: 1-bino и 2-bino.',
    en: 'For comparison, specify two or three property names more precisely, for example: 1-bino and 2-bino.',
    zh: '请更准确地注明两个或三个项目名称，例如：1-bino 和 2-bino。',
  }[lang];
}

function priceClarification(lang: Lang) {
  return {
    uz: 'Narxni aniqlash uchun obyekt nomini aniqroq yozing, masalan: 1-bino narxi qancha?',
    ru: 'Чтобы уточнить цену, укажите название объекта, например: сколько стоит 1-bino?',
    en: 'To check a price, specify the property name, for example: how much does 1-bino cost?',
    zh: '如需查询价格，请明确项目名称，例如：1-bino 的价格是多少？',
  }[lang];
}

function attachMarkers(answer: string, selected: Plot[], intent: string) {
  let result = answer.replace(/\[RECOMMEND_ID:[^\]]+\]/g, '').trim();
  if (intent === 'compare') {
    return `${result}\n\n${selected.map(plot => `[RECOMMEND_ID:${plot.id}]`).join('\n')}`;
  }
  for (const plot of selected) {
    const lines = result.split('\n');
    const index = lines.findIndex(line => normalizeText(line).includes(normalizeText(plot.name)));
    if (index >= 0) {
      let insertAt = index + 1;
      while (insertAt < lines.length && lines[insertAt].trim() && !lines[insertAt].includes('|')) insertAt += 1;
      lines.splice(insertAt, 0, `[RECOMMEND_ID:${plot.id}]`);
      result = lines.join('\n');
    } else {
      result += `\n\n${plot.name}\n[RECOMMEND_ID:${plot.id}]`;
    }
  }
  return result;
}

function chatResponse(answer: string, selected: Plot[] = []) {
  const recommendedObjects = selected.map(plot => ({
    id: String(plot.id),
    name: plot.name,
    polygonCoordinates: plot.polygonCoordinates,
  }));

  return NextResponse.json({
    // Keep `text` and embedded markers for older clients.
    text: answer,
    answer: answer.replace(/\[(?:RECOMMEND_ID|SHOW_MAP):[^\]]+\]|\[\[map:[^\]]+\]\]/gi, '').trim(),
    recommendedIds: recommendedObjects.map(plot => plot.id),
    recommendedObjects,
  });
}

async function loadPlots(req: NextRequest) {
  const response = await fetch(new URL('/api/save-plots', req.nextUrl.origin), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Plots source error: ${response.status}`);
  const data = await response.json();
  return normalizePlots(Array.isArray(data) ? data : []);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const lang = normalizeLang(body.lang);
    if (!message) return NextResponse.json({ error: 'Invalid message' }, { status: 400 });

    if (isGreeting(message)) return chatResponse(localText(lang, 'greeting'));
    if (isContactRequest(message)) return chatResponse(localText(lang, 'contact'));
    if (!isPriceRequest(message) && isOffTopic(message)) return chatResponse(localText(lang, 'offTopic'));

    const plots = await loadPlots(req);
    if (plots.length === 0) return chatResponse(localText(lang, 'notFound'));
    const explicitlyNamed = findNamedPlots(message, plots, 3);

    if (isPriceRequest(message)) {
      if (explicitlyNamed.length === 0) return chatResponse(priceClarification(lang));
      return chatResponse(priceAnswer(explicitlyNamed[0], lang), explicitlyNamed.slice(0, 1));
    }

    if (isShowOnMapRequest(message)) {
      if (explicitlyNamed.length === 0) return chatResponse(localText(lang, 'notFound'));
      return chatResponse(`${explicitlyNamed[0].name}\n[RECOMMEND_ID:${explicitlyNamed[0].id}]`, explicitlyNamed.slice(0, 1));
    }

    const intent = getIntent(message);
    if (intent === 'compare' && explicitlyNamed.length < 2) {
      return chatResponse(comparisonClarification(lang));
    }

    const isSpecific = intent !== 'compare' && explicitlyNamed.length === 1 && !asksForAlternatives(message);
    const scope = intent === 'compare' ? 'comparison' : isSpecific ? 'specific' : 'recommendation';
    const candidates = intent === 'compare'
      ? explicitlyNamed
      : isSpecific
        ? explicitlyNamed.slice(0, 1)
        : selectCandidates(message, plots, intent);
    if (candidates.length === 0) return chatResponse(localText(lang, 'notFound'));

    const provider = await askProvider(message, lang, candidates, intent, isDetailedRequest(message), scope);
    if (provider) {
      if (intent === 'general') {
        return chatResponse(composeGeneralAnswer(provider.selected, lang), provider.selected);
      }
      const formatted = formatProviderAnswer(provider.answer, lang, intent, provider.selected.length);
      return chatResponse(attachMarkers(formatted, provider.selected, intent), provider.selected);
    }

    if (intent === 'compare') {
      return chatResponse(comparisonFallback(candidates, lang), candidates);
    }
    if (intent === 'general') {
      const selected = candidates.slice(0, 3);
      return chatResponse(composeGeneralAnswer(selected, lang), selected);
    }
    const fallback = fallbackAnswer(candidates, intent, lang);
    return chatResponse(fallback.answer, fallback.selected);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
