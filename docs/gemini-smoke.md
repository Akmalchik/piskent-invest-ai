# Gemini chat integration and smoke test

The existing `/api/chat` handler uses `gemini-3.5-flash-lite` first. It reads
`process.env.GEMINI_API_KEY` on the server only. Groq (`llama-3.3-70b-versatile`)
is called only if Gemini is unconfigured, unavailable, or returns an invalid result.
If both providers fail, the server returns facts from the approved database rows.
No public test route or new page is created.

## Approved data boundary

The chat uses the anonymous Supabase read client, subject to RLS, and selects only
id, name, property_type, area, building_area_m2, industry, status, ownership_type,
and infrastructure from piskent_plots. Only the gas, power, water and road states
are included from infrastructure. No coordinates, links, private notes, credentials,
service-role keys or arbitrary database columns are passed to either model.
The user question and those public fields were explicitly approved for Gemini.

Provider IDs are validated against the retrieved candidates. Model-written prose is
not displayed as factual data: the server renders facts from the selected records
and explicitly identifies missing information. Existing response fields, object IDs,
markers, language selection, input validation and request limits are retained.
The frontend obtains map coordinates from its existing catalogue request.
Database failure or an empty table never triggers seed writes or a JSON fallback
inside the chat. Existing catalogue and admin behaviour is retained.

Google lists a free tier for this model, subject to project eligibility and quotas.
Choosing this model does not force a billing-enabled project onto a free tier.
Free-tier content may be used by Google to improve its products.

- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/api/generate-content

## Local verification without real credentials

```sh
node --test scripts/chat-provider.test.mjs
npx tsc --noEmit
npm run lint
npm run build
npm audit
```

The tests execute the actual route handler with mocked Supabase and provider
responses, testing primary/fallback selection, approved fields, secret suppression,
invalid IDs, truncation, network errors, input validation and rate limiting.
They do not establish real Gemini account access or Production connectivity.

## Optional direct Gemini smoke test

Use Node.js 22.18+ or 24 and a private process environment:

```sh
node scripts/gemini-smoke.mts
```

The CLI script sends one fixed non-sensitive Uzbek question, checks HTTP success,
finishReason STOP, and the words Toshkent and poytaxt, and prints a short sanitized
answer for human review. Missing credentials, HTTP errors and invalid responses
exit with code 1. No local env file is needed or created. Never put a real key in
source code, command arguments, chat, logs, or a NEXT_PUBLIC_ variable.

## Production verification after the automatic Git deployment

Confirm that Vercel's Ready Production deployment matches the pushed commit SHA.
A newly added Production variable takes effect in the new deployment.
Open the existing AI chat and send `Sanoat uchun obyekt tavsiya qiling`.
In browser Network tools, inspect the existing POST /api/chat response:

- HTTP 200 with `X-AI-Provider: gemini` confirms that Gemini returned a validated result.
- `X-AI-Provider: groq` means the reserve provider was used.
- `X-AI-Provider: local` means no provider result was used; greetings and price
  clarifications intentionally use local responses too.

Vercel runtime logs emit only provider name/model/status or a fixed failure reason.
For an actual Gemini HTTP status, inspect the `chat_provider` or
`chat_provider_fallback` metadata; never enable raw request/response logging.
Check the map button, change languages, and ask about an unrecorded price to verify
that the existing UI still works and missing facts are not invented.

The nested local piskent-invest-ai checkout is preserved on disk and excluded from
Git, TypeScript and ESLint. It is not the application source for this deployment.
