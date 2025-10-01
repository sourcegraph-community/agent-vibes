# Apify Pipeline - Internal Testing Quickstart

**Target Audience:** Developers with external accounts already configured  
**Time Required:** 10 minutes  
**Last Updated:** September 30, 2025

---

## Prerequisites ✅

You already have:
- ✅ Supabase project with credentials
- ✅ Apify account with API token
- ✅ Google Gemini API key
- ✅ Repository cloned locally

---

## 5-Minute Setup

### 1. Configure Environment (2 minutes)

```bash
# Copy template
cp .env.example .env.local

# Edit with your credentials
nano .env.local
```

**Fill in these values:**

```bash
# Supabase (from Dashboard → Settings → API)
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]

# Apify (from Dashboard → Settings → Integrations)
APIFY_TOKEN=[your-apify-token]
APIFY_ACTOR_ID=apify/twitter-search-scraper

# Gemini (from https://aistudio.google.com/)
GEMINI_API_KEY=[your-gemini-api-key]

# Optional: For manual API testing
INTERNAL_API_KEY=$(openssl rand -hex 32)
```

### 2. Install & Setup Database (3 minutes)

```bash
# Install dependencies
npm install

# Apply migrations - Option A: Supabase CLI (recommended)
supabase db push

# Apply migrations - Option B: Manual
# 1. Open Supabase Studio → SQL Editor
# 2. Copy/paste: src/ApifyPipeline/DataAccess/Migrations/20250929_1200_InitApifyPipeline.sql
# 3. Execute
# 4. Copy/paste: src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql
# 5. Execute
```

### 3. Validate Setup (1 minute)

```bash
# Run health check
npm run health-check
```

**Expected output:**
```
✓ Environment variables configured
✓ Supabase connection successful
✓ Database tables present
✓ Keywords configured: 10 enabled
```

### 4. Start Development Server

```bash
npm run dev
```

Visit: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

---

## Quick Test Sequence (5 minutes)

### Test 1: Tweet Collection (2 minutes)

```bash
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Content-Type: application/json" \
  -d '{
    "triggerSource": "manual-test",
    "ingestion": {
      "maxItemsPerKeyword": 20,
      "keywordBatchSize": 2,
      "sort": "Top"
    }
  }'
```

**Expected:**
- Status: `202 Accepted`
- Response contains `runId`
- Check Apify console for active run

**Wait 5-10 minutes for collection to complete**

### Test 2: Verify Data (30 seconds)

```sql
-- Run in Supabase Studio → SQL Editor
SELECT 
  cr.id,
  cr.status,
  cr.processed_new_count,
  cr.processed_duplicate_count,
  cr.started_at
FROM cron_runs cr
ORDER BY cr.started_at DESC
LIMIT 1;

-- Check tweets collected
SELECT COUNT(*) as tweet_count 
FROM normalized_tweets;
```

### Test 3: Sentiment Processing (1 minute)

```bash
curl -X POST http://localhost:3000/api/process-sentiments \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 10}'
```

**Expected:**
- Status: `200 OK`
- Response shows `processed: 10` (or fewer if less data)

### Test 4: Dashboard Verification (1 minute)

