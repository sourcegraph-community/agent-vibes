# Agent Vibes

Social intelligence and analytics for AI coding assistants. Collects tweets via Apify, enriches with sentiment (Gemini), ingests curated RSS content (OPML-driven), and presents insights through a Next.js dashboard.

## What’s Inside

- Apify Pipeline: Twitter collection → normalization → sentiment (Gemini via Supabase Edge Function) → Supabase views
- RSS Pipeline: In-house OPML aggregator → categorization → optional Ollama summaries → Supabase
- Dashboard v2: App Router UI consuming JSON APIs for overview, social sentiment, RSS sections, and daily digests

## Tech Stack

- Next.js 15 (App Router, Turbopack), TypeScript (strict), Tailwind v4
- Supabase (PostgreSQL + Edge Functions), Apify (actors), Gemini 2.5 (sentiment), Ollama (summaries)
- ESLint v9 (flat) + ESLint Stylistic, Vitest

## Quick Start

Prereqs: Node 20+, Supabase project, Apify token + actor, Gemini key (optional: local Ollama)

```bash
# Clone & install
npm install

# Configure env
cp .env.example .env.local
# Fill in required keys (see Environment)

# Dev server
npm run dev
```

## Environment (minimal)

Required for core flows:
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- APIFY_TOKEN, APIFY_ACTOR_ID
- GEMINI_API_KEY

Auth for protected routes (cron/manual):
- CRON_SECRET (Bearer), INTERNAL_API_KEY (x-api-key)

RSS/Ollama (optional for summaries):
- INHOUSE_RSS_TIMEOUT_MS, INHOUSE_RSS_MAX_CONCURRENCY
- OLLAMA_URL (http://localhost:11434), OLLAMA_MODEL (e.g. llama3.1:8b)

## Scripts

Development
```bash
npm run dev     # Start dev (Turbopack)
npm run build   # Production build
npm run start   # Start production server
```

Quality & Tests
```bash
npm run check       # Typecheck + lint
npm run check:fix   # Typecheck + lint:fix
npm test            # Vitest
npm run test:watch
```

Pipelines & Ops
```bash
npm run health-check              # Validate env & connectivity
npm run apply-migrations          # Apply DB migrations
npm run build:edge-functions      # Build Supabase Edge Functions
npm run functions:serve           # Serve Edge Function locally
npm run enqueue:backfill          # Queue historical data (manual)
npm run process:backfill          # Process a backfill batch (manual)
npm run replay:sentiments         # Retry sentiment failures
npm run cleanup:raw-tweets        # Prune raw tweet payloads
npm run start:collector           # Trigger Apify run then process sentiments
npm run sync-rss-entries          # Sync RSS entries from OPML aggregator
```

## API References

- [Apify Pipeline](docs/apify-pipeline/api-reference.md)
- [RSS Pipeline](docs/rss-pipeline/api-reference.md)
- [Dashboard v2 UI](docs/dashboard-v2/api-reference.md)
- [CHANGELOG](CHANGELOG.md)
- [Future Enhancements](future-enhancements.md)

## Architecture (VSA)

Feature-first slices; handlers orchestrate pure core logic and data access. Side-effects at boundaries.

```
src/
  ApifyPipeline/
    Web/ Application (Commands/Queries)
    Background/ Jobs
    Core/ (pure)
    DataAccess/
    ExternalServices/ (Apify, Supabase, Gemini)
    Docs/
  RssPipeline/
    Web/ Application (Sync, Summarize)
    Core/ (models, transforms)
    DataAccess/
    ExternalServices/ (Miniflux in-house, Summarizer)
  Shared/
```

Data model (selected):
- cron_runs, raw_tweets, normalized_tweets, tweet_sentiments, sentiment_failures, backfill_batches
- rss_entries, rss_summaries
- views: vw_daily_sentiment, vw_keyword_trends

## Deployment

- Vercel (production). Cron jobs currently disabled; use manual triggers. Re-enable later via vercel.json.
- Supabase Edge Function: build to supabase/functions via `npm run build:edge-functions`.

## Conventions

- ESM imports; path alias `@/*`
- API handlers export GET/POST in `route.ts`; return `NextResponse.json(data, { status })`
- Strict TS; explicit types for public APIs; rely on inference internally
- ESLint v9 + Stylistic formatting (no Prettier) → `npm run check:fix`
- Never log secrets; keep server-only keys on the server

## License

Internal use only.
