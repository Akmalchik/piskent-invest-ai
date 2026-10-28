/** Temporary server/CLI-only smoke test. Never import into app/ or client code. */
import process from 'node:process';

const model = 'gemini-3.5-flash-lite';
const question = "O'zbekiston poytaxti qaysi shahar? O'zbek tilida, lotin yozuvida bir qisqa gap bilan javob bering.";

type GeminiResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
};

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error('FAIL: GEMINI_API_KEY is missing. Supply it through the server environment.');
    process.exitCode = 1;
    return;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: question }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 256 },
        }),
        signal: AbortSignal.timeout(30_000),
        redirect: 'error',
      },
    );
    if (!response.ok) {
      // Never log provider error bodies, headers, request objects or exceptions.
      const hint = response.status === 429 ? ' Check the project quota in AI Studio.'
        : response.status === 401 || response.status === 403 ? ' Check key permissions and API restrictions.'
        : response.status === 404 ? ' Check model availability for this project.' : '';
      console.error(`FAIL: Gemini HTTP ${response.status}.${hint}`);
      process.exitCode = 1;
      return;
    }
    const data = await response.json() as GeminiResponse;
    const candidate = data.candidates?.[0];
    const answer = candidate?.content?.parts
      ?.filter(part => !part.thought && typeof part.text === 'string')
      .map(part => part.text).join('').trim() ?? '';
    if (candidate?.finishReason !== 'STOP' || !answer) {
      console.error('FAIL: Gemini returned no complete text answer.');
      process.exitCode = 1;
      return;
    }
    // This is a basic content check, not a general Uzbek language detector.
    if (!/toshkent/i.test(answer) || !/poytaxt/i.test(answer)) {
      console.error('FAIL: Response did not pass the Uzbek capital-question content check.');
      process.exitCode = 1;
      return;
    }
    console.log(`PASS: ${model}; complete answer passed the Uzbek content check.`);
    console.log(`Answer: ${answer.replaceAll(apiKey, '[REDACTED]').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500)}`);
  } catch {
    console.error('FAIL: Gemini request failed (network, timeout or invalid response). Details suppressed to protect credentials.');
    process.exitCode = 1;
  }
}

await main();
