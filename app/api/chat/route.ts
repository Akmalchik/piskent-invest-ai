import { NextRequest, NextResponse } from 'next/server';

function normalizePlots(plots: any[]) {
  return plots
    .filter(plot => plot && plot.id !== undefined)
    .map(plot => ({
      id: plot.id,
      name: plot.name,
      area: plot.area,
      industry: plot.industry,
      status: plot.status,
      ownership_type: plot.ownership_type || plot.ownershipType || '',
      infrastructure: plot.infrastructure || {},
      image: plot.image || plot.image_url || plot.photo_url || '',
      auksionUrl: plot.auksionUrl || plot.auksion_url || plot.auction_url || '',
      polygonCoordinates: plot.polygonCoordinates || plot.polygon_coords || [],
    }));
}

function toCompactPlot(plot: any) {
  return {
    id: plot.id,
    name: plot.name,
    area: plot.area,
    industry: plot.industry,
    status: plot.status,
    ownership_type: plot.ownership_type || '',
    infrastructure: plot.infrastructure || {},
    auksionUrl: plot.auksionUrl || '',
  };
}

function parseAreaRequest(message: string) {
  const matches = message.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:ga|gektar|гектар(?:а|ов)?|ha)\b/gi);
  const areas = Array.from(matches, match => Number(match[1].replace(',', '.'))).filter(Number.isFinite);
  return areas.length > 0 ? areas[0] : null;
}

function isTestPlot(plot: any) {
  const name = String(plot.name || '').trim().toLowerCase();
  return !name || name === 'test' || name.includes('test');
}

