# Apify Pipeline - Local Testing Guide

**Document Owner:** Engineering Team  
**Last Updated:** September 30, 2025  
**Related Documents:** [Specification](specification.md), [Overview](overview.md), [Operational Runbook](../../src/ApifyPipeline/Docs/ApifyPipeline-start-apify-run-runbook.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Testing Workflow](#testing-workflow)
5. [Component-Level Testing](#component-level-testing)
6. [Integration Testing](#integration-testing)
7. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
8. [Data Verification](#data-verification)

---

## Overview

This guide provides step-by-step instructions for testing the Apify Pipeline locally. The pipeline consists of multiple integrated components working together to collect, process, and display social media mentions.

### Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│  Local Testing Environment                              │
│                                                          │
│  ┌────────────────┐      ┌─────────────────┐          │
│  │  Next.js App   │──────│  API Endpoints  │          │
│  │  (localhost)   │      │  /api/*         │          │
│  └────────────────┘      └─────────────────┘          │
│           │                       │                     │
│           │                       ▼                     │
│           │            ┌─────────────────────┐         │
│           │            │  Background Jobs    │         │
│           │            │  - TweetCollector   │         │
│           │            │  - SentimentProc.   │         │
│           │            └─────────────────────┘         │
│           │                       │                     │
│           ▼                       ▼                     │
│  ┌──────────────────────────────────────────┐         │
│  │         External Services                 │         │
│  │  - Supabase (Cloud)                       │         │
│  │  - Apify (Cloud)                          │         │
│  │  - Google Gemini (Cloud)                  │         │
│  └──────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **API Endpoints** | `app/api/` | REPR pattern entry points |
| **Command Handlers** | `src/ApifyPipeline/Web/Application/Commands/` | Business logic orchestration |
| **Background Jobs** | `src/ApifyPipeline/Background/Jobs/` | Tweet collection & sentiment processing |
| **Data Access** | `src/ApifyPipeline/DataAccess/` | Supabase repositories & queries |
| **External Services** | `src/ApifyPipeline/ExternalServices/` | Apify, Supabase, Gemini clients |
| **Core Logic** | `src/ApifyPipeline/Core/` | Pure business logic & transformations |
| **Dashboard** | `app/dashboard/` | Frontend visualization |

---

## Prerequisites

### Required Accounts & Access

1. **Supabase Project** (required)
   - Project URL and Service Role Key
   - Anon Key for client-side access
   - Database migrations applied

2. **Apify Account** (required for tweet collection)
   - Active account with API token
   - Access to `apify/twitter-search-scraper` actor or custom actor
   - Sufficient compute units for testing

3. **Google Gemini API** (required for sentiment analysis)
   - API key from Google AI Studio
   - Free tier provides ~15 RPM / 1.5M tokens per day

### Local Environment

- **Node.js:** 20+ (required by Next.js 15)
- **npm:** Latest version
- **Git:** For repository access
- **curl or Postman:** For API testing
- **Database client:** (optional) psql, pgAdmin, or Supabase Studio for data inspection

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

Create a `.env.local` file in the project root (this file is git-ignored):

```bash
# Quick setup: Copy the template
cp .env.example .env.local

# Then edit .env.local with your actual values
```

**Required Variables:**

```bash
# Supabase Configuration (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Apify Configuration (REQUIRED for tweet collection)
APIFY_TOKEN=your-apify-token
APIFY_ACTOR_ID=apify/twitter-search-scraper
# Optional: specify actor build
# APIFY_ACTOR_BUILD=latest

# Google Gemini Configuration (REQUIRED for sentiment analysis)
GEMINI_API_KEY=your-gemini-api-key

# API Authentication (Production Recommended)
CRON_SECRET=your-random-secret-key

# Internal API Key (RECOMMENDED for manual testing)
INTERNAL_API_KEY=your-random-secret-key

# Optional: Vercel environment indicator
# VERCEL_ENV=development
```

#### Where to Find These Values

**Supabase:**
- Dashboard → Settings → API
- `SUPABASE_URL`: "Project URL"
- `SUPABASE_SERVICE_ROLE_KEY`: "service_role secret" (⚠️ Keep secure)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: "anon public"

**Apify:**
- Dashboard → Settings → Integrations
- `APIFY_TOKEN`: "Personal API tokens"
- `APIFY_ACTOR_ID`: Use `apify/twitter-search-scraper` or your custom actor ID

**Google Gemini:**
- Visit [Google AI Studio](https://aistudio.google.com/)
- Click "Get API key" → Create new key
- `GEMINI_API_KEY`: Copy the generated key

**CRON_SECRET (Production Recommended):**
- Generate a secure random string: `openssl rand -hex 32`
- `CRON_SECRET`: Used by Vercel for cron job authentication (sent as `Authorization: Bearer` header)
- Required for: `/api/start-apify-run` when deployed to Vercel
- Vercel automatically includes this in cron requests

**Internal API Key (Optional but Recommended):**
- Generate a secure random string: `openssl rand -hex 32`
- `INTERNAL_API_KEY`: Used for authenticating manual API calls
- Required for: `/api/start-apify-run`, `/api/process-backfill`, `/api/process-sentiments` (when called manually)
- Fallback authentication method when CRON_SECRET is not available

### Step 3: Database Setup

Apply the Apify Pipeline migration to your Supabase database:

```bash
# Option 1: Using Supabase CLI (recommended)
supabase db push

# Option 2: Manual SQL execution
# 1. Open Supabase Studio → SQL Editor
# 2. Copy contents of src/ApifyPipeline/DataAccess/Migrations/20250929_1200_InitApifyPipeline.sql
# 3. Execute the SQL
# 4. Copy contents of src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql
# 5. Execute the SQL
```

**Verify Migration:**

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('keywords', 'cron_runs', 'raw_tweets', 'normalized_tweets', 'tweet_sentiments');

-- Check keywords are seeded
SELECT id, keyword, enabled FROM keywords ORDER BY created_at;
```

Expected: 5 tables present, at least 10 keywords with `enabled = true`

### Step 4: Start Development Server

```bash
npm run dev
```

The application should start at [http://localhost:3000](http://localhost:3000)

**Verify Server Start:**
- Visit [http://localhost:3000](http://localhost:3000)
- Visit [http://localhost:3000/dashboard](http://localhost:3000/dashboard) (should load without errors)

---

## Testing Workflow

### Complete End-to-End Test Sequence

This sequence tests the entire pipeline from tweet collection → normalization → sentiment analysis → dashboard display.

#### Test 1: Health Check (Baseline Verification)

```bash
# Check system health
npm run health-check
```

**Expected Output:**
```
✓ Environment variables configured
✓ Supabase connection successful
✓ Database tables present
✓ Keywords configured: 10 enabled
```

#### Test 2: Tweet Collection (Apify Integration)

**Manual API Trigger:**

```bash
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Content-Type: application/json" \
  -d '{
    "triggerSource": "manual-test",
    "ingestion": {
      "maxItemsPerKeyword": 50,
      "keywordBatchSize": 2,
      "sort": "Top",
      "cooldownSeconds": 5
    }
  }'
```

**Expected Response (202 Accepted):**
```json
{
  "data": {
    "runId": "abc123-def456-...",
    "actorId": "apify/twitter-search-scraper",
    "status": "RUNNING",
    "url": "https://console.apify.com/actors/.../runs/...",
    "startedAt": "2025-09-30T17:11:00.000Z"
  }
}
```

**Monitor Apify Run:**

1. **Via Apify Console:**
   - Open the URL from the response
   - Watch run progress (should take 5-20 minutes)
   - Verify status transitions: `RUNNING` → `SUCCEEDED`

2. **Via Database:**
   ```sql
   -- Check cron run status
   SELECT id, trigger_source, status, processed_new_count, processed_duplicate_count, processed_error_count
   FROM cron_runs 
   ORDER BY started_at DESC 
   LIMIT 1;
   ```

**Success Criteria:**
- Apify run status: `SUCCEEDED`
- Database `cron_runs.status`: `succeeded` or `partial_success`
- `processed_new_count` > 0 (for first run)
- New records in `raw_tweets` and `normalized_tweets`

#### Test 3: Data Verification

**Check Raw Tweets:**
```sql
SELECT 
  id,
  platform,
  platform_id,
  collected_at,
  jsonb_pretty(payload) as payload_preview
FROM raw_tweets
ORDER BY collected_at DESC
LIMIT 3;
```

**Check Normalized Tweets:**
```sql
SELECT 
  id,
  platform_id,
  author_handle,
  text,
  status,
  engagement_likes,
  engagement_retweets,
  keywords,
  posted_at,
  collected_at
FROM normalized_tweets
ORDER BY collected_at DESC
LIMIT 5;
```

**Expected:**
- `status` should be `pending_sentiment` for new tweets
- `keywords` array populated from request
- Engagement metrics present
- No duplicates (check `platform_id` uniqueness)

#### Test 4: Sentiment Processing

**Manual Sentiment Processing:**

```bash
curl -X POST http://localhost:3000/api/process-sentiments \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 10
  }'
```

**Expected Response (200 OK):**
```json
{
  "data": {
    "success": true,
    "stats": {
      "processed": 10,
      "failed": 0,
      "skipped": 0,
      "totalLatencyMs": 12500,
      "totalTokens": 850
    }
  }
}
```

**Verify Sentiment Results:**
```sql
-- Check sentiment processing
SELECT 
  ts.id,
  ts.sentiment_label,
  ts.sentiment_score,
  ts.summary,
  ts.model_version,
  nt.text
FROM tweet_sentiments ts
JOIN normalized_tweets nt ON ts.normalized_tweet_id = nt.id
ORDER BY ts.processed_at DESC
LIMIT 5;
```

**Expected:**
- `sentiment_label`: one of `positive`, `neutral`, `negative`
- `sentiment_score`: between -1.0 and 1.0
- `summary`: brief text summary
- `model_version`: `gemini-2.5-flash` (or configured model)

**Update Normalized Tweet Status:**
```sql
-- Verify status updated
SELECT status, COUNT(*) as count
FROM normalized_tweets
GROUP BY status;
```

**Expected:**
- `processed` count should increase
- `pending_sentiment` count should decrease

#### Test 5: Dashboard Verification

**Visit Dashboard:**
- Navigate to [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

**Check Dashboard Elements:**

1. **Overview Stats:**
   - Total Tweets
   - Average Sentiment
   - Top Keywords
   - Engagement Metrics

2. **Navigate to Keywords:**
   - [http://localhost:3000/dashboard/keywords](http://localhost:3000/dashboard/keywords)
   - Verify keyword list displays
   - Check enabled/disabled status

3. **Navigate to Tweets:**
   - [http://localhost:3000/dashboard/tweets](http://localhost:3000/dashboard/tweets)
   - Verify recent tweets display
   - Check sentiment labels render correctly
   - Verify engagement metrics visible

**Expected:**
- No console errors
- Data loads from Supabase
- Charts/visualizations render
- Filtering works (if implemented)

---

## Component-Level Testing

### Test Individual Components in Isolation

#### 1. Test Apify Client (Dry Run Mode)

```bash
# Create a test script
cat > test-apify-client.js << 'EOF'
import { startApifyActorRun } from './src/ApifyPipeline/ExternalServices/Apify/client.js';

const result = await startApifyActorRun(
  {
    triggerSource: 'test',
    ingestion: { maxItemsPerKeyword: 10 }
  },
  { dryRun: true }
);

console.log('Dry run result:', result);
EOF

# Run with Node ESM
node --input-type=module < test-apify-client.js
```

**Expected Output:**
```javascript
{
  runId: 'dryrun_2025-09-30T...',
  actorId: 'dryrun-actor',
  status: 'DRY_RUN',
  startedAt: '2025-09-30T...',
  url: 'https://console.apify.com/'
}
```

#### 2. Test Normalization Logic

```bash
npm test -- src/ApifyPipeline/Tests/Unit/Core/Transformations/normalizeTweet.test.ts
```

**Expected:**
- All unit tests pass
- Coverage includes ID extraction, field mapping, validation

#### 3. Test Supabase Connection

```typescript
// Create test-supabase.ts
import { createSupabaseServiceClient } from './src/ApifyPipeline/ExternalServices/Supabase/client';

const client = createSupabaseServiceClient();
const { data, error } = await client.from('keywords').select('count').limit(1);

if (error) {
  console.error('Supabase connection failed:', error);
  process.exit(1);
}

console.log('✓ Supabase connected successfully');
```

```bash
tsx test-supabase.ts
```

#### 4. Test Gemini Client

```typescript
// Create test-gemini.ts
import { GeminiClient } from './src/ApifyPipeline/ExternalServices/Gemini/GeminiClient';
import { getGeminiEnv } from './src/ApifyPipeline/Infrastructure/Config/env';

const env = getGeminiEnv();
const client = new GeminiClient({ apiKey: env.apiKey });

const result = await client.classifySentiment({
  text: 'This AI coding agent is amazing! It boosted my productivity significantly.',
  tweetId: 'test-123',
  authorHandle: 'test_user',
  postedAt: new Date().toISOString()
});

console.log('Sentiment result:', result);
```

```bash
tsx test-gemini.ts
```

**Expected Output:**
```javascript
{
  tweetId: 'test-123',
  sentimentLabel: 'positive',
  sentimentScore: 0.8,
  summary: 'Highly positive feedback about AI coding agent...',
  modelVersion: 'gemini-2.5-flash',
  tokensUsed: 42,
  latencyMs: 1250
}
```

---

## Integration Testing

### Test Complete Workflows

#### Workflow 1: Backfill Historical Data (Manual Only)

**Enqueue Backfill Batches (Once):**

```bash
# Enqueue 30 days of backfill in 5-day chunks (6 batches)
npm run enqueue:backfill
```

**Process Backfill Queue Manually (Repeat 6x):**

```bash
# Option 1: Via npm script
npm run process:backfill

# Option 2: Via API
curl -X POST http://localhost:3000/api/process-backfill \
  -H "x-api-key: $INTERNAL_API_KEY"
```

**Monitor Backfill Progress:**

```sql
-- Check backfill batch status
SELECT 
  id,
  start_date,
  end_date,
  status,
  keywords,
  created_at,
  updated_at
FROM backfill_batches
ORDER BY priority DESC, created_at;
```

**Expected:**
- Batches transition: `pending` → `running` → `completed`
- `metadata` contains `apifyRunId` and processing details
- No automated cron - all processing is manual
- Historical tweets appear in `normalized_tweets` with earlier `posted_at` dates

#### Workflow 2: Failed Sentiment Replay

**Simulate Failure (Optional):**
```sql
-- Manually create a failed sentiment
INSERT INTO sentiment_failures (normalized_tweet_id, error_message, retry_count, last_attempted_at)
SELECT id, 'Test failure', 1, now()
FROM normalized_tweets
WHERE status = 'pending_sentiment'
LIMIT 5;
```

**Replay Failed Sentiments:**

```bash
npm run replay:sentiments
```

**Verify Recovery:**
```sql
-- Check if failures were reprocessed
SELECT COUNT(*) FROM sentiment_failures WHERE retry_count >= 1;

-- Check if tweets now have sentiments
SELECT status, COUNT(*) FROM normalized_tweets GROUP BY status;
```

#### Workflow 3: Data Cleanup

**Clean Old Raw Tweets (Retention Testing):**

```bash
# Dry run first
npm run cleanup:raw-tweets -- --dry-run

# Actual cleanup (keeps last 30 days by default)
npm run cleanup:raw-tweets
```

**Verify Cleanup:**
```sql
-- Check oldest raw tweet
SELECT MIN(collected_at) as oldest_raw_tweet FROM raw_tweets;

-- Normalized tweets should remain intact
SELECT COUNT(*) FROM normalized_tweets;
```

**Clean Sentiment Failures:**

```bash
npm run cleanup:sentiment-failures -- --max-age-days=90
```

---

## Common Issues & Troubleshooting

### Issue 1: Missing Environment Variables

**Symptom:**
```
Error: APIFY_TOKEN and APIFY_ACTOR_ID must be configured.
```

**Solution:**
1. Verify `.env.local` exists in project root
2. Check variable names match exactly (case-sensitive)
3. Restart dev server after adding variables

**Verification:**
```bash
# Check if variables are loaded
node -e "require('dotenv').config({ path: '.env.local' }); console.log('APIFY_TOKEN:', !!process.env.APIFY_TOKEN)"
```

### Issue 2: Supabase Connection Failure

**Symptom:**
```
Failed to initialize Supabase client
Database connection timeout
```

**Solution:**
1. Verify Supabase project is active (not paused)
2. Check URL format: `https://[project-ref].supabase.co`
3. Confirm service role key is correct (not anon key)
4. Test connection manually:

```bash
curl -X GET "https://[your-project].supabase.co/rest/v1/keywords?select=id" \
  -H "apikey: your-service-role-key" \
  -H "Authorization: Bearer your-service-role-key"
```

### Issue 3: Apify Rate Limiting

**Symptom:**
```
Apify run failed with status 429
Rate limit exceeded
```

**Solution:**
1. Check Apify account compute units
2. Reduce `keywordBatchSize` (default: 5 → try 2-3)
3. Increase `cooldownSeconds` (default: 0 → try 10-15)
4. Monitor Apify console for usage limits

**Adjust Settings:**
```bash
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Content-Type: application/json" \
  -d '{
    "triggerSource": "manual",
    "ingestion": {
      "maxItemsPerKeyword": 50,
      "keywordBatchSize": 2,
      "cooldownSeconds": 15
    }
  }'
```

### Issue 4: Gemini API Quota Exhaustion

**Symptom:**
```
Error 429: Resource exhausted
Gemini API rate limit exceeded
```

**Solution:**
1. Free tier: 15 requests per minute
2. Reduce sentiment batch size:
   ```bash
   curl -X POST http://localhost:3000/api/process-sentiments \
     -d '{"batchSize": 5}'
   ```
3. Implement longer delays in production config
4. Consider upgrading to paid tier

**Check Current Usage:**
- Visit [Google AI Studio](https://aistudio.google.com/)
- Navigate to API usage dashboard

### Issue 5: Duplicate Tweet Detection Not Working

**Symptom:**
- `processed_duplicate_count` is always 0
- Same tweets appear multiple times in database

**Investigation:**
```sql
-- Find duplicates
SELECT platform_id, COUNT(*) as count
FROM normalized_tweets
GROUP BY platform_id
HAVING COUNT(*) > 1;

-- Check unique constraint
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'normalized_tweets' 
  AND indexdef LIKE '%UNIQUE%';
```

**Solution:**
- Ensure migration ran successfully
- Unique constraint on `(platform, platform_id)` must exist
- Check if Apify returns consistent ID format

### Issue 6: Dashboard Shows No Data

**Symptom:**
- Dashboard loads but displays "No data available"
- Console shows no errors

**Investigation:**
```sql
-- Check if views exist
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name IN ('vw_daily_sentiment', 'vw_keyword_trends');

-- Check view data
SELECT * FROM vw_daily_sentiment LIMIT 5;
SELECT * FROM vw_keyword_trends LIMIT 5;
```

**Solution:**
1. Verify migrations include view definitions
2. Ensure seed data was applied
3. Run manual query to test data access
4. Check Supabase RLS policies (should be disabled for service role)

---

## Data Verification

### Quality Checks

#### 1. Data Completeness Check

```sql
-- Check pipeline health
SELECT 
  'cron_runs' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_runs,
  MAX(started_at) as last_run
FROM cron_runs
UNION ALL
SELECT 
  'raw_tweets',
  COUNT(*),
  COUNT(CASE WHEN ingestion_reason = 'initial' THEN 1 END),
  MAX(collected_at)
FROM raw_tweets
UNION ALL
SELECT 
  'normalized_tweets',
  COUNT(*),
  COUNT(CASE WHEN status = 'processed' THEN 1 END),
  MAX(collected_at)
FROM normalized_tweets
UNION ALL
SELECT 
  'tweet_sentiments',
  COUNT(*),
  COUNT(CASE WHEN sentiment_label IS NOT NULL THEN 1 END),
  MAX(processed_at)
FROM tweet_sentiments;
```

#### 2. Data Consistency Check

```sql
-- Verify referential integrity
SELECT 
  'Raw → Normalized' as relationship,
  COUNT(DISTINCT rt.id) as raw_count,
  COUNT(DISTINCT nt.raw_tweet_id) as normalized_references
FROM raw_tweets rt
LEFT JOIN normalized_tweets nt ON rt.id = nt.raw_tweet_id;

-- Check orphaned sentiments
SELECT COUNT(*) as orphaned_sentiments
FROM tweet_sentiments ts
LEFT JOIN normalized_tweets nt ON ts.normalized_tweet_id = nt.id
WHERE nt.id IS NULL;
```

**Expected:**
- All relationships intact (no orphaned records)
- `normalized_references` ≈ `raw_count` (allowing for duplicates)

#### 3. Sentiment Distribution Check

```sql
-- Analyze sentiment distribution
SELECT 
  sentiment_label,
  COUNT(*) as count,
  ROUND(AVG(sentiment_score)::numeric, 3) as avg_score,
  MIN(sentiment_score) as min_score,
  MAX(sentiment_score) as max_score
FROM tweet_sentiments
GROUP BY sentiment_label
ORDER BY count DESC;
```

**Expected:**
- All three labels present (`positive`, `neutral`, `negative`)
- Reasonable distribution (not 100% one label)
- Scores align with labels (positive > 0, negative < 0)

#### 4. Timeline Consistency Check

```sql
-- Check timeline makes sense
SELECT 
  MIN(posted_at) as earliest_tweet,
  MAX(posted_at) as latest_tweet,
  MIN(collected_at) as first_collection,
  MAX(collected_at) as last_collection,
  COUNT(*) as total_tweets
FROM normalized_tweets;
```

**Expected:**
- `posted_at` dates span the backfill period + recent data
- `collected_at` dates match test execution timeline
- No future dates

---

## Next Steps

### After Successful Local Testing

1. **Review Logs:**
   - Check console output for warnings
   - Review Apify run logs for anomalies
   - Inspect Supabase logs for query performance

2. **Prepare for Production:**
   - Document any configuration adjustments needed
   - Note baseline performance metrics (latency, token usage)
   - Identify any rate limit constraints encountered

3. **Deploy to Staging/Production:**
   - Configure Vercel environment variables
   - Set up Vercel Cron jobs (requires Pro plan for <24h intervals)
   - Enable monitoring and alerting
   - Refer to [Operational Runbook](../../src/ApifyPipeline/Docs/ApifyPipeline-start-apify-run-runbook.md) for production procedures

4. **Continuous Testing:**
   - Run unit tests: `npm test`
   - Run type checking: `npm run typecheck`
   - Run linting: `npm run lint`
   - Combined checks: `npm run check`

---

## Resources

### Documentation Links

- [Apify Pipeline Specification](specification.md)
- [Architecture Overview](overview.md)
- [Operational Runbook](../../src/ApifyPipeline/Docs/ApifyPipeline-start-apify-run-runbook.md)
- [Incident Response Guide](../../src/ApifyPipeline/Docs/incident-response-runbook.md)

### External API Documentation

- [Apify API Docs](https://docs.apify.com/api/v2)
- [Supabase Docs](https://supabase.com/docs)
- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Next.js 15 Docs](https://nextjs.org/docs)

### Support Channels

- **GitHub Issues:** [agent-vibes/issues](https://github.com/sourcegraph-community/agent-vibes/issues)
- **Slack:** `#apify-pipeline-alerts` (internal)
- **Email:** Platform Ops Team

---

## Appendix: Sample Test Data

### Minimal Test Payload (Quick Validation)

```json
{
  "triggerSource": "manual-test-minimal",
  "ingestion": {
    "maxItemsPerKeyword": 10,
    "keywordBatchSize": 1,
    "sort": "Latest"
  }
}
```

### Full Test Payload (Comprehensive Testing)

```json
{
  "triggerSource": "manual-test-full",
  "requestedBy": "test-engineer",
  "ingestion": {
    "tweetLanguage": "en",
    "sort": "Top",
    "maxItemsPerKeyword": 100,
    "keywordBatchSize": 3,
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
    "maxItemsPerKeyword": 200,
    "keywordBatchSize": 5
  }
}
```

---

**End of Local Testing Guide**
