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

function formatInfrastructure(infrastructure: any) {
  if (!infrastructure || typeof infrastructure !== 'object') return 'Ma’lumot yo‘q';

  const items = Object.entries(infrastructure)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${key}: ${value}`);

  return items.length > 0 ? items.join(', ') : 'Ma’lumot yo‘q';
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
  const firstPlotId = plots[0]?.id;

  if (lang === 'ru') {
    const items = plots.map((plot, index) => [
      `${index + 1}. ${plot.name}`,
      `- Площадь: ${plot.area} га`,
      `- Инфраструктура: ${formatInfrastructure(plot.infrastructure)}`,
      '- Почему подходит: это один из ближайших реальных вариантов по вашему запросу.',
      `- Идея проекта: ${getIdea(plot, lang)}`,
    ].join('\n')).join('\n\n');

    return `Здравствуйте! По вашему запросу рекомендую следующие объекты:\n\n${items}\n\nОбъект можно посмотреть на карте.\n[RECOMMEND_ID:${firstPlotId}]`;
  }

  if (lang === 'en') {
    const items = plots.map((plot, index) => [
      `${index + 1}. ${plot.name}`,
      `- Area: ${plot.area} ha`,
      `- Infrastructure: ${formatInfrastructure(plot.infrastructure)}`,
      '- Why suitable: this is one of the closest real options for your request.',
      `- Project idea: ${getIdea(plot, lang)}`,
    ].join('\n')).join('\n\n');

    return `Hello! Based on your request, I recommend these properties:\n\n${items}\n\nYou can view the property on the map.\n[RECOMMEND_ID:${firstPlotId}]`;
  }

  if (lang === 'zh') {
    const items = plots.map((plot, index) => [
      `${index + 1}. ${plot.name}`,
      `- 面积：${plot.area} 公顷`,
      `- 基础设施：${formatInfrastructure(plot.infrastructure)}`,
      '- 适合原因：这是最接近您需求的真实地块之一。',
      `- 项目想法：${getIdea(plot, lang)}`,
    ].join('\n')).join('\n\n');

    return `您好！根据您的需求，我推荐以下地块：\n\n${items}\n\n您可以在地图上查看该地块。\n[RECOMMEND_ID:${firstPlotId}]`;
  }

  const items = plots.map((plot, index) => [
    `${index + 1}. ${plot.name}`,
    `- Maydoni: ${plot.area} ga`,
    `- Infratuzilma: ${formatInfrastructure(plot.infrastructure)}`,
    '- Nega mos keladi: so‘rovingizga eng yaqin real variantlardan biri.',
    `- Loyiha g‘oyasi: ${getIdea(plot, lang)}`,
  ].join('\n')).join('\n\n');

  return `Salom! Sizning so‘rovingiz bo‘yicha quyidagi obyektlarni tavsiya qilaman:\n\n${items}\n\nObyektni xaritada ko‘rishingiz mumkin.\n[RECOMMEND_ID:${firstPlotId}]`;
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
