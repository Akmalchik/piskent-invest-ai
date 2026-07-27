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
      property_type: plot.property_type || plot.propertyType || 'land',
      building_area_m2: plot.building_area_m2 ?? plot.buildingAreaM2 ?? null,
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
    property_type: plot.property_type || 'land',
    building_area_m2: plot.building_area_m2 ?? null,
    ownership_type: plot.ownership_type || '',
    infrastructure: plot.infrastructure || {},
    image: plot.image || '',
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

function hasAvailableInfrastructure(plot: any, fields: string[]) {
  return fields.some(field => {
    const value = String(plot.infrastructure?.[field] || '').trim().toLowerCase();
    return value !== '' && !/mavjud emas|yo['’`]?q|нет|not available|unavailable|不可用/.test(value);
  });
}

function getPresentationScore(plot: any, intent: string) {
  const propertyType = String(plot.property_type || '').toLowerCase();
  const name = String(plot.name || '').trim();
  const isEmptyLand = /bo['‘’`]?sh yer|пуст(?:ая|ой) зем|empty land/.test(name.toLowerCase());
  let score = 0;

  if (plot.image) score += 3;
  if (Number(plot.building_area_m2) > 0) score += 3;
  if (propertyType === 'building' || propertyType === 'land_building') score += 3;
  if (name && !/^(obyekt|объект|property)\s*\d*$/i.test(name)) score += 2;
  if (plot.auksionUrl) score += 1;
  score += ['gas', 'power', 'electricity', 'water', 'road']
    .filter(field => hasAvailableInfrastructure(plot, [field])).length * 0.75;
  score += [plot.area, plot.industry, plot.status, plot.ownership_type]
    .filter(value => value !== undefined && value !== null && String(value).trim() !== '').length * 0.25;

  if (isEmptyLand && ['general', 'tourism', 'smallBusiness'].includes(intent)) score -= 6;
  return score;
}

function selectRelevantPlots(message: string, availablePlots: any[]) {
  const normalizedMessage = message.toLowerCase();
  const requestedArea = parseAreaRequest(message);
  const wantsProduction = /sanoat|ishlab chiqarish|производств|factory|zavod|завод|цех|industry/.test(normalizedMessage);
  const wantsTourism = /turizm|tourism|туризм|hotel|mehmonxona|гостиниц|отел/.test(normalizedMessage);
  const wantsLogistics = /logistika|logistics|sklad|склад|warehouse|ombor|логист/.test(normalizedMessage);
  const wantsAgro = /agro|ферм|qishloq xo['‘’`]?jaligi|qishloq|dehqon|farm|сельск/.test(normalizedMessage);
  const wantsService = /servis|service|сервис|услуг|xizmat|кафе|ресторан|umumiy ovqatlanish|торгов|savdo|учебн|training center/.test(normalizedMessage);
  const wantsSmallBusiness = /kichik biznes|мал(?:ого|ый) бизнес|small business/.test(normalizedMessage);
  const wantsBuilding = /bino|здани|building/.test(normalizedMessage);
  const wantsLand = /yer|земл|land|участ/.test(normalizedMessage);
  const wantsLargest = /eng katta|сам(?:ые|ый) крупн|largest|biggest/.test(normalizedMessage);
  const isBusinessTask = wantsProduction || wantsTourism || wantsLogistics || wantsAgro || wantsService || wantsSmallBusiness;
  const intent = wantsProduction ? 'production'
    : wantsTourism ? 'tourism'
      : wantsLogistics ? 'logistics'
        : wantsAgro ? 'agro'
          : wantsService ? 'service'
            : wantsSmallBusiness ? 'smallBusiness'
              : 'general';
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
      const plotText = `${industryText} ${nameText} ${statusText}`;
      const hasBuilding = ['building', 'land_building'].includes(String(plot.property_type || ''))
        || Number(plot.building_area_m2) > 0
        || /building|bino|здани|помещ|цех/.test(plotText);
      const hasLand = /land|yer|земл|участ/.test(plotText);
      const categoryMatch =
        (wantsProduction && /production|sanoat|ishlab chiqarish|производ|industrial|factory|zavod|завод|цех/.test(plotText))
        || (wantsTourism && /tourism|turizm|туризм|hotel|mehmonxona|гостиниц|отел/.test(plotText))
        || (wantsLogistics && /logistics|logistika|склад|warehouse|ombor|логист/.test(plotText))
        || (wantsAgro && /agro|qishloq|dehqon|farm|ферм|сельск/.test(plotText))
        || (wantsService && /service|servis|сервис|услуг|xizmat|кафе|ресторан|торгов|savdo|учебн|training/.test(plotText))
        || (wantsSmallBusiness && /service|servis|сервис|услуг|торгов|savdo|building|bino|здани/.test(plotText));

      if (requestedArea !== null && Number.isFinite(area)) {
        if (Math.abs(area - requestedArea) <= Math.max(1, requestedArea * 0.25)) score += 3;
        if (area >= requestedArea) score += 2;
        if (area < requestedArea * 0.5) score -= 2;
      }

      if (categoryMatch) score += 8;
      if (wantsTourism && (hasBuilding || hasLand || hasAvailableInfrastructure(plot, ['road']))) score += 2;
      if (wantsProduction && (hasBuilding || hasAvailableInfrastructure(plot, ['power', 'electricity', 'road']))) score += 2;
      if (wantsLogistics && (hasBuilding || hasAvailableInfrastructure(plot, ['road']))) score += 2;
      if (wantsAgro && (hasLand || hasAvailableInfrastructure(plot, ['water', 'road']))) score += 2;
      if ((wantsService || wantsSmallBusiness) && (hasBuilding || hasAvailableInfrastructure(plot, ['road']))) score += 2;
      if (wantsBuilding && hasBuilding) score += 2;
      if (wantsLand && hasLand) score += 1;

      for (const request of infraRequests) {
        if (!request.matched) continue;

        const hasInfrastructure = hasAvailableInfrastructure(plot, request.fields);

        score += hasInfrastructure ? 2 : -1;
      }

      score += getPresentationScore(plot, intent);
      return { plot, score, categoryMatch };
    })
    .sort((a, b) => wantsLargest
      ? (Number(b.plot.area) || 0) - (Number(a.plot.area) || 0)
      : b.score - a.score || (Number(b.plot.area) || 0) - (Number(a.plot.area) || 0));

  const positiveMatches = scoredPlots.filter(item => item.score > 0);
  const hasExactMatch = wantsLargest || (isBusinessTask
    ? scoredPlots.some(item => item.categoryMatch)
    : positiveMatches.length > 0);
  const selected = hasExactMatch
    ? (wantsLargest || isBusinessTask ? scoredPlots : positiveMatches)
    : scoredPlots;
  const limit = 3;

  return {
    plots: selected.slice(0, limit).map(item => item.plot),
    hasExactMatch,
    intent,
  };
}

function isRelevantInvestmentQuestion(message: string) {
  const normalizedMessage = message.toLowerCase();
  const investmentKeywords =
    /piskent|пскент|пискент|皮斯肯特|invest|инвест|投资|joy kerak|yaxshi (?:joy|obyekt)|qaysi obyekt|obyekt|объект|property|地块|yer|земл|land|土地|lot|лот|uchast|участ|maydon|площад|area|面积|gektar|гектар|公顷|infratuzilma|инфраструктур|infrastructure|基础设施|gaz|газ|天然气|elektr|электр|свет|电力|suv|вода|水|yo['’`]?l|дорога|asfalt|道路|auksion|auction|аукцион|e-auksion|business|biznes|бизнес|业务|sanoat|ishlab chiqarish|производ|factory|zavod|завод|цех|industry|工业|turizm|tourism|туризм|hotel|mehmonxona|гостиниц|酒店|servis|service|сервис|xizmat|кафе|ресторан|umumiy ovqatlanish|logistika|logistics|sklad|склад|warehouse|ombor|物流|agro|агро|ферм|qishloq xo['‘’`]?jaligi|农业|kichik biznes|мал(?:ого|ый) бизнес|small business|торгов|savdo|учебн|training center|textile|текстил|纺织|contact|контакт|aloqa|связ|联系/.test(normalizedMessage);

  return investmentKeywords;
}

function isCreativeOrRestrictedRequest(message: string) {
  return /стих|поэм|рассказ|истори[юя]|анекдот|шутк|roleplay|ролевая|эссе|политик|she['’`]?r|hikoya|latifa|hazil|ertak|write a poem|tell (?:me )?a (?:story|joke)/i.test(message);
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
    return 'I can help with investment properties in Piskent district by matching activity type, area, and infrastructure.';
  }

  if (lang === 'zh') {
    return '抱歉，我只能就皮斯肯特区的投资地块提供咨询。请询问土地面积、基础设施或业务方向。';
  }

  return 'Men Piskent tumanidagi investitsiya obyektlari bo‘yicha yordam bera olaman: faoliyat turi, maydon va infratuzilma asosida obyekt tanlayman.';
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

function getPropertyTypeLabel(plot: any, lang: string) {
  const type = String(plot.property_type || 'land');
  const labels: Record<string, Record<string, string>> = {
    uz: { land: 'yer maydoni', building: 'tayyor bino', land_building: 'bino va yer maydoni' },
    ru: { land: 'земельный участок', building: 'готовое здание', land_building: 'здание с участком' },
    en: { land: 'land plot', building: 'existing building', land_building: 'building with land' },
    zh: { land: '土地', building: '现有建筑', land_building: '建筑及土地' },
  };
  return labels[lang]?.[type] || labels.uz[type] || type;
}

function getShortInfrastructure(plot: any, lang: string) {
  const available = [
    { fields: ['gas'], uz: 'gaz', ru: 'газ', en: 'gas', zh: '天然气' },
    { fields: ['power', 'electricity'], uz: 'elektr', ru: 'электричество', en: 'electricity', zh: '电力' },
    { fields: ['water'], uz: 'suv', ru: 'вода', en: 'water', zh: '供水' },
    { fields: ['road'], uz: 'yo‘l', ru: 'дорога', en: 'road', zh: '道路' },
  ].filter(item => hasAvailableInfrastructure(plot, item.fields));

  if (available.length === 0) {
    return { uz: 'infratuzilma aniqlashtiriladi', ru: 'инфраструктура уточняется', en: 'infrastructure requires clarification', zh: '基础设施待确认' }[lang] || 'infratuzilma aniqlashtiriladi';
  }
  return available.map(item => (item as any)[lang] || item.uz).join(', ');
}

function getRecommendationReason(plot: any, intent: string, lang: string) {
  const hasBuilding = ['building', 'land_building'].includes(String(plot.property_type || ''))
    || Number(plot.building_area_m2) > 0;
  const hasRoad = hasAvailableInfrastructure(plot, ['road']);
  const hasPower = hasAvailableInfrastructure(plot, ['power', 'electricity']);
  const hasWater = hasAvailableInfrastructure(plot, ['water']);

  const reasons: Record<string, Record<string, string>> = {
    uz: {
      building: 'Tayyor bino va to‘ldirilgan ma’lumotlari bilan amaliy variant.',
      production: hasPower ? 'Bino yoki maydon bilan birga elektr ta’minoti ko‘rsatilgan.' : 'Ishlab chiqarish uchun bino yoki yetarli maydon mavjud.',
      tourism: hasRoad ? 'Bino yoki yer maydoni va kirish yo‘li mavjud.' : 'Bino yoki yer maydoni bor, joylashuv salohiyatini alohida baholash mumkin.',
      logistics: hasRoad ? 'Ombor yoki logistika uchun yo‘l va maydon jihatidan mos.' : 'Maydoni logistika ssenariysi uchun ko‘rib chiqishga arziydi.',
      agro: hasWater ? 'Yer maydoni va suv ta’minoti agro loyiha uchun foydali.' : 'Yer maydoni agro loyiha uchun ko‘rib chiqishga mos.',
      service: 'Bino yoki infratuzilma servis loyihasi uchun amaliy asos beradi.',
      general: 'Obyekt kartasi nisbatan to‘liq va amaliy foydalanish imkoniyati bor.',
    },
    ru: {
      building: 'Практичный вариант с готовым зданием и достаточно полной карточкой.',
      production: hasPower ? 'Указано здание или участок вместе с электроснабжением.' : 'Есть здание или достаточная площадь для производственного сценария.',
      tourism: hasRoad ? 'Есть здание или участок и указана дорожная доступность.' : 'Есть здание или участок; потенциал локации следует оценить отдельно.',
      logistics: hasRoad ? 'Дорога и площадь подходят для рассмотрения складского сценария.' : 'Площадь позволяет рассмотреть логистический сценарий.',
      agro: hasWater ? 'Земля и указанное водоснабжение полезны для агропроекта.' : 'Земельную площадь можно рассмотреть для агропроекта.',
      service: 'Здание или инфраструктура дают практическую основу для сервисного проекта.',
      general: 'Карточка объекта достаточно полная и подходит для практического рассмотрения.',
    },
  };
  const activeLang = lang === 'ru' ? 'ru' : 'uz';
  if (intent === 'general' && hasBuilding) return reasons[activeLang].building;
  return reasons[activeLang][intent] || reasons[activeLang].general;
}

function buildTemplateResponse(plots: any[], lang: string, intent: string, _hasExactMatch: boolean) {
  const recommendationMarkers = plots
    .filter(plot => plot.id !== undefined && plot.id !== null)
    .map(plot => `[RECOMMEND_ID:${plot.id}]`)
    .join('\n');
  const [best, alternative] = plots;
  const isRu = lang === 'ru';
  const question = isRu
    ? 'Уточнение: вам нужен земельный участок или готовое здание?'
    : 'Aniqlashtirish: Sizga yer maydoni kerakmi yoki tayyor bino?';
  const lines = [
    `${isRu ? 'Лучший вариант' : 'Eng yaxshi variant'}: ${best.name}`,
    `${isRu ? 'Причина' : 'Sabab'}: ${getRecommendationReason(best, intent, lang)}`,
    alternative ? `${isRu ? 'Альтернатива' : 'Muqobil variant'}: ${alternative.name}` : '',
    alternative ? `${isRu ? 'Причина' : 'Sabab'}: ${getRecommendationReason(alternative, intent, lang)}` : '',
    question,
    recommendationMarkers,
  ];
  return lines.filter(Boolean).join('\n');
}

function isCompareRequest(message: string) {
  return /solishtir|taqqosla|сравни|сравнить|compare|qaysi (?:yaxshi|ma['’`]?qul)|какой лучше/i.test(message);
}

function findPlotsForComparison(message: string, plots: any[]) {
  const normalizedMessage = message.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return plots
    .filter(plot => !isTestPlot(plot))
    .map(plot => {
      const tokens = String(plot.name || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
      const matchedTokens = tokens.filter(token => normalizedMessage.split(' ').includes(token));
      return { plot, score: matchedTokens.length, exact: tokens.length > 0 && matchedTokens.length === tokens.length };
    })
    .filter(item => item.exact || item.score >= 2 || (item.score === 1 && String(item.plot.name || '').length >= 4))
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score || getPresentationScore(b.plot, 'general') - getPresentationScore(a.plot, 'general'))
    .slice(0, 2)
    .map(item => item.plot);
}

function buildComparisonResponse(plots: any[], lang: string) {
  const isRu = lang === 'ru';
  const formatArea = (value: unknown, unit: string) => value !== undefined && value !== null && value !== ''
    ? `${value} ${unit}`
    : (isRu ? 'уточняется' : 'aniqlashtiriladi');
  const lines = plots.map(plot => {
    const land = formatArea(plot.area, isRu ? 'га' : 'ga');
    const building = formatArea(plot.building_area_m2, 'm²');
    return `${plot.name} — ${isRu ? 'земля' : 'yer'}: ${land}; ${isRu ? 'здание' : 'bino'}: ${building}; ${getPropertyTypeLabel(plot, isRu ? 'ru' : 'uz')}; ${isRu ? 'инфраструктура' : 'infratuzilma'}: ${getShortInfrastructure(plot, isRu ? 'ru' : 'uz')}.`;
  });
  const [first, second] = plots;
  const firstBuilding = Number(first.building_area_m2) || 0;
  const secondBuilding = Number(second.building_area_m2) || 0;
  const firstLand = Number(first.area) || 0;
  const secondLand = Number(second.area) || 0;
  const buildingChoice = firstBuilding >= secondBuilding ? first : second;
  const landChoice = firstLand >= secondLand ? first : second;
  const conclusion = firstBuilding > 0 || secondBuilding > 0
    ? (isRu
      ? `Вывод: если важнее готовая площадь здания — ${buildingChoice.name}; если нужен больший земельный участок — ${landChoice.name}.`
      : `Xulosa: agar tayyor bino maydoni muhim bo‘lsa — ${buildingChoice.name}; kattaroq yer kerak bo‘lsa — ${landChoice.name}.`)
    : (isRu
      ? `Вывод: площадь зданий требует уточнения; если приоритетен больший земельный участок — ${landChoice.name}.`
      : `Xulosa: bino maydoni aniqlashtirilishi kerak; kattaroq yer ustuvor bo‘lsa — ${landChoice.name}.`);
  const markers = plots.map(plot => `[RECOMMEND_ID:${plot.id}]`).join('\n');
  return [...lines, conclusion, markers].join('\n');
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

    if (isCreativeOrRestrictedRequest(message) || !isRelevantInvestmentQuestion(message)) {
      return NextResponse.json({ text: getOffTopicResponse(lang) });
    }

    const availablePlots = await loadPlots(req, plots);
    if (availablePlots.length === 0) {
      return NextResponse.json({ error: 'No investment plots available for AI consultation' }, { status: 503 });
    }
    if (isCompareRequest(message)) {
      const comparedPlots = findPlotsForComparison(message, availablePlots);
      if (comparedPlots.length === 2) {
        return NextResponse.json({ text: buildComparisonResponse(comparedPlots, lang) });
      }
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
