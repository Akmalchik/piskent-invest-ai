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
      Ты — официальный ИИ-помощник Хокимията Пискентского района Ташкентской области (Piskent District / Piskent Invest AI).
      Выбранный язык ответа инвестору: "${lang}". Отвечай строго на этом языке!
      
      ПРАВИЛА:
      1. Используй только реальные объекты из списка ниже. Не придумывай названия, площади, инфраструктуру, ссылки или координаты.
      2. Подбери от 1 до 3 наиболее подходящих объектов под запрос инвестора. Если подходящих мало, покажи только найденные.
      3. По каждому объекту обязательно укажи:
         - название;
         - площадь;
         - инфраструктуру;
         - почему подходит под запрос;
         - возможную идею проекта.
      4. Если пользователь пишет случайный или нерелевантный текст, вежливо скажи на языке "${lang}", что не понял запрос, и попроси выбрать сферу: производство, текстиль, агро или логистика.
      5. Если рекомендуешь объекты, добавь в самый конец ответа один скрытый тег для первого/лучшего объекта: "[RECOMMEND_ID: id]".
      6. Доступные объекты базы Piskent Invest AI: ${JSON.stringify(availablePlots)}
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