function selectRelevantPlots(message: string, availablePlots: any[]) {
  const normalizedMessage = message.toLowerCase();
  const requestedArea = parseAreaRequest(message);
  const wantsProduction = /sanoat|производств|factory|zavod|завод/.test(normalizedMessage);
  const wantsHotel = /hotel|mehmonxona|гостиниц|отел/.test(normalizedMessage);
  const wantsLogistics = /logistika|logistics|sklad|склад|логист/.test(normalizedMessage);
  const wantsAgro = /agro|ферм|qishloq|dehqon|farm|сельск/.test(normalizedMessage);
  const wantsService = /servis|service|сервис|услуг/.test(normalizedMessage);
  const wantsSmallBusiness = /kichik biznes|мал(?:ого|ый) бизнес|small business/.test(normalizedMessage);
  const wantsBuilding = /bino|здани|building/.test(normalizedMessage);
  const wantsLand = /yer|земл|land|участ/.test(normalizedMessage);
  const wantsLargest = /eng katta|сам(?:ые|ый) крупн|largest|biggest/.test(normalizedMessage);
  const isBusinessTask = wantsProduction || wantsHotel || wantsLogistics || wantsAgro || wantsService || wantsSmallBusiness;
  const infraRequests = [
    { key: 'gas', matched: /gaz|газ/.test(normalizedMessage), fields: ['gas'] },
    { key: 'power', matched: /elektr|свет|электрич/.test(normalizedMessage), fields: ['power', 'electricity'] },
    { key: 'water', matched: /suv|вода|водоснаб/.test(normalizedMessage), fields: ['water'] },
    { key: 'road', matched: /yo['’`]?l|дорога|asfalt|асфальт/.test(normalizedMessage), fields: ['road'] },
  ];

  const compactPlots = availablePlots.map(toCompactPlot);
  const normalPlots = compactPlots.filter(plot => !isTestPlot(plot));
  const candidatePlots = normalPlots.length > 0 ? normalPlots : compactPlots;

  const scoredPlots = candidatePlots
    .map(plot => {
      let score = 0;
      const area = Number(plot.area);
      const industryText = String(plot.industry || '').toLowerCase();
      const nameText = String(plot.name || '').toLowerCase();
      const statusText = String(plot.status || '').toLowerCase();
      const infrastructure = plot.infrastructure || {};
      const infrastructureText = JSON.stringify(infrastructure).toLowerCase();

      if (requestedArea !== null && Number.isFinite(area)) {
        if (Math.abs(area - requestedArea) <= Math.max(1, requestedArea * 0.25)) score += 3;
        if (area >= requestedArea) score += 2;
        if (area < requestedArea * 0.5) score -= 2;
      }

      if (wantsProduction && /production|sanoat|производ|industrial|factory|zavod/.test(`${industryText} ${nameText}`)) score += 2;
      if (wantsHotel && /hotel|mehmonxona|гостиниц|service|servis|tourism|туризм/.test(`${industryText} ${nameText}`)) score += 2;
      if (wantsLogistics && /logistics|logistika|склад|warehouse|road|yo'l|йул|дорог/.test(`${industryText} ${nameText} ${statusText} ${infrastructureText}`)) score += 2;
      if (wantsAgro && /agro|qishloq|dehqon|farm|ферм|сельск/.test(`${industryText} ${nameText}`)) score += 2;
      if (wantsService && /service|servis|сервис|услуг|tourism|торгов/.test(`${industryText} ${nameText}`)) score += 2;
      if (wantsSmallBusiness && /service|servis|сервис|услуг|торгов|building|bino|здани/.test(`${industryText} ${nameText}`)) score += 1;
      if (wantsBuilding && /building|bino|здани|помещ/.test(`${industryText} ${nameText} ${statusText}`)) score += 2;
      if (wantsLand && /land|yer|земл|участ/.test(`${industryText} ${nameText} ${statusText}`)) score += 1;

      for (const request of infraRequests) {
        if (!request.matched) continue;

        const hasInfrastructure = request.fields.some(field => {
          const value = infrastructure[field];
          const normalizedValue = String(value || '').trim().toLowerCase();
          return normalizedValue !== '' && !/mavjud emas|yo['’`]?q|нет|not available|unavailable|不可用/.test(normalizedValue);
        });

        score += hasInfrastructure ? 2 : -1;
      }

      return { plot, score };
    })
    .sort((a, b) => wantsLargest
      ? (Number(b.plot.area) || 0) - (Number(a.plot.area) || 0)
      : b.score - a.score || (Number(b.plot.area) || 0) - (Number(a.plot.area) || 0));

  const positiveMatches = scoredPlots.filter(item => item.score > 0);
  const hasExactMatch = wantsLargest || positiveMatches.length > 0;
  const selected = hasExactMatch
    ? (wantsLargest || isBusinessTask ? scoredPlots : positiveMatches)
    : scoredPlots;
  const limit = hasExactMatch && (isBusinessTask || wantsLargest || infraRequests.some(item => item.matched)) ? 4 : 3;

  return {
    plots: selected.slice(0, limit).map(item => item.plot),
    hasExactMatch,
    intent: wantsProduction ? 'production'
      : wantsLogistics ? 'logistics'
        : wantsAgro ? 'agro'
          : wantsService || wantsHotel ? 'service'
            : wantsSmallBusiness ? 'smallBusiness'
              : 'general',
  };
}

function isRelevantInvestmentQuestion(message: string) {
  const normalizedMessage = message.toLowerCase();
  const investmentKeywords =
    /piskent|пскент|пискент|皮斯肯特|invest|инвест|投资|obyekt|объект|property|地块|yer|земл|land|土地|lot|лот|uchast|участ|maydon|площад|area|面积|gektar|гектар|公顷|infratuzilma|инфраструктур|infrastructure|基础设施|gaz|газ|天然气|elektr|электр|свет|电力|suv|вода|水|yo['’`]?l|дорога|asfalt|道路|auksion|auction|аукцион|e-auksion|business|biznes|бизнес|业务|sanoat|производ|factory|zavod|工业|hotel|mehmonxona|гостиниц|酒店|logistika|logistics|sklad|склад|物流|agro|агро|农业|textile|текстил|纺织|contact|контакт|aloqa|связ|联系/.test(normalizedMessage);

  return investmentKeywords;
}

function isGreetingMessage(message: string) {
  const normalizedMessage = message.trim().toLowerCase();
  return /^(salom|assalomu alaykum|привет|hello|hi|你好)[!.?\s]*$/.test(normalizedMessage);
}

function getGreetingResponse(lang: string) {
  if (lang === 'ru') {
    return 'Цифровой инвестиционный консультант предоставляет официальную информацию и рекомендации по инвестиционным объектам Пискентского района. Например:\n• Земельный участок для промышленного проекта\n• Объекты с газом и электричеством\n• Локация для строительства гостиницы\n• Объект для логистики';
  }

  if (lang === 'en') {
    return 'The Digital Investment Consultant provides official information and recommendations on investment properties in Piskent district. For example:\n• Land area for an industrial project\n• Properties with gas and electricity\n• Location for hotel construction\n• Property for logistics';
  }

  if (lang === 'zh') {
    return '数字投资顾问提供皮斯肯特区投资项目的官方信息和建议。例如：\n• 工业项目用地\n• 具备天然气和电力的项目\n• 酒店建设选址\n• 物流用途项目';
  }

  return 'Raqamli investitsiya maslahatchisi Piskent tumanidagi investitsiya obyektlari bo‘yicha rasmiy ma\'lumot va tavsiyalar taqdim etadi. Masalan:\n• Sanoat loyihasi uchun yer maydoni\n• Gaz va elektr mavjud obyektlar\n• Mehmonxona qurilishi uchun joy\n• Logistika uchun obyekt';
}

function getOffTopicResponse(lang: string) {
  if (lang === 'ru') {
    return 'Я могу помочь по инвестиционным объектам Пискентского района: подобрать объект по типу деятельности, площади и инфраструктуре.';
  }

  if (lang === 'en') {
    return 'Sorry, I can only advise on investment properties in Piskent district. Please ask about land area, infrastructure, or business direction.';
  }

  if (lang === 'zh') {
    return '抱歉，我只能就皮斯肯特区的投资地块提供咨询。请询问土地面积、基础设施或业务方向。';
  }

  return 'Uzr, men faqat Piskent tumanidagi investitsiya obyektlari bo‘yicha maslahat bera olaman. Yer maydoni, infratuzilma yoki biznes yo‘nalishi bo‘yicha savol bering.';
}

function getNoMatchingPlotsResponse(lang: string) {
  if (lang === 'ru') {
    return 'Точного совпадения по запросу не найдено. Уточните желаемый тип деятельности, площадь или инфраструктуру.';
  }

  if (lang === 'en') {
    return 'No exact matching property was found for your request. You can view other available properties on the map.';
  }

  if (lang === 'zh') {
    return '未找到与您的请求完全匹配的地块。您可以在地图上查看其他可用地块。';
  }

  return 'So‘rovingiz bo‘yicha aniq mos obyekt topilmadi. Biroq xaritada boshqa mavjud obyektlarni ko‘rishingiz mumkin.';
}

function normalizeInfrastructureValue(value: unknown, lang: string) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  const lowerValue = rawValue.toLowerCase().replace(/’/g, "'");
  const isUnavailable = /mavjud emas|yo['`]?q|yo‘q|нет|not available|unavailable|不可用/.test(lowerValue);
  const isUnknown = /aniqlanmoqda|уточняется|being clarified|unknown|确认中/.test(lowerValue);
  const isAvailable = /mavjud|есть|available|bor|有|可用/.test(lowerValue);
  const isAsphalt = /asfalt|асфальт|asphalt|沥青/.test(lowerValue);
  const isGravel = /shag['`]?al|shag‘al|щеб|gravel|碎石/.test(lowerValue);
  const isDirtRoad = /tuproq yo['`]?l|tuproq yo‘l|грунт|dirt road|土路/.test(lowerValue);
  const isWell = /quduq|скваж|well|井/.test(lowerValue);

  if (isUnavailable) {
    if (lang === 'ru') return 'нет';
    if (lang === 'en') return 'not available';
    if (lang === 'zh') return '不可用';
    return 'Mavjud emas';
  }

  if (isUnknown) {
    if (lang === 'ru') return 'уточняется';
    if (lang === 'en') return 'being clarified';
    if (lang === 'zh') return '确认中';
    return 'Aniqlanmoqda';
  }

  if (isAvailable) {
    if (lang === 'ru') return 'есть';
    if (lang === 'en') return 'available';
    if (lang === 'zh') return '有';
    return 'Mavjud';
  }

  if (isAsphalt) {
    if (lang === 'ru') return 'асфальт';
    if (lang === 'en') return 'asphalt';
    if (lang === 'zh') return '沥青路';
    return 'Asfalt';
  }

  if (isGravel) {
    if (lang === 'ru') return 'щебень';
    if (lang === 'en') return 'gravel';
    if (lang === 'zh') return '碎石路';
    return "Shag'al";
  }

  if (isDirtRoad) {
    if (lang === 'ru') return 'грунтовая дорога';
    if (lang === 'en') return 'dirt road';
    if (lang === 'zh') return '土路';
    return "Tuproq yo'l";
  }

  if (isWell) {
    if (lang === 'ru') return 'скважина';
    if (lang === 'en') return 'well';
    if (lang === 'zh') return '水井';
    return 'Quduq';
  }

  if (lang === 'en') return rawValue.replace(/кВт|kBT|kVt/gi, 'kW');
  if (lang === 'zh') return rawValue.replace(/\s*(кВт|kBT|kVt|kW)\b/gi, '千瓦');
  if (lang === 'ru') return rawValue.replace(/kBT|kVt|kW/gi, 'кВт');
  return rawValue.replace(/кВт|kBT|kW/gi, 'kVt');
}

function formatInfrastructure(infrastructure: any, lang: string) {
  if (!infrastructure || typeof infrastructure !== 'object') return '';

  const gas = normalizeInfrastructureValue(infrastructure.gas, lang);
  const power = normalizeInfrastructureValue(infrastructure.power || infrastructure.electricity, lang);
  const water = normalizeInfrastructureValue(infrastructure.water, lang);
  const road = normalizeInfrastructureValue(infrastructure.road, lang);

  const labels: Record<string, Record<string, string>> = {
    uz: { gas: '🔥 Gaz', power: '⚡ Elektr', water: '💧 Suv', road: '🛣 Yo‘l' },
    ru: { gas: '🔥 Газ', power: '⚡ Электричество', water: '💧 Вода', road: '🛣 Дорога' },
    en: { gas: '🔥 Gas', power: '⚡ Electricity', water: '💧 Water', road: '🛣 Road' },
    zh: { gas: '🔥 天然气', power: '⚡ 电力', water: '💧 供水', road: '🛣 道路' },
  };
  const separator = lang === 'zh' ? '：' : ': ';
  const activeLabels = labels[lang] || labels.uz;
  const items = [
    gas ? `${activeLabels.gas}${separator}${gas}` : '',
    power ? `${activeLabels.power}${separator}${power}` : '',
    water ? `${activeLabels.water}${separator}${water}` : '',
    road ? `${activeLabels.road}${separator}${road}` : '',
  ].filter(Boolean);

  return items.join('\n');
}

function formatOwnershipType(ownershipType: string, lang: string) {
  if (!ownershipType) return '';
  const value = ownershipType.toLowerCase();

  if (value.includes('davlat')) {
    if (lang === 'ru') return 'Это государственный объект.';
    if (lang === 'en') return 'This is a state-owned property.';
    if (lang === 'zh') return '这是国有资产。';
    return 'Bu davlat obyekti.';
  }

  if (value.includes('auksion')) {
    if (lang === 'ru') return 'Объект реализуется через E-Auksion.';
    if (lang === 'en') return 'The property is offered through E-Auction.';
    if (lang === 'zh') return '该项目通过电子拍卖进行处置。';
    return 'Obyekt E-Auksion orqali realizatsiya qilinadi.';
  }

  if (value.includes('xususiy')) {
    if (lang === 'ru') return 'Это частный инвестиционный объект.';
    if (lang === 'en') return 'This is a private investment property.';
    if (lang === 'zh') return '这是私有投资资产。';
    return 'Bu xususiy investitsiya obyekti.';
  }

  return ownershipType;
}

function getIdea(plot: any, lang: string) {
  const text = `${plot.industry || ''} ${plot.name || ''}`.toLowerCase();

  if (lang === 'ru') {
    if (/hotel|mehmonxona|гостиниц|service|servis|tourism/.test(text)) return 'Гостиница или сервисный объект.';
    if (/logistics|logistika|склад|warehouse/.test(text)) return 'Склад или логистический центр.';
    if (/agro|агро|qishloq/.test(text)) return 'Агропереработка или хранение продукции.';
    if (/textile|текстил|to'qimachilik/.test(text)) return 'Текстильное производство.';
    return 'Производственный или сервисный проект.';
  }

  if (lang === 'en') {
    if (/hotel|mehmonxona|гостиниц|service|servis|tourism/.test(text)) return 'Hotel or service facility.';
    if (/logistics|logistika|склад|warehouse/.test(text)) return 'Warehouse or logistics center.';
    if (/agro|агро|qishloq/.test(text)) return 'Agro-processing or storage project.';
    if (/textile|текстил|to'qimachilik/.test(text)) return 'Textile production.';
    return 'Production or service project.';
  }

  if (lang === 'zh') {
    if (/hotel|mehmonxona|гостиниц|service|servis|tourism/.test(text)) return '酒店或服务设施。';
    if (/logistics|logistika|склад|warehouse/.test(text)) return '仓储或物流中心。';
    if (/agro|агро|qishloq/.test(text)) return '农产品加工或仓储项目。';
    if (/textile|текстил|to'qimachilik/.test(text)) return '纺织生产项目。';
    return '生产或服务项目。';
  }

  if (/hotel|mehmonxona|гостиниц|service|servis|tourism/.test(text)) return 'Mehmonxona yoki servis obyekti.';
  if (/logistics|logistika|склад|warehouse/.test(text)) return 'Ombor yoki logistika markazi.';
  if (/agro|агро|qishloq/.test(text)) return 'Agro qayta ishlash yoki saqlash loyihasi.';
  if (/textile|текстил|to'qimachilik/.test(text)) return 'To‘qimachilik ishlab chiqarishi.';
  return 'Ishlab chiqarish yoki servis loyihasi.';
}

function buildTemplateResponse(plots: any[], lang: string, intent: string, hasExactMatch: boolean) {
  const recommendationMarkers = plots
    .filter(plot => plot.id !== undefined && plot.id !== null)
    .map(plot => `[RECOMMEND_ID:${plot.id}]`)
    .join('\n');
  const advice: Record<string, Record<string, string>> = {
    ru: {
      production: 'Для производства обычно важны электричество, дорога и достаточная площадь здания.',
      logistics: 'Для склада обычно важны дорога, полезная площадь и удобная логистика.',
      agro: 'Для фермерского проекта обычно важны земля, вода и подъезд.',
      service: 'Для сервисного проекта обычно важны локация и доступность.',
      smallBusiness: 'Для малого бизнеса практичнее начинать с объекта подходящего масштаба и проверенной доступности.',
      general: 'Перед выбором рекомендуется проверить назначение объекта и актуальность инфраструктуры.',
    },
    uz: {
      production: 'Ishlab chiqarish uchun odatda elektr, yo‘l va binoning yetarli maydoni muhim.',
      logistics: 'Ombor uchun odatda yo‘l, foydali maydon va qulay logistika muhim.',
      agro: 'Fermerlik loyihasi uchun odatda yer, suv va kirish yo‘li muhim.',
      service: 'Servis loyihasi uchun odatda joylashuv va qulay kirish muhim.',
      smallBusiness: 'Kichik biznes uchun mos ko‘lamdagi va kirish imkoniyati tekshirilgan obyekt ma’qul.',
      general: 'Tanlashdan oldin obyekt maqsadi va infratuzilma holatini tekshirish tavsiya etiladi.',
    },
    en: {
      production: 'Production projects generally depend on electricity, road access, and sufficient building area.',
      logistics: 'Warehouses generally depend on road access, usable area, and convenient logistics.',
      agro: 'Agricultural projects generally depend on land, water, and access roads.',
      service: 'Service projects generally depend on location and accessibility.',
      smallBusiness: 'For a small business, a suitably sized and accessible property is usually more practical.',
      general: 'Before choosing, verify the property purpose and current infrastructure.',
    },
    zh: {
      production: '生产项目通常应重点考虑电力、道路和足够的建筑面积。',
      logistics: '仓储项目通常应重点考虑道路、可用面积和物流条件。',
      agro: '农业项目通常应重点考虑土地、水源和进场道路。',
      service: '服务项目通常应重点考虑位置和交通便利性。',
      smallBusiness: '小型企业通常更适合规模适当且交通便利的项目。',
      general: '选择前建议核实项目用途和基础设施的最新情况。',
    },
  };
  const activeLang = ['ru', 'en', 'zh'].includes(lang) ? lang : 'uz';
  const intro = hasExactMatch
    ? ({ ru: 'По вашему запросу можно рассмотреть следующие объекты:', en: 'The following properties are worth considering for your request:', zh: '根据您的需求，可以考虑以下项目：', uz: 'So‘rovingiz bo‘yicha quyidagi obyektlarni ko‘rib chiqish mumkin:' }[activeLang])
    : ({ ru: 'Точного совпадения по запросу не найдено. Но можно рассмотреть ближайшие варианты:', en: 'No exact match was found. However, you can consider these closest alternatives:', zh: '未找到完全匹配的项目，但可以考虑以下最接近的选项：', uz: 'So‘rov bo‘yicha aniq moslik topilmadi. Ammo eng yaqin variantlarni ko‘rib chiqish mumkin:' }[activeLang]);
  let hasMissingData = false;
  const items = plots.map((plot, index) => {
    const details = [
      plot.area !== undefined && plot.area !== null && plot.area !== '' ? `${plot.area} ${activeLang === 'ru' ? 'га' : activeLang === 'zh' ? '公顷' : 'ha'}` : '',
      formatInfrastructure(plot.infrastructure, activeLang).replace(/\n/g, ', '),
    ].filter(Boolean);
    if (!plot.area || !formatInfrastructure(plot.infrastructure, activeLang)) hasMissingData = true;
    const idea = getIdea(plot, activeLang);
    if (activeLang === 'ru') return `${index + 1}. ${plot.name || 'Объект'}${details.length ? ` — ${details.join('; ')}` : ''}; возможный сценарий: ${idea.toLowerCase()}`;
    if (activeLang === 'en') return `${index + 1}. ${plot.name || 'Property'}${details.length ? ` — ${details.join('; ')}` : ''}; possible use: ${idea.toLowerCase()}`;
    if (activeLang === 'zh') return `${index + 1}. ${plot.name || '项目'}${details.length ? ` — ${details.join('；')}` : ''}；可考虑用途：${idea}`;
    return `${index + 1}. ${plot.name || 'Obyekt'}${details.length ? ` — ${details.join('; ')}` : ''}; mumkin bo‘lgan yo‘nalish: ${idea.toLowerCase()}`;
  });
  const missing = hasMissingData
    ? ({ ru: 'По этому объекту часть данных требует уточнения.', en: 'Some data for this property requires clarification.', zh: '该项目的部分数据需要进一步确认。', uz: 'Bu obyekt bo‘yicha ayrim ma’lumotlar aniqlashtirilishi kerak.' }[activeLang])
    : '';
  const question = {
    ru: 'Какой параметр для вас приоритетнее: площадь, тип деятельности или инфраструктура?',
    en: 'Which is your priority: area, type of activity, or infrastructure?',
    zh: '您更看重面积、经营类型还是基础设施？',
    uz: 'Siz uchun qaysi parametr ustuvor: maydon, faoliyat turi yoki infratuzilma?',
  }[activeLang];

  return [intro, ...items, advice[activeLang][intent] || advice[activeLang].general, missing, question, recommendationMarkers]
    .filter(Boolean)
    .join('\n');
}

async function loadPlots(req: NextRequest, incomingPlots: unknown) {
  if (Array.isArray(incomingPlots) && incomingPlots.length > 0) {
    return normalizePlots(incomingPlots);
  }

  const plotsResponse = await fetch(new URL('/api/save-plots', req.nextUrl.origin), {
    next: { revalidate: 60 },
  });

  if (!plotsResponse.ok) {
    throw new Error(`Plots source error: ${plotsResponse.status}`);
  }

  const apiPlots = await plotsResponse.json();
  return Array.isArray(apiPlots) ? normalizePlots(apiPlots) : [];
}

export async function POST(req: NextRequest) {
  try {
    const { message, plots, lang = 'uz' } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    }

    if (isGreetingMessage(message)) {
      return NextResponse.json({ text: getGreetingResponse(lang) });
    }

    if (!isRelevantInvestmentQuestion(message)) {
      return NextResponse.json({ text: getOffTopicResponse(lang) });
    }

    const availablePlots = await loadPlots(req, plots);
    if (availablePlots.length === 0) {
      return NextResponse.json({ error: 'No investment plots available for AI consultation' }, { status: 503 });
    }
    const selection = selectRelevantPlots(message, availablePlots);
    if (selection.plots.length === 0) {
      return NextResponse.json({ text: getNoMatchingPlotsResponse(lang) });
    }

    return NextResponse.json({ text: buildTemplateResponse(selection.plots, lang, selection.intent, selection.hasExactMatch) });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
