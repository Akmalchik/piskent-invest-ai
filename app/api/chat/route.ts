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
  const infraRequests = [
    { key: 'gas', matched: /gaz|газ/.test(normalizedMessage), fields: ['gas'] },
    { key: 'power', matched: /elektr|свет|электрич/.test(normalizedMessage), fields: ['power', 'electricity'] },
    { key: 'water', matched: /suv|вода|водоснаб/.test(normalizedMessage), fields: ['water'] },
    { key: 'road', matched: /yo['’`]?l|дорога|asfalt|асфальт/.test(normalizedMessage), fields: ['road'] },
  ];

  const compactPlots = availablePlots.map(toCompactPlot);
  const normalPlots = compactPlots.filter(plot => !isTestPlot(plot));
  const candidatePlots = normalPlots.length > 0 ? normalPlots : compactPlots;
  const areaFilteredPlots = requestedArea === null
    ? candidatePlots
    : candidatePlots.filter(plot => {
      const area = Number(plot.area);
      return Number.isFinite(area) && area >= requestedArea * 0.5;
    });

  if (areaFilteredPlots.length === 0) {
    return [];
  }

  const scoredPlots = areaFilteredPlots
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
      }

      if (wantsProduction && /production|sanoat|производ|industrial|factory|zavod/.test(`${industryText} ${nameText}`)) score += 2;
      if (wantsHotel && /hotel|mehmonxona|гостиниц|service|servis|tourism|туризм/.test(`${industryText} ${nameText}`)) score += 2;
      if (wantsLogistics && /logistics|logistika|склад|warehouse|road|yo'l|йул|дорог/.test(`${industryText} ${nameText} ${statusText} ${infrastructureText}`)) score += 2;

      for (const request of infraRequests) {
        if (!request.matched) continue;

        const hasInfrastructure = request.fields.some(field => {
          const value = infrastructure[field];
          return value !== undefined && value !== null && String(value).trim() !== '';
        });

        if (hasInfrastructure || request.fields.some(field => infrastructureText.includes(field))) {
          score += 1;
        }
      }

      return { plot, score };
    })
    .sort((a, b) => b.score - a.score);

  const positiveMatches = scoredPlots.filter(item => item.score > 0);
  const selected = positiveMatches.length > 0 ? positiveMatches : scoredPlots;

  return selected.slice(0, 3).map(item => item.plot);
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
    return 'Извините, я консультирую только по инвестиционным объектам Пискентского района. Укажите площадь, инфраструктуру или направление бизнеса.';
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
    return 'По вашему запросу точный объект не найден. Но вы можете посмотреть другие доступные объекты на карте.';
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

