import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { NextRequest } from 'next/server.js';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../app/api/chat/route.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const row = { id: 1, name: '1-bino', property_type: 'building', area: 2, building_area_m2: 120,
  industry: 'Production', status: 'Mavjud', ownership_type: 'Public listing', infrastructure: { gas: 'Mavjud', power: 'Mavjud', water: 'Mavjud', road: 'Asfalt' },
  private_note: 'PRIVATE_FIELD_SENTINEL', polygonCoordinates: [[40, 69]], auksionUrl: 'https://example.invalid/PRIVATE_LINK_SENTINEL' };
const valid = { answer: '**1-bino** — MODEL_TEXT_MUST_NOT_BE_TRUSTED', recommendedIds: ['1'] };
const gemini = (result = valid, reason = 'STOP') => Response.json({ candidates: [{ finishReason: reason, content: { parts: [{ text: JSON.stringify(result) }] } }] });
const groq = () => Response.json({ choices: [{ message: { content: JSON.stringify(valid) } }] });

function fixture({ keys = true, rows = [row], dbError = null, fetcher = () => gemini() } = {}) {
  const calls = [], logs = [];
  let reads = 0;
  const query = {
    select(fields) {
      assert.equal(fields, 'id,name,property_type,area,building_area_m2,industry,status,ownership_type,infrastructure');
      return this;
    },
    order() { return this; },
    async abortSignal() { reads++; return { data: rows, error: dbError }; },
  };
  const loadedModule = { exports: {} };
  runInNewContext(code, {
    module: loadedModule, exports: loadedModule.exports,
    require: name => name === '@/lib/supabase'
      ? { getSupabaseClient: () => ({ from: table => { assert.equal(table, 'piskent_plots'); return query; } }) }
      : require(name),
    process: { env: keys === true ? { GEMINI_API_KEY: 'fixture-gemini-secret', GROQ_API_KEY: 'fixture-groq-secret' } : keys || {} },
    AbortSignal,
    console: Object.fromEntries(['info', 'warn', 'error'].map(level => [level, (...args) => logs.push(JSON.stringify(args))])),
    fetch: async (url, options) => { calls.push({ url, options }); return fetcher(url, options); },
  });
  return { calls, logs, reads: () => reads,
    post: (body = { message: 'Sanoat uchun obyekt kerak', lang: 'uz' }) => loadedModule.exports.POST(new NextRequest('https://example.invalid/api/chat', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })),
  };
}

test('Gemini is primary, Groq is not called; only approved data and grounded facts are used', async () => {
  const f = fixture();
  const response = await f.post();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-ai-provider'), 'gemini');
  assert.equal(f.calls.length, 1);
  const { url, options } = f.calls[0];
  assert.match(url, /models\/gemini-3\.5-flash-lite:generateContent$/);
  assert.equal(new URL(url).search, '');
  assert.equal(options.headers['x-goog-api-key'], 'fixture-gemini-secret');
  for (const excluded of ['PRIVATE_FIELD_SENTINEL', 'PRIVATE_LINK_SENTINEL', 'polygonCoordinates', 'auksionUrl', 'fixture-groq-secret']) assert.ok(!options.body.includes(excluded));
  const data = await response.json();
  assert.deepEqual(data.recommendedIds, ['1']);
  assert.match(data.answer, /1-bino/);
  assert.match(data.answer, /120/);
  assert.ok(!data.answer.includes('MODEL_TEXT_MUST_NOT_BE_TRUSTED'));
  assert.ok(!JSON.stringify(data).includes('fixture-gemini-secret'));
});

test('Gemini HTTP failure invokes Groq fallback', async () => {
  const f = fixture({ fetcher: url => url.includes('googleapis.com') ? new Response('secret error body', {status: 429}) : groq() });
  assert.equal((await f.post()).headers.get('x-ai-provider'), 'groq');
  assert.equal(f.calls.length, 2);
  assert.ok(!f.logs.join('').includes('secret error body'));
});

test('missing Gemini key skips Google and uses configured Groq', async () => {
  const f = fixture({ keys: { GROQ_API_KEY: 'fixture-groq-secret' }, fetcher: () => groq() });
  assert.equal((await f.post()).headers.get('x-ai-provider'), 'groq');
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0].url, /api.groq.com/);
});

test('both keys absent returns local database facts without external requests or secret output', async () => {
  const f = fixture({ keys: false });
  const response = await f.post();
  assert.equal(response.headers.get('x-ai-provider'), 'local');
  assert.equal(f.calls.length, 0);
  assert.match((await response.json()).answer, /1-bino/);
  assert.equal(f.logs.length, 0);
});

for (const [label, reply] of [
  ['unknown recommended ID', () => gemini({ answer: '1-bino', recommendedIds: ['unapproved'] })],
  ['truncated response', () => gemini(valid, 'MAX_TOKENS')],
  ['malformed JSON', () => Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: 'invalid json'}]}}]})],
  ['network exception', () => { throw new Error('fixture-gemini-secret'); }],
]) test(`${label} uses Groq and does not log credentials`, async () => {
  const f = fixture({ fetcher: url => url.includes('googleapis.com') ? reply() : groq() });
  assert.equal((await f.post()).headers.get('x-ai-provider'), 'groq');
  assert.ok(!f.logs.join('').includes('fixture-gemini-secret'));
});

test('all providers unavailable falls back to database facts', async () => {
  const f = fixture({fetcher: () => new Response('', {status: 503})});
  const response = await f.post();
  assert.equal(response.headers.get('x-ai-provider'), 'local');
  assert.match((await response.json()).answer, /1-bino/);
  assert.equal(f.calls.length, 3);
});

test('Supabase unavailable or empty never sends model requests or reads a JSON seed', async () => {
  for (const config of [{dbError: new Error('SUPABASE_SECRET_SENTINEL')}, {rows: []}]) {
    const f = fixture(config), response = await f.post();
    assert.equal(response.status, 200);
    assert.equal(f.calls.length, 0);
    assert.ok(!JSON.stringify(await response.json()).includes('SUPABASE_SECRET_SENTINEL'));
  }
});

test('invalid input, maximum length and existing rate limit are preserved', async () => {
  const f = fixture({keys: false});
  assert.equal((await f.post({message: 123})).status, 400);
  assert.equal((await f.post({message: 'x'.repeat(801)})).status, 400);
  for (let i=0; i<8; i++) assert.equal((await f.post({message: 'salom'})).status, 200);
  const limited = await f.post();
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal(f.reads(), 0);
});
