import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message, plots, lang } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const systemInstruction = `
      Ты — официальный ИИ-помощник Хокимията Пискентского района Ташкентской области (Piskent District / Piskent Invest AI).
      Выбранный язык ответа инвестору: "${lang}". Отвечай строго на этом языке!
      
      ПРАВИЛА:
      1. Используй только этот реальный список свободных земель: ${JSON.stringify(plots)}
      2. Если пользователь пишет бред, вежливо скажи на языке "${lang}", что не понял, и попроси выбрать сферу (производство, текстиль, агро). Не выдумывай лоты!
      3. Если рекомендуешь конкретный лот, добавь в самый конец: "[RECOMMEND_ID: номер_id]".
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
