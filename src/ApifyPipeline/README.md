# Apify Pipeline Feature

Automated social intelligence slice that collects tweets via Apify, normalizes them, runs Gemini sentiment, and exposes data for a small dashboard. The slice follows Vertical Slice Architecture (VSA) and owns the end-to-end flow.

Note: Vercel cron jobs are currently disabled (see vercel.json). Manual triggers only until re-enabled after testing.

—

## Where Things Live

- API routes (Next.js App Router): app/api/*/route.ts
- Slice endpoints/handlers: src/ApifyPipeline/Web/Application/Commands/*/
- Background jobs (Apify Actor, Backfill, Sentiments): src/ApifyPipeline/Background/Jobs/
- Core logic (pure): src/ApifyPipeline/Core/
- Data access (Supabase repos): src/ApifyPipeline/DataAccess/
- External services (Apify, Supabase, Gemini): src/ApifyPipeline/ExternalServices/
- Dashboard (server components): app/dashboard/*
- Slice docs: src/ApifyPipeline/Docs/* and docs/apify-pipeline/*

Current directories in this slice:

```
src/ApifyPipeline/
├── Web/
│   └── Application/
│       └── Commands/
│           ├── StartApifyRun/
│           ├── ProcessBackfill/
│           └── ProcessSentiments/
├── Background/
│   └── Jobs/
│       ├── TweetCollector/
│       ├── BackfillProcessor/
│       └── SentimentProcessor/
├── Core/
│   ├── Models/
│   ├── Services/
│   └── Transformations/
├── DataAccess/
│   ├── Migrations/
│   ├── Repositories/
│   └── Seeds/
├── ExternalServices/
│   ├── Apify/
│   ├── Gemini/ (EdgeFunctions source → built to supabase/functions)
│   └── Supabase/
├── Docs/
└── README.md
```

—

## API Endpoints (current behavior)

All return JSON. Auth differs per route (see below).

- POST /api/start-apify-run
  - Purpose: Starts an Apify Actor run (does not normalize locally).
  - Auth: Authorization: Bearer `${CRON_SECRET}` OR x-vercel-cron OR x-api-key: `${INTERNAL_API_KEY}`
  - Response: 202 Accepted with `{ data: { runId, actorId, status, url, startedAt } }`
  - Code: app/api/start-apify-run/route.ts → src/ApifyPipeline/Web/Application/Commands/StartApifyRun/StartApifyRunEndpoint.ts

- POST /api/process-sentiments
  - Purpose: Invokes Supabase Edge Function sentiment-processor. Fallback job may run if enabled via env.
  - Auth: x-vercel-cron OR x-api-key: ${INTERNAL_API_KEY}
  - Response: 200 on success with `{ success, message, stats }` or 500
  - Code: app/api/process-sentiments/route.ts → src/ApifyPipeline/Web/Application/Commands/ProcessSentiments/ProcessSentimentsEndpoint.ts

- POST /api/process-backfill
  - Purpose: Processes a queued backfill batch (manual only).
  - Auth: x-vercel-cron OR x-api-key: ${INTERNAL_API_KEY}
  - Response: 200 with result, or 500
  - Code: app/api/process-backfill/route.ts → src/ApifyPipeline/Web/Application/Commands/ProcessBackfill/ProcessBackfillEndpoint.ts

—

## Execution Model

- Collection
  - /api/start-apify-run triggers Apify Actor remotely. The Actor code is under src/ApifyPipeline/Background/Jobs/TweetCollector and runs on Apify.
  - The Actor fetches enabled keywords from Supabase, runs the Twitter scraper, deduplicates by platform_id, inserts raw_tweets and normalized_tweets, then records a cron_runs row with processed counts.

- Sentiment
  - /api/process-sentiments calls the Supabase Edge Function (source in src/ApifyPipeline/ExternalServices/Gemini/EdgeFunctions/sentimentProcessor, built to supabase/functions/sentiment-processor via npm run build:edge-functions).
  - Default Gemini model (code): gemini-2.5-flash-lite.
  - Optional fallback job (server) processes a batch if the Edge Function fails and SENTIMENT_EDGE_FALLBACK=true.

- Backfill
  - Manual-only. Batches live in backfill_batches. The processor can reuse an existing Apify run (metadata.apifyRunId) or create a new one if BACKFILL_FORCE_NEW_APIFY_RUN=true.

—

## Database (as used by current code)

Tables (selected columns only):

- cron_runs
  - id (uuid), trigger_source (text), keyword_batch (text[]),
  - started_at (timestamptz), finished_at (timestamptz), status (text),
  - processed_new_count (int), processed_duplicate_count (int), processed_error_count (int),
  - metadata (jsonb), errors (jsonb)

- raw_tweets
  - id (uuid), run_id (uuid), platform (text), platform_id (text),
  - collected_at (timestamptz), payload (jsonb), ingestion_reason (text)

- normalized_tweets
  - id (uuid), raw_tweet_id (uuid|null), run_id (uuid), platform (text), platform_id (text),
  - revision (int), author_handle (text|null), author_name (text|null),
  - posted_at (timestamptz), collected_at (timestamptz), language (text|null),
  - content (text), url (text|null),
  - engagement_likes (int|null), engagement_retweets (int|null),
  - keyword_snapshot (text[]), status (text), status_changed_at (timestamptz),
  - model_context (jsonb)

- tweet_sentiments
  - id (uuid), normalized_tweet_id (uuid),
  - sentiment_label (text), sentiment_score (numeric), summary (text|null),
  - model_version (text), processed_at (timestamptz),
  - tokens_used (int|null), latency_ms (int|null)

- backfill_batches
  - id (uuid), keywords (text[]), start_date (date), end_date (date),
  - status (text), priority (int), metadata (jsonb), created_at/updated_at

Views consumed by the dashboard:
- vw_daily_sentiment
- vw_keyword_trends

—

## Environment

Validated in src/ApifyPipeline/Infrastructure/Config/env.ts. Required/used keys in this slice:

- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (dashboard)
- SUPABASE_FUNCTIONS_URL (optional override for edge function base)
- APIFY_TOKEN, APIFY_ACTOR_ID, (optional) APIFY_ACTOR_BUILD
- COLLECTOR_LANGUAGE (optional; default 'en')
- COLLECTOR_REUSE_EXISTING (optional; default false)
- GEMINI_API_KEY
- CRON_SECRET (used by /api/start-apify-run)
- INTERNAL_API_KEY (manual triggers)
- SENTIMENT_EDGE_FALLBACK (optional)

—

## Ops & Notes

- Cron disabled: vercel.json contains no crons. Re-enable later when testing completes.
- Health endpoint: GET /api/health-check checks DB connectivity, backlog, failures, and recent cron stats.
- Data retention: raw_tweets cleanup script available. See scripts/* and src/ApifyPipeline/Docs/*.

—

## Quick Commands

```bash
npm run health-check              # Validate environment
npm run build:edge-functions      # Build Supabase Edge Functions
npm run functions:serve           # Serve Edge Functions locally
npm run enqueue:backfill          # Queue historical data (manual)
npm run process:backfill          # Process a backfill batch (manual)
npm run replay:sentiments         # Retry failed sentiments
npm run cleanup:raw-tweets        # Prune raw tweets (retention)
```

Curl examples (manual):

```bash
# Start Apify run (manual)
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INTERNAL_API_KEY" \
  -d '{ "triggerSource": "manual-test", "ingestion": { "maxItemsPerKeyword": 20 } }'

# Process sentiments
curl -X POST http://localhost:3000/api/process-sentiments \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INTERNAL_API_KEY" \
  -d '{ "batchSize": 10 }'

# Process backfill
curl -X POST http://localhost:3000/api/process-backfill \
  -H "x-api-key: $INTERNAL_API_KEY"
```

—

## Security (current routes)

- /api/start-apify-run: Authorization: Bearer ${CRON_SECRET} OR x-vercel-cron OR x-api-key
- /api/process-sentiments: x-vercel-cron OR x-api-key
- /api/process-backfill: x-vercel-cron OR x-api-key

Secrets never logged; server-only keys are not exposed to the client.

—

## Dashboard

Server components in app/dashboard fetch from Supabase views:
- Overview: app/dashboard/page.tsx
- Keywords: app/dashboard/keywords/page.tsx
- Tweets: app/dashboard/tweets/page.tsx

—

Last updated: 2025-10-03
