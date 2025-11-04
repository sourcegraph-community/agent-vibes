# AGENTS

Concise project facts and conventions for reliable automation.

## Stack & Layout

- Framework: Next.js 15 (App Router), TypeScript, Tailwind v4
- Data: Supabase (Postgres + Edge Functions)
- External: Apify (Twitter actor), Gemini 2.5 (sentiment), Ollama (RSS summaries)
- Tests/Lint: Vitest, ESLint v9 flat + ESLint Stylistic (no Prettier)

Top directories:
- app/ — routes (API + dashboard-v2 UI)
- src/ApifyPipeline — slice for social ingestion (Web, Background, Core, DataAccess, ExternalServices)
- src/RssPipeline — slice for RSS ingestion & summaries
- supabase/functions/sentiment-processor — built Edge Function (Deno)
- docs/ — API references

## Commands

Development
- `npm run dev` | `npm run build` | `npm run start`

Quality
- `npm run check` (typecheck + lint) | `npm run check:fix`
- `npm test` | `npm run test:watch`

Pipelines & Ops
- `npm run apply-migrations` — apply DB migrations
- `npm run build:edge-functions` — build Edge Functions
- `npm run functions:serve` — serve Edge Function locally
- `npm run health-check` — validate env and connectivity
- `npm run enqueue:backfill` | `npm run process:backfill` | `npm run replay:sentiments`
- `npm run cleanup:raw-tweets`

## API Surfaces

Public (no auth):
- `/api/dashboard-v2/overview` — overview metrics
- `/api/social-sentiment` | `/api/social-sentiment/brands` | `/api/social-sentiment/by-product` | `/api/social-sentiment/tweets`
- `/api/rss/entries` | `/api/rss/health`
- `/api/build-crew/digest`
- `/api/health-check`

Protected (auth required):
- Apify: `/api/start-apify-run`, `/api/process-sentiments`, `/api/process-backfill`
- RSS: `/api/rss/sync`, `/api/rss/summarize`

Auth headers:
- Cron: `Authorization: Bearer ${CRON_SECRET}` or `x-vercel-cron: 1`
- Manual: `x-api-key: ${INTERNAL_API_KEY}`

Refer to docs:
- docs/apify-pipeline/api-reference.md
- docs/rss-pipeline/api-reference.md
- docs/dashboard-v2/api-reference.md

## Environment

Supabase:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_FUNCTIONS_URL` (optional; defaults to `${SUPABASE_URL}/functions/v1`)

Apify:
- `APIFY_TOKEN`, `APIFY_ACTOR_ID`, `APIFY_ACTOR_BUILD` (optional)

Gemini:
- `GEMINI_API_KEY`

Cron/Manual:
- `CRON_SECRET`, `INTERNAL_API_KEY`

RSS/Ollama (optional):
- `INHOUSE_RSS_TIMEOUT_MS`, `INHOUSE_RSS_MAX_CONCURRENCY`
- `OLLAMA_URL`, `OLLAMA_MODEL`

Dev toggles (non-prod only):
- `ALLOW_PUBLIC_START_APIFY`, `ALLOW_API_KEY_QUERY`

## Conventions

- Vertical Slice Architecture (VSA): Request → Endpoint → Handler → Core → Repository → Response
- ESM imports; prefer `@/*` alias; avoid deep relative paths
- API handlers: `route.ts` exports `GET`/`POST`; respond with `NextResponse.json`
- Strict TS: explicit types on public surfaces; rely on inference internally
- Errors: guard with try/catch; return `{ error }` or `{ success: false, message }`; never log secrets
- Formatting: ESLint v9 + Stylistic (no Prettier). Keep diffs minimal.


