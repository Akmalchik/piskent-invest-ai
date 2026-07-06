import { NextRequest, NextResponse } from 'next/server';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

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

function pickRelevantPlots(plots: any[], message: string) {
  const words = message
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}"'`]+/)
    .filter(word => word.length >= 3);

  const compactPlots = plots.map(plot => ({
    id: plot.id,
    name: plot.name,
    area: plot.area,
    industry: plot.industry,
    status: plot.status,
    infrastructure: plot.infrastructure || {},
    auksionUrl: plot.auksionUrl || '',
  }));

  if (words.length === 0) {
    return compactPlots.slice(0, 5);
  }

  const scoredPlots = compactPlots
    .map(plot => {
      const searchableText = [
        plot.name,
        plot.area,
        plot.industry,
        plot.status,
        plot.auksionUrl,
        JSON.stringify(plot.infrastructure),
      ].join(' ').toLowerCase();

      const score = words.reduce((total, word) => total + (searchableText.includes(word) ? 1 : 0), 0);
      return { plot, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scoredPlots.length === 0) {
    return compactPlots.slice(0, 5);
  }

  return scoredPlots.slice(0, 5).map(item => item.plot);
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

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured on the server' }, { status: 500 });
    }

    const availablePlots = await loadPlots(req, plots);
    if (availablePlots.length === 0) {
      return NextResponse.json({ error: 'No investment plots available for AI consultation' }, { status: 503 });
    }
    const relevantPlots = pickRelevantPlots(availablePlots, message);

    const systemInstruction = `
      Ты — AI инвестиционный консультант Piskent Invest AI.
      Отвечай инвестору строго на выбранном языке: "${lang}". Запрещено смешивать языки. Все видимые фразы, заголовки и пояснения должны быть только на языке "${lang}".

      Работай ТОЛЬКО с объектами, которые переданы в availablePlots.
      availablePlots уже содержит ближайшие реальные объекты из базы. Если availablePlots не пустой, всегда покажи 1–3 объекта из availablePlots.

      Запрещено:
      - придумывать объекты;
      - придумывать площади;
      - придумывать инфраструктуру;
      - придумывать координаты;
      - придумывать ссылки.

      Если точного совпадения нет, не пиши "объектов нет", пока availablePlots не пустой. Скажи, что точного совпадения нет, и покажи 1–3 ближайших реальных объекта из availablePlots.
      Не делай выводы о данных, которых нет в объекте. Если поле отсутствует, кратко укажи, что данных нет.
      Ответ должен быть максимально коротким.

      Формат ответа:
      Приветствие (1 строка)

      1–3 объекта

      Для каждого:
      • Название
      • Площадь
      • Инфраструктура
      • Почему подходит
      • Идея проекта

      В конце:
      "При необходимости могу показать объект на карте."

      Если рекомендуешь объект — в самом конце обязательно добавь:
      [RECOMMEND_ID:id]
      где id — id первого рекомендуемого объекта.
      Тег [RECOMMEND_ID:id] обязателен всегда, когда availablePlots не пустой.
    `;

    const sanitizeGroqDetails = (value: unknown) =>
      String(value || 'Unknown Groq error')
        .replaceAll(apiKey, '[redacted]')
        .slice(0, 700);

    let response: Response;
    try {
      response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: JSON.stringify({ availablePlots: relevantPlots }) },
              { role: 'user', content: `Инвестор пишет: ${message}` },
            ],
            temperature: 0.1,
            top_p: 0.2,
            max_tokens: 700,
          }),
        }
      );
    } catch (error: any) {
      const responseBody = error?.response?.text ? await error.response.text().catch(() => '') : error?.response?.body;
      const details = sanitizeGroqDetails(error?.message || responseBody);

      console.error('Groq request failed', {
        message: sanitizeGroqDetails(error?.message),
        status: error?.status || error?.response?.status,
        responseBody: responseBody ? sanitizeGroqDetails(responseBody) : null,
      });

      return NextResponse.json({ error: 'Groq request failed', details }, { status: 502 });
    }

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      const details = sanitizeGroqDetails(responseBody || `HTTP ${response.status}`);

      console.error('Groq request failed', {
        message: `Groq HTTP error ${response.status}`,
        status: response.status,
        responseBody: responseBody ? sanitizeGroqDetails(responseBody) : null,
      });

      return NextResponse.json({ error: 'Groq request failed', details }, { status: 502 });
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || '';

    if (!aiText) {
      return NextResponse.json({ error: 'Empty response from Groq' }, { status: 502 });
    }

    return NextResponse.json({ text: aiText });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
