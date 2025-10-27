# Apify Pipeline - Local Testing Guide

**Document Owner:** Engineering Team  
**Last Updated:** October 27, 2025  
**Related Documents:** [Specification](specification.md), [Overview](overview.md), [Date-Based Collection Strategy](date-based-collection-strategy.md), [Operational Runbook](../../src/ApifyPipeline/Docs/ApifyPipeline-start-apify-run-runbook.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Quickstart Checklist](#quickstart-checklist)
3. [Prerequisites](#prerequisites)
4. [Environment Setup](#environment-setup)
5. [Testing Workflow](#testing-workflow)
6. [Component-Level Testing](#component-level-testing)
7. [Integration Testing](#integration-testing)
8. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
9. [Data Verification](#data-verification)
10. [Development Commands](#development-commands)
11. [API Endpoint Reference](#api-endpoint-reference)
12. [Next Steps](#next-steps)
13. [Resources](#resources)
14. [Appendix: Sample Test Data](#appendix-sample-test-data)

---

## Overview

This guide provides step-by-step instructions for testing the Apify Pipeline locally. The pipeline consists of multiple integrated components working together to collect, process, and display social media mentions. The root path redirects to `/dashboard-v2`.

Note: Vercel cron is configured in `vercel.json` for `/api/start-apify-run`. For local testing, use the manual API examples in this guide.

### Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│  Local Testing Environment                              │
│                                                         │
│  ┌────────────────┐      ┌─────────────────┐            │
│  │  Next.js App   │──────│  API Endpoints  │            │
│  │  (localhost)   │      │  /api/*         │            │
│  └────────────────┘      └─────────────────┘            │
│           │                       │                      │
│           │                       ▼                      │
│           │            ┌─────────────────────┐           │
│           │            │  Background Jobs    │           │
│           │            │  - TweetCollector   │           │
│           │            │  - BackfillProc.    │           │
│           │            │  - SentimentProc.   │           │
│           │            └─────────────────────┘           │
│           │                       │                      │
│           ▼                       ▼                      │
│  ┌──────────────────────────────────────────┐            │
│  │         External Services                 │            │
│  │  - Supabase (Cloud)                       │            │
│  │  - Apify (Cloud)                          │            │
│  │  - Google Gemini (Cloud)                  │            │
│  └──────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **API Endpoints** | `app/api/` | REPR pattern entry points |
| **Command Handlers** | `src/ApifyPipeline/Web/Application/Commands/` | Business logic orchestration |
| **Background Jobs** | `src/ApifyPipeline/Background/Jobs/` | Tweet collection, backfill & sentiment processing |
| **Data Access** | `src/ApifyPipeline/DataAccess/` | Supabase repositories & queries |
| **External Services** | `src/ApifyPipeline/ExternalServices/` | Apify, Supabase, Gemini clients |
| **Core Logic** | `src/ApifyPipeline/Core/` | Pure business logic & transformations |
| **Dashboard** | `app/dashboard-v2/` | Frontend visualization |

---

## Quickstart Checklist

### 1. 5-Minute Setup

```bash
# Copy the template
cp .env.example .env.local

# Fill in credentials
nano .env.local
```

**Populate these values:**

```bash
# Supabase (Dashboard → Settings → API)
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]

# Apify (Dashboard → Settings → Integrations)
APIFY_TOKEN=[your-apify-token]
APIFY_ACTOR_ID=apidojo/tweet-scraper

# Gemini (https://aistudio.google.com/)
GEMINI_API_KEY=[your-gemini-api-key]

# Optional: Manual API auth
INTERNAL_API_KEY=$(openssl rand -hex 32)
```

```bash
# Install dependencies
npm install

# Apply migrations (recommended)
npm run apply-migrations

# —or— using Supabase CLI for local dev
supabase db push
```

```bash
# Sanity check
npm run health-check

# Start the dev server
npm run dev
```

Visit [http://localhost:3000/dashboard-v2](http://localhost:3000/dashboard-v2)

### 2. Quick Test Sequence (≈5 minutes)

1. **Tweet collection**
   ```bash
   # Option A: API
   curl -X POST http://localhost:3000/api/start-apify-run \
     -H "Content-Type: application/json" \
     -H "x-api-key: $INTERNAL_API_KEY" \
     -d '{
       "triggerSource": "manual-test",
       "ingestion": {
         "maxItems": 100,
         "sort": "Latest",
         "useDateFiltering": false
       }
     }'
   
   # Option B: Script (env-driven)
   # Default: runs sequentially per enabled product when COLLECTOR_PRODUCT is omitted
   COLLECTOR_MAX_ITEMS=100 npm run start:collector
   
   # Single brand only
   COLLECTOR_PRODUCT=windsurf COLLECTOR_MAX_ITEMS=100 npm run start:collector
    ```
    - Expect `202 Accepted` with a `runId` (API) or script console output
    - Monitor the run in Apify Console
     - Tip: Set `COLLECTOR_REUSE_EXISTING=false` to force a new Apify run.

2. **Verify data landed**
   ```sql
   SELECT id, status, processed_new_count, processed_duplicate_count, started_at
   FROM cron_runs
   ORDER BY started_at DESC
   LIMIT 1;

   SELECT COUNT(*) AS tweet_count
   FROM normalized_tweets;
   ```

3. **Process sentiments**
   ```bash
   # Option A: API route
curl -X POST http://localhost:3000/api/process-sentiments \
   -H "Content-Type: application/json" \
   -H "x-api-key: $INTERNAL_API_KEY" \
  -d '{"batchSize": 10}'

   # Option B: Local script (no Edge dependency)
   NUMBER_OF_PENDING_TWEETS=10 \
   SENTIMENT_MAX_RETRIES=1 \
   SENTIMENT_MODEL_VERSION=gemini-2.5-flash-lite \
   npm run process:sentiments
   ```
   - Expect `200 OK` with a `processed` count (API), or script console output with per-item lines:
     - `[Sentiment] OK [i/N] ...` on success
     - `[Sentiment] FAIL [i/N] code=...` on failure

4. **Spot-check the dashboard**
   - [http://localhost:3000/dashboard-v2](http://localhost:3000/dashboard-v2)

### 3. Success Criteria

- ✅ At least one `cron_runs` record with `status = succeeded`
- ✅ New rows in `normalized_tweets`
- ✅ Corresponding rows in `tweet_sentiments`
- ✅ Dashboard renders stats without console errors
- ✅ `npm run health-check` exits with success

### 4. Quick Fixes

| Symptom | Quick Fix |
|---------|-----------|
| "Environment variable not found" | Ensure `.env.local` exists, confirm names, rerun `npm run dev` |
| "No keywords available" | Re-run `src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql` and verify enabled keywords per product |
| Apify run fails | Lower `maxItems` (e.g. 50); verify compute units |
| Gemini quota exceeded | Lower sentiment `batchSize` (e.g. 3) to stay under free-tier limits |

---

## Prerequisites

### Required Accounts & Access

1. **Supabase Project** (required)
   - Project URL and Service Role Key
   - Anon Key for client-side access
   - Database migrations applied

2. **Apify Account** (required for tweet collection)
   - Active account with API token
   - Access to `apidojo/tweet-scraper` actor (or compatible custom actor)
   - Sufficient compute units for testing

3. **Google Gemini API** (required for sentiment analysis)
   - API key from Google AI Studio
   - Free tier provides ~15 RPM / 1.5M tokens per day

### Local Environment

- **Node.js:** 20+ (Next.js 15); recommend Node 20 LTS
- **npm:** Latest version
- **Git:** For repository access
- **psql (Postgres client, on PATH):** Required for `npm run apply-migrations`
- **Supabase CLI:** Required for `npm run functions:serve`
- **curl or Postman:** For API testing
- **Database client:** (optional) pgAdmin or Supabase Studio for data inspection

---

## Environment Setup

### Step 1: Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/sourcegraph-community/agent-vibes.git
cd agent-vibes

# Install dependencies
npm install
```

### Step 2: Configure Environment Variables

Create a `.env.local` file in the project root (git-ignored):

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your values. Required entries:

```bash
# Supabase Configuration (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://postgres.<ref>@aws-1-<region>.pooler.supabase.com:5432/postgres
# Optional fallback if DATABASE_URL is omitted
# SUPABASE_DB_PASSWORD=service-role-password
# SUPABASE_DB_HOST=aws-1-<region>.pooler.supabase.com
# SUPABASE_DB_PORT=5432

# Apify Configuration (REQUIRED)
APIFY_TOKEN=your-apify-token
APIFY_ACTOR_ID=apidojo/tweet-scraper
# Optional actor build override
# APIFY_ACTOR_BUILD=latest

# Google Gemini Configuration (REQUIRED)
GEMINI_API_KEY=your-gemini-api-key

# API Authentication (Production Recommended)
CRON_SECRET=your-random-secret-key

# Internal API Key (Recommended for manual testing)
INTERNAL_API_KEY=your-random-secret-key

# Optional: Vercel environment indicator
# VERCEL_ENV=development
```

#### Environment Variable Reference

| Variable | Required | Purpose | Where to Get |
|----------|----------|---------|--------------|
| `SUPABASE_URL` | ✅ | Database connection | Supabase Dashboard → API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server DB access | Supabase Dashboard → API |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Client DB access | Same as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Client DB access | Supabase Dashboard → API |
| `DATABASE_URL` | ✅ | Script migrations via pooler | Supabase Dashboard → Database | 
| `APIFY_TOKEN` | ✅ | Tweet collection | AgentVibes Dashboard → Integrations |
| `APIFY_ACTOR_ID` | ✅ | Actor to run | Use `apidojo/tweet-scraper` or custom |
| `GEMINI_API_KEY` | ✅ | Sentiment analysis | Google AI Studio |
| `CRON_SECRET` | ⚠️ | Production cron auth | Generate `openssl rand -hex 32` |
| `INTERNAL_API_KEY` | ⚠️ | Manual API auth | Generate `openssl rand -hex 32` |
| `APIFY_ACTOR_BUILD` | ❌ | Actor version pin | Default `latest` |
| `SUPABASE_FUNCTIONS_URL` | ❌ | Override functions base URL (local Edge Functions) | Default `${SUPABASE_URL}/functions/v1`; use `http://127.0.0.1:54321/functions/v1` when serving locally |
| `SENTIMENT_EDGE_FALLBACK` | ❌ | Fallback to Node job if Edge function fails | Set `true` for local API testing without functions |
| `VERCEL_ENV` | ❌ | Environment flag | Auto-set by Vercel |

Note: For local Edge Functions testing, create `supabase/.env.local` with at least:

```bash
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
GEMINI_API_KEY=<your-gemini-api-key>
# optional
GEMINI_MODEL=gemini-2.5-flash-lite
SENTIMENT_CONCURRENCY=4
SENTIMENT_RPM_CAP=60
SENTIMENT_TPM_CAP=0
SENTIMENT_TOKENS_PER_REQUEST_ESTIMATE=600
SENTIMENT_RATE_LIMIT_DELAY_MS=0
```

Then serve functions locally:

```bash
npm run build:edge-functions
npm run functions:serve
```

If calling the API locally, either set `SUPABASE_FUNCTIONS_URL=http://127.0.0.1:54321/functions/v1` or set `SENTIMENT_EDGE_FALLBACK=true` in `.env.local`.

### Step 3: Database Setup

Apply the Apify Pipeline migration to Supabase:

```bash
# Option 1: Project script (requires psql and DATABASE_URL, or SUPABASE_URL + SUPABASE_DB_PASSWORD)
npm run apply-migrations

# Option 2: Supabase CLI
supabase db push

# Option 3: Manual SQL execution
# 1. Supabase Studio → SQL Editor
# 2. Run src/ApifyPipeline/DataAccess/Migrations/20250929_1200_InitApifyPipeline.sql
# 3. Run src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql
```

Migrations are idempotent; seeds include multiple enabled keywords across products (`keywords.product`).

**Verify Migration:**

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'keywords',
    'cron_runs',
    'raw_tweets',
    'normalized_tweets',
    'tweet_sentiments'
  );

-- Check keywords are seeded (enabled keywords grouped by product)
SELECT product, COUNT(*) AS enabled_count
FROM keywords
WHERE is_enabled = true
GROUP BY product
ORDER BY product;
```

### Step 4: Start Development Server

```bash
npm run dev
```

The application runs at [http://localhost:3000](http://localhost:3000). Verify:

- [http://localhost:3000](http://localhost:3000) loads and redirects to `/dashboard-v2`
- [http://localhost:3000/dashboard-v2](http://localhost:3000/dashboard-v2) displays the dashboard

---

## Testing Workflow

### Complete End-to-End Sequence

Follow this sequence to validate tweet collection → normalization → sentiment analysis → dashboard display.

#### Test 1: Health Check

```bash
npm run health-check
```

The script loads `.env.local`, validates required variables, and inspects Supabase health. Success is indicated by a green summary. Investigate any warning or critical output before proceeding.

#### Test 2: Tweet Collection (Apify Integration)

```bash
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INTERNAL_API_KEY" \
  -d '{
    "triggerSource": "manual-test",
    "ingestion": {
      "maxItems": 50,
      "sort": "Top",
      "cooldownSeconds": 5
    }
  }'
```

**Expected Response (`202 Accepted`):**

```json
{
  "data": {
    "runId": "abc123-def456-...",
    "actorId": "apidojo/tweet-scraper",
    "status": "RUNNING",
    "url": "https://console.apify.com/actors/.../runs/...",
    "startedAt": "2025-09-30T17:11:00.000Z"
  }
}
```

Monitor via Apify Console or Supabase:

```sql
SELECT id, trigger_source, status, processed_new_count, processed_duplicate_count, processed_error_count
FROM cron_runs
ORDER BY started_at DESC
LIMIT 1;
```

Success criteria:

- Apify run status transitions to `SUCCEEDED`
- Latest `cron_runs.status` is `succeeded` or `partial_success`
- `processed_new_count` > 0 on the first run

#### Test 3: Data Verification

```sql
-- Raw tweets
SELECT id, platform, platform_id, collected_at, jsonb_pretty(payload) AS payload_preview
FROM raw_tweets
ORDER BY collected_at DESC
LIMIT 3;

-- Normalized tweets
SELECT id, platform_id, author_handle, content, status, engagement_likes, engagement_retweets, keyword_snapshot, posted_at, collected_at
FROM normalized_tweets
ORDER BY collected_at DESC
LIMIT 5;
```

Expect new rows with `status = 'pending_sentiment'` prior to processing, populated keyword arrays, and realistic engagement metrics.

#### Test 4: Sentiment Processing

```bash
curl -X POST http://localhost:3000/api/process-sentiments \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INTERNAL_API_KEY" \
  -d '{
    "batchSize": 10
  }'
```

**Expected Response (`200 OK`):**

```json
{
  "success": true,
  "message": "Processed 10 tweets, 0 failed, 0 deferred",
  "stats": {
    "processed": 10,
    "failed": 0,
    "skipped": 0,
    "totalLatencyMs": 12500,
    "totalTokens": 850
  }
}
```

Verify sentiments:

```sql
SELECT ts.id, ts.sentiment_label, ts.sentiment_score, ts.reasoning->>'summary' AS summary, ts.model_version, nt.content
FROM tweet_sentiments ts
JOIN normalized_tweets nt ON ts.normalized_tweet_id = nt.id
ORDER BY ts.processed_at DESC
LIMIT 5;

SELECT status, COUNT(*) AS count
FROM normalized_tweets
GROUP BY status;
```

#### Test 5: Dashboard Verification

- Navigate to [http://localhost:3000/dashboard-v2](http://localhost:3000/dashboard-v2) for summary metrics and Social Sentiment

Ensure charts render and browser console remains free of errors.

---

## Component-Level Testing

### 1. Apify Client Dry Run

```bash
cat > test-apify-client.ts <<'EOF'
import { startApifyActorRun } from './src/ApifyPipeline/ExternalServices/Apify/client';

const result = await startApifyActorRun(
  { triggerSource: 'test', ingestion: { maxItems: 10 } },
  { dryRun: true }
);

console.log('Dry run result:', result);
EOF

tsx test-apify-client.ts
```

### 2. Normalization Logic

```bash
npm test -- src/ApifyPipeline/Tests/Unit/Core/Transformations/normalizeTweet.test.ts
```

### 3. Supabase Connectivity

Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

```typescript
// test-supabase.ts
import { createSupabaseServiceClient } from './src/ApifyPipeline/ExternalServices/Supabase/client';

const client = createSupabaseServiceClient();
const { data, error } = await client.from('keywords').select('id').limit(1);

if (error) {
  console.error('Supabase connection failed:', error);
  process.exit(1);
}

console.log('✓ Supabase connected successfully');
```

```bash
tsx test-supabase.ts
```

### 4. Gemini Client

Requires `GEMINI_API_KEY` in `.env.local`.

```typescript
// test-gemini.ts
import { GeminiClient } from './src/ApifyPipeline/ExternalServices/Gemini/GeminiClient';
import { getGeminiEnv } from './src/ApifyPipeline/Infrastructure/Config/env';

const env = getGeminiEnv();
const client = new GeminiClient({ apiKey: env.apiKey });

const result = await client.analyzeSentiment({
  tweetId: 'test-123',
  content: 'This AI coding agent is amazing! It boosted my productivity significantly.',
  authorHandle: 'test_user',
  language: 'en',
});

console.log('Sentiment result:', result);
```

```bash
tsx test-gemini.ts
```

---

## Integration Testing

### Workflow 1: Backfill Historical Data (Manual)

```bash
# Populate queue (default: 30 days in 5-day chunks)
npm run enqueue:backfill

# Fewer records for testing
BACKFILL_DAYS=5 npm run enqueue:backfill

# Custom window
BACKFILL_DAYS=10 BACKFILL_BATCH_SIZE=5 npm run enqueue:backfill
```

Process batches:

```bash
npm run process:backfill
# or
curl -X POST http://localhost:3000/api/process-backfill \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INTERNAL_API_KEY"
```

Monitor progress:

```sql
SELECT id, start_date, end_date, status, keywords, created_at, updated_at
FROM backfill_batches
ORDER BY priority DESC, created_at;
```

Expect status changes `pending → running → completed` and metadata containing `apifyRunId`.

#### Use a Completed Apify Run (Dataset-Only Backfill)

1. **Capture run details:** In the Apify Console open the completed run you want to ingest, copy the Run ID (and optionally the Dataset ID shown on the run detail page). Runs must be in the `SUCCEEDED` or `SUCCEEDED_WITH_WARNINGS` state.
2. **Prepare a matching batch:** Ensure a `backfill_batches` row exists that covers the same keyword set and date window. You can create one with `npm run enqueue:backfill` or insert a custom batch manually.
3. **Attach the run metadata:** In Supabase Studio → SQL Editor (or via psql) run:
   ```sql
   UPDATE backfill_batches
   SET metadata = COALESCE(metadata, '{}'::jsonb)
     || jsonb_build_object(
       'apifyRunId', '<APIFY_RUN_ID>',
       'apifyDatasetId', '<APIFY_DATASET_ID>' -- optional but helpful for auditing
     )
   WHERE id = '<BACKFILL_BATCH_ID>';
   ```
   Replace the placeholders with the values from Step 1. Leaving off `apifyDatasetId` is acceptable—the processor retrieves it automatically once the run is inspected.
4. **Process without forcing a new run:** Make sure `BACKFILL_FORCE_NEW_APIFY_RUN` is **not** set (or is `false`) and run `npm run process:backfill`. The job detects the `apifyRunId`, skips triggering a fresh actor run, and pulls items directly from the existing dataset.
5. **Verify ingestion:** Check `cron_runs` for a new entry whose metadata contains `reusedApifyRun: true`, and confirm new tweets appear in `normalized_tweets`.

If you accidentally process a batch without `apifyRunId` metadata, the processor throws `Existing Apify run metadata not found...`. Add the metadata or rerun with `BACKFILL_FORCE_NEW_APIFY_RUN=true` to launch a fresh actor execution.

**Retry tips:** If a batch was marked `failed`, set it back to pending before retrying:
```sql
UPDATE backfill_batches
SET status = 'pending',
    updated_at = now()
WHERE id = '<BACKFILL_BATCH_ID>';
```
Re-running the processor with the same `apifyRunId` keeps using the original Apify dataset (no new actor run). Expect `processedDuplicateCount` to reflect already-ingested tweets and note that historical fields such as `failedAt` or `lastErrorMessage` remain in metadata for traceability.

### Workflow 2: Failed Sentiment Replay

```sql
-- Optional: seed failures for testing
INSERT INTO sentiment_failures (normalized_tweet_id, error_message, retry_count, last_attempt_at)
SELECT id, 'Test failure', 1, now()
FROM normalized_tweets
WHERE status = 'pending_sentiment'
LIMIT 5;
```

```bash
npm run replay:sentiments
```

```sql
SELECT COUNT(*) AS remaining_failures
FROM sentiment_failures
WHERE retry_count >= 1;

SELECT status, COUNT(*)
FROM normalized_tweets
GROUP BY status;
```

### Workflow 3: Data Cleanup

```bash
# Dry run (keeps last 30 days)
npm run cleanup:raw-tweets -- --dry-run

# Execute cleanup
npm run cleanup:raw-tweets

# Sentiment failure retention (defaults to 90 days)
npm run cleanup:sentiment-failures -- --max-age-days=90
```

Validation queries:

```sql
SELECT MIN(collected_at) AS oldest_raw_tweet FROM raw_tweets;
SELECT COUNT(*) FROM normalized_tweets;
```

---

## Common Issues & Troubleshooting

### Issue 1: Missing Environment Variables

```
Error: APIFY_TOKEN and APIFY_ACTOR_ID must be configured.
❌ Missing required environment variables
```

**Fix:**

1. Verify `.env.local` exists and matches variable names exactly
2. Confirm there are no stray quotes or whitespace in `.env.local`
3. Re-run `npm run health-check` to validate changes
4. Restart `npm run dev` so Next.js picks up updates

### Issue 2: Supabase Connection Failure

```
Failed to initialize Supabase client
Database connection timeout
```

**Fix:**

- Confirm project is active and not paused
- Ensure URL matches `https://[project-ref].supabase.co`
- Use the service role key (not the anon key)
- Test manually:
  ```bash
  curl -X GET "https://[your-project].supabase.co/rest/v1/keywords?select=id" \
    -H "apikey: your-service-role-key" \
    -H "Authorization: Bearer your-service-role-key"
  ```

### Issue 3: No Keywords Available

```
SELECT * FROM keywords WHERE is_enabled = true; -- returns 0 rows
```

**Fix:** Re-run the seed script `src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql` and confirm four enabled keywords are present.

### Issue 4: Apify Run Failed or Rate Limited

- Check compute units in the Apify dashboard
- Reduce `maxItems`
- Increase `cooldownSeconds`
- Monitor run logs via the provided console URL

### Issue 5: Gemini API Quota Exhaustion

- Free tier allows 15 requests per minute
- Lower `batchSize` during sentiment processing (e.g. to 3)
- Space out batch runs or upgrade to a paid tier

### Issue 6: Duplicate Tweet Detection

Investigate duplicates:

```sql
SELECT platform_id, COUNT(*) AS count
FROM normalized_tweets
GROUP BY platform_id
HAVING COUNT(*) > 1;
```

Verify unique index on `(platform, platform_id)` exists and migrations applied successfully.

### Issue 7: Dashboard Shows No Data

- Confirm views exist:
  ```sql
  SELECT table_name
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name IN ('vw_daily_sentiment', 'vw_keyword_trends');
  ```
- Ensure ingestion or backfill runs succeeded
- Check the browser console for API errors

### Troubleshooting Decision Tree

```
Issue: API returns error
├─ 401 Unauthorized
│  ├─ /api/process-backfill → Add header: x-api-key: $INTERNAL_API_KEY (or use x-vercel-cron)
│  ├─ /api/process-sentiments → Add header: x-api-key: $INTERNAL_API_KEY (or use x-vercel-cron)
│  └─ /api/start-apify-run → Use Authorization: Bearer $CRON_SECRET, or x-vercel-cron, or x-api-key: $INTERNAL_API_KEY
├─ 500 Internal Server Error
│  ├─ "APIFY_TOKEN and APIFY_ACTOR_ID must be configured." → Check .env.local
│  ├─ "GEMINI_API_KEY must be configured for sentiment analysis." → Check .env.local
│  └─ "Supabase unreachable: ..." → Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
└─ 429 Rate Limit
   ├─ Apify → Check compute units, reduce batch size
   └─ Gemini → Free tier: 15 RPM, reduce batch size

Issue: No data in database
├─ Check cron_runs table for errors
├─ Verify Apify run completed in console
└─ Check keywords table has is_enabled=true records

Issue: Dashboard shows no data
├─ Check if views exist (vw_daily_sentiment, vw_keyword_trends)
├─ Ensure at least one ingestion/backfill run has written tweets
└─ Check browser console for errors
```

---

## Data Verification

### Quick Queries

```sql
-- Pipeline health snapshot
SELECT 'cron_runs' AS table_name,
       COUNT(*) AS records,
       COUNT(CASE WHEN status = 'succeeded' THEN 1 END) AS successful
FROM cron_runs
UNION ALL
SELECT 'normalized_tweets', COUNT(*), COUNT(CASE WHEN status = 'processed' THEN 1 END)
FROM normalized_tweets
UNION ALL
SELECT 'tweet_sentiments', COUNT(*), COUNT(CASE WHEN sentiment_label IS NOT NULL THEN 1 END)
FROM tweet_sentiments;

-- Recent activity
SELECT trigger_source, status, processed_new_count AS new_tweets,
       started_at, finished_at, (finished_at - started_at) AS duration
FROM cron_runs
ORDER BY started_at DESC
LIMIT 5;

-- Sentiment distribution
SELECT sentiment_label,
       COUNT(*) AS count,
       ROUND(AVG(sentiment_score)::numeric, 2) AS avg_score
FROM tweet_sentiments
GROUP BY sentiment_label
ORDER BY count DESC;

-- Top engaged tweets
SELECT nt.content, nt.author_handle,
       nt.engagement_likes + nt.engagement_retweets AS total_engagement,
       ts.sentiment_label, nt.posted_at
FROM normalized_tweets nt
LEFT JOIN tweet_sentiments ts ON ts.normalized_tweet_id = nt.id
ORDER BY total_engagement DESC
LIMIT 10;
```

### Quality Checks

```sql
-- Table inventory + latest timestamps
SELECT 'cron_runs' AS table_name,
       COUNT(*) AS total_records,
       COUNT(CASE WHEN status = 'succeeded' THEN 1 END) AS successful_runs,
       MAX(started_at) AS last_run
FROM cron_runs
UNION ALL
SELECT 'raw_tweets', COUNT(*), COUNT(CASE WHEN ingestion_reason = 'initial' THEN 1 END), MAX(collected_at)
FROM raw_tweets
UNION ALL
SELECT 'normalized_tweets', COUNT(*), COUNT(CASE WHEN status = 'processed' THEN 1 END), MAX(collected_at)
FROM normalized_tweets
UNION ALL
SELECT 'tweet_sentiments', COUNT(*), COUNT(CASE WHEN sentiment_label IS NOT NULL THEN 1 END), MAX(processed_at)
FROM tweet_sentiments;
```

### Consistency Checks

```sql
-- Raw → Normalized linkage
SELECT 'Raw → Normalized' AS relationship,
       COUNT(DISTINCT rt.id) AS raw_count,
       COUNT(DISTINCT nt.raw_tweet_id) AS normalized_references
FROM raw_tweets rt
LEFT JOIN normalized_tweets nt ON rt.id = nt.raw_tweet_id;

-- Orphaned sentiments
SELECT COUNT(*) AS orphaned_sentiments
FROM tweet_sentiments ts
LEFT JOIN normalized_tweets nt ON ts.normalized_tweet_id = nt.id
WHERE nt.id IS NULL;
```

### Sentiment Health

```sql
SELECT sentiment_label,
       COUNT(*) AS count,
       ROUND(AVG(sentiment_score)::numeric, 3) AS avg_score,
       MIN(sentiment_score) AS min_score,
       MAX(sentiment_score) AS max_score
FROM tweet_sentiments
GROUP BY sentiment_label
ORDER BY count DESC;
```

### Timeline Consistency

```sql
SELECT MIN(posted_at) AS earliest_tweet,
       MAX(posted_at) AS latest_tweet,
       MIN(collected_at) AS first_collection,
       MAX(collected_at) AS last_collection,
       COUNT(*) AS total_tweets
FROM normalized_tweets;
```

---

## Development Commands

```bash
# App lifecycle
npm run dev                 # Next.js dev server (Turbopack)
npm run build               # Next.js build (Turbopack)
npm run start               # Next.js production server

# Quality
npm run check               # Typecheck + lint
npm run check:fix           # Typecheck + lint --fix
npm run typecheck           # TypeScript only
npm run typecheck:watch     # TypeScript watch mode
npm run lint                # ESLint only
npm run lint:fix            # ESLint --fix
npm run fix                 # Alias for lint:fix

# Tests (Vitest)
npm test                    # Run tests once
npm run test:watch          # Watch mode
npm run test:ui             # UI mode
npm run test:date-filtering # Date filtering test harness

# Health & setup
npm run health-check        # Validate env and connectivity
npm run apply-migrations    # Apply SQL migrations via DATABASE_URL
npm run apply-product-extension # Apply product extension

# Supabase Edge Functions
npm run build:edge-functions # Build Supabase Edge Functions
npm run functions:serve      # Serve functions locally

# Pipeline: collection & processing
npm run start:collector     # Kick off Apify collection (env-driven)
npm run process:sentiments  # Process pending sentiments

# Backfill workflows
npm run enqueue:backfill    # Enqueue historical batches
npm run process:backfill    # Process a backfill batch

# Replay & cleanup
npm run replay:sentiments   # Retry failed sentiments
npm run cleanup:raw-tweets  # Prune raw tweets (30-day retention)
npm run cleanup:sentiment-failures -- --max-age-days=90 # Prune sentiment failures

# Maintenance
npm run rotate:supabase     # Rotate Supabase secrets

# RSS utilities
npm run sync-rss-entries    # Sync RSS entries
npm run summarize-rss-entries # Summarize RSS entries
npm run cleanup-rss-failures  # Cleanup RSS failures
npm run reset-sync-rss        # Reset RSS sync state
npm run dry-run:inhouse       # Dry run in-house RSS
```

---

## API Endpoint Reference

Auth overview
- Authorization: Bearer $CRON_SECRET (Vercel Cron or manual)
- x-vercel-cron: 1 (Vercel Cron only)
- x-api-key: $INTERNAL_API_KEY (manual triggers)

Note: /api/start-apify-run additionally supports public GET triggers in non-production when ALLOW_PUBLIC_START_APIFY=true. Query-string API keys are allowed only when ALLOW_API_KEY_QUERY=true and NODE_ENV!="production".

### `/api/start-apify-run`

- Methods: POST, GET
- Auth: Authorization Bearer $CRON_SECRET OR x-vercel-cron OR x-api-key $INTERNAL_API_KEY. In non-prod, GET may be public if ALLOW_PUBLIC_START_APIFY=true.
- Request payload (command variant):
  - triggerSource: string (default: "manual")
  - requestedBy: string (optional)
  - dryRun: boolean (optional, default: false)
  - ingestion: {
    - tweetLanguage?: string (2–5 chars)
    - sort: "Top" | "Latest" (default: "Latest")
    - maxItems: integer 1..1000 (default: 100)
    - cooldownSeconds: integer 0..3600 (default: 0)
    - useDateFiltering: boolean (default: false)
    - defaultLookbackDays: integer 1..30 (default: 7)
    - minimumEngagement?: { retweets?: int; favorites?: int; replies?: int }
  }
  - metadata?: { [k: string]: unknown }
- Request payload (raw pass-through): if the body looks like tweet-scraper input (e.g. searchTerms/includeSearchTerms/tweetLanguage/sort/maxItems), it is forwarded as-is to the Apify actor.
- GET JSON: you may pass JSON via query params named input or raw or json.

Examples

POST with x-api-key
```bash
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INTERNAL_API_KEY" \
  -d '{
    "triggerSource": "manual",
    "ingestion": { "maxItems": 100, "sort": "Latest" }
  }'
```

GET with Authorization Bearer and URL-encoded JSON
```bash
curl -G http://localhost:3000/api/start-apify-run \
  -H "Authorization: Bearer $CRON_SECRET" \
  --data-urlencode 'json={"ingestion":{"maxItems":50}}'
```

Raw pass-through (tweet-scraper style)
```bash
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "searchTerms": ["ampcode", "windsurf"],
    "maxItems": 50,
    "tweetLanguage": "en",
    "sort": "Latest",
    "includeSearchTerms": true
  }'
```

### `/api/process-sentiments`

- Method: POST
- Auth: x-vercel-cron OR x-api-key $INTERNAL_API_KEY
- Request payload: { batchSize?: number (default 10); modelVersion?: string; maxRetries?: number }

Example
```bash
curl -X POST http://localhost:3000/api/process-sentiments \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INTERNAL_API_KEY" \
  -d '{"batchSize": 10}'
```

### `/api/process-backfill`

- Method: POST
- Auth: x-vercel-cron OR x-api-key $INTERNAL_API_KEY
- Request payload: none

Example
```bash
curl -X POST http://localhost:3000/api/process-backfill \
  -H "x-api-key: $INTERNAL_API_KEY"
```

---

## Next Steps

### After Successful Local Testing

1. **Review logs:**
   - Console output for warnings
   - Apify run logs for anomalies
   - Supabase logs for query performance

2. **Prepare production configuration:**
   - Document configuration differences
   - Capture baseline performance metrics (latency, tokens, backlog)
   - Identify rate-limit constraints encountered during testing

3. **Deploy to staging/production:**
   - Configure Vercel environment variables
   - Set up Vercel Cron jobs (Pro plan required for <24h intervals)
   - Enable monitoring and alerting
   - Reference the [Operational Runbook](../../src/ApifyPipeline/Docs/ApifyPipeline-start-apify-run-runbook.md)

4. **Continuous testing:**
   - `npm test`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run check`

---

## Resources

### Documentation

- [Apify Pipeline Specification](specification.md)
- [Architecture Overview](overview.md)
- [Date-Based Collection Strategy](date-based-collection-strategy.md)
- [Operational Runbook](../../src/ApifyPipeline/Docs/ApifyPipeline-start-apify-run-runbook.md)
- [Incident Response Guide](../../src/ApifyPipeline/Docs/incident-response-runbook.md)

### External References

- [Apify API Docs](https://docs.apify.com/api/v2)
- [Supabase Docs](https://supabase.com/docs)
- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Next.js 15 Docs](https://nextjs.org/docs)

### Support Channels

- GitHub Issues: [agent-vibes/issues](https://github.com/sourcegraph-community/agent-vibes/issues)
- Slack: `#apify-pipeline-alerts`
- Email: Platform Ops Team

---

## Appendix: Sample Test Data

### Minimal Test Payload (Quick Validation)

```json
{
  "triggerSource": "manual-test-minimal",
  "ingestion": {
    "maxItems": 10,
    "sort": "Latest"
  }
}
```

### Full Test Payload (Comprehensive)

```json
{
  "triggerSource": "manual-test-full",
  "requestedBy": "test-engineer",
  "ingestion": {
    "tweetLanguage": "en",
    "sort": "Top",
    "maxItems": 100,
    "cooldownSeconds": 10,
    "minimumEngagement": {
      "retweets": 5,
      "favorites": 10
    }
  },
  "metadata": {
    "testRun": true,
    "environment": "local",
    "timestamp": "2025-09-30T17:11:00Z"
  }
}
```

### Expected Vercel Cron Payload

```json
{
  "triggerSource": "vercel-cron",
  "ingestion": {
    "sort": "Top",
    "maxItems": 200
  }
}
```

---

**Time to First Success:** ~10 minutes with existing external accounts  
**Confidence Level:** High — components validated end-to-end  
**Last Validated:** October 27, 2025