Visit pages and verify data displays:
1. [http://localhost:3000/dashboard](http://localhost:3000/dashboard) - Overview stats
2. [http://localhost:3000/dashboard/keywords](http://localhost:3000/dashboard/keywords) - Keywords list
3. [http://localhost:3000/dashboard/tweets](http://localhost:3000/dashboard/tweets) - Recent tweets

---

## Common Quick Fixes

### "Environment variable not found"
```bash
# Verify .env.local exists and has correct variable names
cat .env.local | grep -E "SUPABASE_URL|APIFY_TOKEN|GEMINI_API_KEY"

# Restart dev server after changes
```

### "No keywords available"
```sql
-- Check keywords
SELECT * FROM keywords WHERE enabled = true;

-- If empty, re-run seed script
```

### "Apify run failed"
```bash
# Check compute units in Apify dashboard
# Reduce batch size:
curl -X POST http://localhost:3000/api/start-apify-run \
  -d '{"ingestion": {"maxItemsPerKeyword": 10, "keywordBatchSize": 1}}'
```

### "Gemini quota exceeded"
```bash
# Free tier: 15 requests/minute
# Reduce batch size:
curl -X POST http://localhost:3000/api/process-sentiments \
  -d '{"batchSize": 3}'
```

---

## Data Verification Queries

Copy/paste into Supabase SQL Editor:

### Pipeline Health Check
```sql
SELECT 
  'cron_runs' as table_name,
  COUNT(*) as records,
  COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful
FROM cron_runs
UNION ALL
SELECT 
  'normalized_tweets',
  COUNT(*),
  COUNT(CASE WHEN status = 'processed' THEN 1 END)
FROM normalized_tweets
UNION ALL
SELECT 
  'tweet_sentiments',
  COUNT(*),
  COUNT(CASE WHEN sentiment_label IS NOT NULL THEN 1 END)
FROM tweet_sentiments;
```

### Recent Activity
```sql
SELECT 
  cr.trigger_source,
  cr.status,
  cr.processed_new_count as new_tweets,
  cr.started_at,
  cr.finished_at,
  (cr.finished_at - cr.started_at) as duration
FROM cron_runs cr
ORDER BY cr.started_at DESC
LIMIT 5;
```

### Sentiment Distribution
```sql
SELECT 
  sentiment_label,
  COUNT(*) as count,
  ROUND(AVG(sentiment_score)::numeric, 2) as avg_score
FROM tweet_sentiments
GROUP BY sentiment_label
ORDER BY count DESC;
```

### Top Engaged Tweets
```sql
SELECT 
  nt.text,
  nt.author_handle,
  nt.engagement_likes + nt.engagement_retweets as total_engagement,
  ts.sentiment_label,
  nt.posted_at
FROM normalized_tweets nt
LEFT JOIN tweet_sentiments ts ON ts.normalized_tweet_id = nt.id
ORDER BY (nt.engagement_likes + nt.engagement_retweets) DESC
LIMIT 10;
```

---

## Advanced Testing

### Test Backfill Workflow (Manual Only)

```bash
# 1. Enqueue backfill batches (30 days, run once)
npm run enqueue:backfill

# 2. Process batches manually (repeat 6 times)
npm run process:backfill

# OR via API:
curl -X POST http://localhost:3000/api/process-backfill \
  -H "x-api-key: $INTERNAL_API_KEY"

# 3. Check queue status between batches
# SQL:
SELECT id, start_date, end_date, status 
FROM backfill_batches 
ORDER BY created_at DESC;

# Note: Backfill is manual-only. No automated cron.
```

### Test Failed Sentiment Replay

```bash
# Replay any failed sentiment processing
npm run replay:sentiments
```

### Test Cleanup Scripts

```bash
# Clean old raw tweets (keeps last 30 days)
npm run cleanup:raw-tweets -- --dry-run
npm run cleanup:raw-tweets

# Clean old sentiment failures (keeps last 90 days)
npm run cleanup:sentiment-failures -- --max-age-days=90
```

---

## Development Commands

```bash
# Code quality
npm run check          # Typecheck + lint
npm run check:fix      # Auto-fix issues
npm test               # Run unit tests
npm run test:watch     # Watch mode

# Specific checks
npm run typecheck      # TypeScript only
npm run lint           # ESLint only
npm run lint:fix       # Auto-fix lint issues
```

---

## Environment Variable Reference

| Variable | Required | Purpose | Where to Get |
|----------|----------|---------|--------------|
| `SUPABASE_URL` | ✅ Yes | Database connection | Supabase Dashboard → API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Server DB access | Supabase Dashboard → API |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Client DB access | Same as SUPABASE_URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Client DB access | Supabase Dashboard → API |
| `APIFY_TOKEN` | ✅ Yes | Tweet collection | Apify Dashboard → Integrations |
| `APIFY_ACTOR_ID` | ✅ Yes | Actor to run | Use: `apify/twitter-search-scraper` |
| `GEMINI_API_KEY` | ✅ Yes | Sentiment analysis | Google AI Studio |
| `INTERNAL_API_KEY` | ⚠️ Optional | Manual API auth | Generate: `openssl rand -hex 32` |
| `APIFY_ACTOR_BUILD` | ❌ No | Actor version | Defaults to latest |
| `VERCEL_ENV` | ❌ No | Environment flag | Auto-set by Vercel |

---

## API Endpoint Reference

### `/api/start-apify-run` (Tweet Collection)

```bash
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Content-Type: application/json" \
  -d '{
    "triggerSource": "manual",
    "ingestion": {
      "tweetLanguage": "en",
      "sort": "Top",
      "maxItemsPerKeyword": 50,
      "keywordBatchSize": 3,
      "cooldownSeconds": 5,
      "minimumEngagement": {
        "retweets": 5,
        "favorites": 10
      }
    }
  }'
```

### `/api/process-sentiments` (Sentiment Analysis)

```bash
curl -X POST http://localhost:3000/api/process-sentiments \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 10
  }'
```

### `/api/process-backfill` (Historical Data - Manual Only)

```bash
# Process next pending batch
curl -X POST http://localhost:3000/api/process-backfill \
  -H "x-api-key: $INTERNAL_API_KEY"

# Note: No automated cron. Repeat manually for each batch.
```

---

## Troubleshooting Decision Tree

```
Issue: API returns error
├─ 401 Unauthorized
│  ├─ /api/process-backfill → Add INTERNAL_API_KEY header
│  └─ Other endpoints → Check env variables
├─ 500 Internal Server Error
│  ├─ "APIFY_TOKEN not configured" → Check .env.local
│  ├─ "GEMINI_API_KEY not configured" → Check .env.local
│  └─ "Supabase connection failed" → Verify SUPABASE_URL & key
└─ 429 Rate Limit
   ├─ Apify → Check compute units, reduce batch size
   └─ Gemini → Free tier: 15 RPM, reduce batch size

Issue: No data in database
├─ Check cron_runs table for errors
├─ Verify Apify run completed in console
└─ Check keywords table has enabled=true records

Issue: Dashboard shows no data
├─ Check if views exist (vw_daily_sentiment, vw_keyword_trends)
├─ Verify seed data was applied
└─ Check browser console for errors
```

---

## Success Criteria Checklist

After running all tests, you should have:

- [x] ✅ At least 1 successful cron_run
- [x] ✅ Tweets in normalized_tweets table
- [x] ✅ Sentiments in tweet_sentiments table
- [x] ✅ Dashboard displays stats
- [x] ✅ No console errors in browser
- [x] ✅ Health check passes

---

## Next Steps

Once local testing is successful:

1. **Review operational docs:**
   - [Operational Runbook](../../src/ApifyPipeline/Docs/ApifyPipeline-start-apify-run-runbook.md)
   - [Incident Response Guide](../../src/ApifyPipeline/Docs/incident-response-runbook.md)

2. **Prepare for deployment:**
   - Add environment variables to Vercel
   - Configure Vercel Cron jobs (requires Pro plan for <24h intervals)
   - Set up monitoring

3. **Production readiness:**
   - Enable error tracking
   - Configure alerting
   - Set up secret rotation schedule

---

## Support

- **Documentation:** [Full Testing Guide](local-testing-guide.md)
- **Readiness Check:** [Readiness Checklist](readiness-checklist.md)
- **Architecture:** [Specification](specification.md), [Overview](overview.md)

---

**Time to First Success:** ~10 minutes (accounts already configured)  
**Confidence Level:** High - All components implemented and tested  
**Last Validated:** September 30, 2025
