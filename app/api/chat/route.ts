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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured on the server' }, { status: 500 });
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
      Если точного совпадения нет, предложи самые близкие реальные объекты из базы и объясни, что это ближайшие варианты.
      Если запрос случайный или не связан с инвестициями, вежливо попроси уточнить сферу: производство, текстиль, агро, логистика, гостиница или сервис.

      Формат ответа:
      1. Короткое приветствие как инвестиционный консультант Пискентского района.
      2. Фраза: "По вашему запросу я нашёл подходящие объекты" — переведи её на язык "${lang}".
      3. Список из 1–3 объектов из базы. Для каждого объекта укажи:
         - Название;
         - Площадь;
         - Инфраструктура;
         - Почему подходит;
         - Идея проекта.
      4. Короткое заключение с предложением посмотреть объект на карте или уточнить требования.
      5. Если рекомендуешь объекты, добавь в самый конец ответа один скрытый тег для первого/лучшего объекта: "[RECOMMEND_ID: id]".

      База объектов Piskent Invest AI: ${JSON.stringify(availablePlots)}
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemInstruction + '\n\nИнвестор пишет: ' + message }] }],
          safetySettings: [
            { category: 'HARM_CATEGORY_HATRED', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: `Gemini error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!aiText) {
      return NextResponse.json({ error: 'Empty response from Gemini' }, { status: 502 });
    }

    return NextResponse.json({ text: aiText });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
