import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_MODEL = 'google/gemma-3-27b-it:free';

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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured on the server' }, { status: 500 });
    }

    const availablePlots = await loadPlots(req, plots);
    if (availablePlots.length === 0) {
      return NextResponse.json({ error: 'No investment plots available for AI consultation' }, { status: 503 });
    }

    const systemInstruction = `
      Ты — инвестиционный консультант Пискентского района Ташкентской области (Piskent Invest AI).
      Отвечай инвестору строго на выбранном языке: "${lang}".
      
      Используй только объекты из базы Piskent Invest AI ниже. Не придумывай новые объекты, названия, площади, инфраструктуру, ссылки или координаты.
      Если подходящих объектов меньше трёх, честно скажи, что по запросу найдено мало подходящих вариантов, и покажи только реальные найденные объекты.
      Если подходящих объектов нет, скажи: "По вашему запросу точных объектов не найдено. Могу показать ближайшие варианты."
      Если точного совпадения нет, предложи самые близкие реальные объекты из базы и объясни, что это ближайшие варианты.
      Если запрос случайный или не связан с инвестициями, вежливо попроси уточнить сферу: производство, текстиль, агро, логистика, гостиница или сервис.

      Формат ответа:
      1. Приветствие максимум 1 строка.
      2. Максимум 1–3 объекта из базы. Для каждого объекта укажи:
         - Название;
         - Площадь;
         - Инфраструктура;
         - Почему подходит;
         - Идея проекта.
      3. Ответ должен быть коротким и конкретным.
      4. Если рекомендуешь объекты, добавь в самый конец ответа один скрытый тег для первого/лучшего объекта: "[RECOMMEND_ID: id]".

      База объектов Piskent Invest AI: ${JSON.stringify(availablePlots)}
    `;

    const sanitizeOpenRouterDetails = (value: unknown) =>
      String(value || 'Unknown OpenRouter error')
        .replaceAll(apiKey, '[redacted]')
        .slice(0, 700);

    const finalPrompt = `${systemInstruction}\n\nИнвестор пишет: ${message}`;

    let response: Response;
    try {
      response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: [{ role: 'user', content: finalPrompt }],
          }),
        }
      );
    } catch (error: any) {
      const responseBody = error?.response?.text ? await error.response.text().catch(() => '') : error?.response?.body;
      const details = sanitizeOpenRouterDetails(error?.message || responseBody);

      console.error('OpenRouter request failed', {
        message: sanitizeOpenRouterDetails(error?.message),
        status: error?.status || error?.response?.status,
        responseBody: responseBody ? sanitizeOpenRouterDetails(responseBody) : null,
      });

      return NextResponse.json({ error: 'OpenRouter request failed', details }, { status: 502 });
    }

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      const details = sanitizeOpenRouterDetails(responseBody || `HTTP ${response.status}`);

      console.error('OpenRouter request failed', {
        message: `OpenRouter HTTP error ${response.status}`,
        status: response.status,
        responseBody: responseBody ? sanitizeOpenRouterDetails(responseBody) : null,
      });

      return NextResponse.json({ error: 'OpenRouter request failed', details }, { status: 502 });
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || '';

    if (!aiText) {
      return NextResponse.json({ error: 'Empty response from OpenRouter' }, { status: 502 });
    }

    return NextResponse.json({ text: aiText });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