function buildTemplateResponse(plots: any[], lang: string) {
  const recommendationMarkers = plots
    .filter(plot => plot.id !== undefined && plot.id !== null)
    .map(plot => `[RECOMMEND_ID:${plot.id}]`)
    .join('\n');
  const divider = '━━━━━━━━━━━━━━━━━━━━━━';

  if (lang === 'ru') {
    const items = plots.map((plot, index) => [
      `${index + 1}.`,
      '',
      `Наименование: ${plot.name}`,
      `Площадь: ${plot.area} га`,
      formatOwnershipType(plot.ownership_type, lang) ? `Тип объекта: ${formatOwnershipType(plot.ownership_type, lang)}` : '',
      `Инфраструктура:\n${formatInfrastructure(plot.infrastructure, lang)}`,
      `Рекомендуемый проект: ${getIdea(plot, lang)}`,
      'Почему рекомендуется: объект является одним из наиболее близких вариантов по указанным параметрам.',
    ].filter(Boolean).join('\n')).join(`\n\n${divider}\n\n`);

    return `${divider}\n\nРЕКОМЕНДУЕМЫЕ ОБЪЕКТЫ\n\n${divider}\n\n${items}\n\n${divider}\n\nДля получения дополнительной информации вы можете обратиться в отдел инвестиций, промышленности и торговли.\n\nПримечание: Рекомендации сформированы автоматически на основании имеющихся данных. Окончательное решение рекомендуется принимать после дополнительного изучения объекта и консультации с ответственным отделом.\n${recommendationMarkers}`;
  }

  if (lang === 'en') {
    const items = plots.map((plot, index) => [
      `${index + 1}.`,
      '',
      `Name: ${plot.name}`,
      `Area: ${plot.area} ha`,
      formatOwnershipType(plot.ownership_type, lang) ? `Property type: ${formatOwnershipType(plot.ownership_type, lang)}` : '',
      `Infrastructure:\n${formatInfrastructure(plot.infrastructure, lang)}`,
      `Recommended project: ${getIdea(plot, lang)}`,
      'Why recommended: the property is one of the closest available options based on the specified parameters.',
    ].filter(Boolean).join('\n')).join(`\n\n${divider}\n\n`);

    return `${divider}\n\nRECOMMENDED PROPERTIES\n\n${divider}\n\n${items}\n\n${divider}\n\nFor additional information, you may contact the Department of Investments, Industry and Trade.\n\nThe recommendations are generated automatically based on available data. Final investment decisions should be made after additional verification and consultation with the responsible department.\n${recommendationMarkers}`;
  }

  if (lang === 'zh') {
    const items = plots.map((plot, index) => [
      `${index + 1}.`,
      '',
      `名称：${plot.name}`,
      `面积：${plot.area} 公顷`,
      formatOwnershipType(plot.ownership_type, lang) ? `对象类型：${formatOwnershipType(plot.ownership_type, lang)}` : '',
      `基础设施：\n${formatInfrastructure(plot.infrastructure, lang)}`,
      `建议项目：${getIdea(plot, lang)}`,
      '推荐理由：该项目是根据指定参数筛选出的较为匹配的可用选项之一。',
    ].filter(Boolean).join('\n')).join(`\n\n${divider}\n\n`);

    return `${divider}\n\n推荐项目\n\n${divider}\n\n${items}\n\n${divider}\n\n如需更多信息，您可以联系投资、工业和贸易部门。\n\n说明：建议根据现有数据自动生成。最终投资决定建议在进一步核实并咨询相关部门后作出。\n${recommendationMarkers}`;
  }

  const items = plots.map((plot, index) => [
    `${index + 1}.`,
    '',
    `Nomi: ${plot.name}`,
    `Maydoni: ${plot.area} ga`,
    formatOwnershipType(plot.ownership_type, lang) ? `Obyekt turi: ${formatOwnershipType(plot.ownership_type, lang)}` : '',
    `Infratuzilma:\n${formatInfrastructure(plot.infrastructure, lang)}`,
    `Tavsiya etilgan loyiha: ${getIdea(plot, lang)}`,
    'Nega tavsiya etiladi: obyekt kiritilgan parametrlar bo‘yicha eng yaqin mavjud variantlardan biri hisoblanadi.',
  ].filter(Boolean).join('\n')).join(`\n\n${divider}\n\n`);

  return `${divider}\n\nAI INVESTITSIYA MASLAHATCHISI TAVSIYASI\n\n${divider}\n\n${items}\n\n${divider}\n\nQo‘shimcha ma'lumot olish uchun Investitsiyalar, sanoat va savdo bo‘limiga murojaat qilishingiz mumkin.\n\nEslatma: Mazkur tavsiyalar taqdim etilgan ma'lumotlar asosida avtomatik shakllantirilgan. Yakuniy qaror qo‘shimcha o‘rganish va mas'ul bo‘lim bilan maslahatlashuvdan so‘ng qabul qilinishi tavsiya etiladi.\n${recommendationMarkers}`;
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
    const relevantPlots = selectRelevantPlots(message, availablePlots);
    if (relevantPlots.length === 0) {
      return NextResponse.json({ text: getNoMatchingPlotsResponse(lang) });
    }

    return NextResponse.json({ text: buildTemplateResponse(relevantPlots, lang) });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
