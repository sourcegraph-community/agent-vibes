# Incident Response Runbook

## Overview

This runbook provides step-by-step procedures for responding to common production incidents in the Apify Pipeline.

## Quick Reference

| Incident Type | Severity | Response Time | Page |
|--------------|----------|---------------|------|
| Apify Rate Limit / Ban | High | 15 minutes | [Link](#incident-1-apify-rate-limit--ban) |
| Supabase Storage Full | High | 30 minutes | [Link](#incident-2-supabase-storage-full) |
| Gemini API Quota Exhaustion | Medium | 1 hour | [Link](#incident-3-gemini-api-quota-exhaustion) |
| Vercel Cron Failures | Medium | 1 hour | [Link](#incident-4-vercel-cron-failures) |
| Sentiment Processing Backlog | Low | 4 hours | [Link](#incident-5-sentiment-processing-backlog) |
| Database Connection Pool Exhaustion | High | 15 minutes | [Link](#incident-6-database-connection-pool-exhaustion) |

---

## Incident 1: Apify Rate Limit / Ban

### Symptoms
- Consecutive Apify Actor run failures (≥3)
- Error messages containing "rate limit", "anti-monitoring", or "429"
- Duplicate rate approaching 100% (no new tweets collected)
- Apify console shows blocked runs

### Detection
- Vercel cron failure alerts
- Apify email notifications
- Dashboard shows stale data (no updates >2 hours)

### Severity: HIGH
**Impact:** No new data collection, pipeline stalled

### Immediate Response (0-15 minutes)

#### Step 1: Pause Automated Runs
```bash
# Option A: Disable Vercel cron in vercel.json
# Comment out the cron configuration:
# {
#   "crons": [
#     // {
#     //   "path": "/api/start-apify-run",
#     //   "schedule": "0 */2 * * *"
#     // }
#   ]
# }

# Then deploy:
vercel --prod

# Option B: Pause via Vercel Dashboard
# Navigate to: https://vercel.com/[TEAM]/[PROJECT]/settings/crons
# Click "Pause" on the affected cron job
```

#### Step 2: Verify Current Status
```bash
# Check Apify console for recent runs
open "https://console.apify.com/actors/[ACTOR_ID]/runs"

# Check database for last successful run
psql -h db.xxx.supabase.co -U postgres -d postgres -c "
  select started_at, finished_at, status, processed_new_count
  from cron_runs
  order by started_at desc
  limit 5;"
```

#### Step 3: Notify Stakeholders
```bash
# Post to Slack
# Channel: #apify-pipeline-alerts
# Message template:
🚨 INCIDENT: Apify rate limit detected
- Status: Automated runs paused
- Last successful run: [TIMESTAMP]
- ETA to resolution: 1-2 hours
- Action: Manual trigger only until resolved
```

### Investigation (15-30 minutes)

#### Check Run Frequency
```sql
-- Review run intervals over last 24 hours
select
  started_at,
  extract(epoch from (started_at - lag(started_at) over (order by started_at))) / 60 as pause_minutes,
  status,
  processed_new_count,
  processed_duplicate_count
from cron_runs
where started_at >= now() - interval '24 hours'
order by started_at desc;
```

**Analysis:**
- ✅ Pause ≥5 minutes between runs: Compliant
- ⚠️ Pause <5 minutes: Rate limit violation
- ❌ >5 simultaneous queries: Batch limit exceeded

#### Check Query Configuration
```typescript
// Review TweetCollectorJob configuration
// File: src/ApifyPipeline/Background/Jobs/TweetCollector/TweetCollectorJob.ts

// Verify:
// - Keywords batch ≤5
// - maxItems ≤200 per keyword
// - sort preference (Top is safer than Latest)
```

#### Review Apify Actor Logs
1. Navigate to Apify Console: https://console.apify.com/actors/[ACTOR_ID]/runs
2. Click latest failed run
3. Check "Log" tab for specific error messages
4. Note any anti-monitoring warnings

### Resolution Steps (30-90 minutes)

#### Option A: Increase Cooldown Period
```typescript
// Update vercel.json
{
  "crons": [
    {
      "path": "/api/start-apify-run",
      "schedule": "0 */4 * * *"  // Changed from */2 to */4 (4-hour intervals)
    }
  ]
}
```

#### Option B: Reduce Query Batch Size
```typescript
// Update src/ApifyPipeline/Background/Jobs/TweetCollector/TweetCollectorJob.ts
const BATCH_SIZE = 3; // Reduced from 5 to 3

// Update keyword query
const { data: keywords } = await this.supabase
  .from('keywords')
  .select('keyword')
  .eq('is_enabled', true)
  .limit(BATCH_SIZE); // Apply batch limit
```

#### Option C: Switch to Manual Trigger Mode
```bash
# Disable cron entirely
# Keep API endpoint for manual invocation only

# Manual trigger via API:
curl -X POST https://your-app.vercel.app/api/start-apify-run \
  -H "x-api-key: $INTERNAL_API_KEY"

# Space manual triggers ≥15 minutes apart
```

### Recovery Validation (90-120 minutes)

#### Step 1: Wait Cooldown Period
```
Recommended wait: 1-2 hours from last failed run
```

#### Step 2: Test with Minimal Configuration
```bash
# Test single keyword, low maxItems
curl -X POST "https://api.apify.com/v2/acts/[ACTOR_ID]/runs" \
  -H "Authorization: Bearer $APIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "searchTerms": ["cursor"],
      "maxItems": 10,
      "tweetLanguage": "en",
      "sort": "Top"
    }
  }'

# Monitor run in Apify console
```

#### Step 3: Gradually Resume Operations
1. First run: 1 keyword, maxItems=10
2. Wait 15 minutes
3. Second run: 2 keywords, maxItems=25
4. Wait 30 minutes
5. Third run: 3 keywords, maxItems=50
6. Monitor duplicate rate and errors
7. Resume normal schedule if stable (4-6 hour intervals initially)

### Post-Incident Actions

#### Update Configuration
```bash
# Document new rate limit thresholds
# File: src/ApifyPipeline/Docs/ApifyPipeline-ingestion-runbook.md

# Add to configuration:
# - Max queries per run: 3 (reduced from 5)
# - Cooldown period: 4 hours (increased from 2)
# - maxItems per keyword: 100 (reduced from 200)
```

#### Incident Report
```markdown
# Incident Report: Apify Rate Limit

**Date:** [YYYY-MM-DD]
**Duration:** [X hours]
**Impact:** Pipeline stalled for [X hours], no new data collected

**Root Cause:**
- [Frequency too high / Batch size too large / Other]

**Resolution:**
- [Increased cooldown / Reduced batch size / Other]

**Preventive Measures:**
- Updated cron schedule to 4-hour intervals
- Reduced query batch size to 3 keywords max
- Added monitoring alert for pause duration <10 minutes

**Action Items:**
- [ ] Update documentation
- [ ] Review rate limits quarterly
- [ ] Consider X API Pro subscription (eliminates scraper limits)
```

---

## Incident 2: Supabase Storage Full

### Symptoms
- Storage usage ≥90% in Supabase Dashboard
- Insert errors with "disk full" or "quota exceeded"
- Slow query performance
- Backup failures

### Detection
- Supabase dashboard alert
- Failed insert operations in logs
- Monitoring query reports high usage

### Severity: HIGH
**Impact:** Cannot store new data, pipeline blocked

### Immediate Response (0-15 minutes)

#### Step 1: Check Current Storage
```bash
# Navigate to Supabase Dashboard
open "https://supabase.com/dashboard/project/[PROJECT_ID]/settings/billing"

# Or query directly:
psql -h db.xxx.supabase.co -U postgres -d postgres -c "
  select
    pg_size_pretty(pg_database_size('postgres')) as total_size,
    pg_database_size('postgres') as bytes;"
```

#### Step 2: Identify Largest Tables
```sql
select
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as bytes
from pg_tables
where schemaname = 'public'
order by bytes desc
limit 10;
```

#### Step 3: Pause Ingestion (Temporary)
```bash
# Pause Vercel cron to prevent new inserts
# Navigate to: https://vercel.com/[TEAM]/[PROJECT]/settings/crons
# Click "Pause" on data collection cron
```

### Investigation (15-30 minutes)

#### Check Raw Tweets Retention Compliance
```sql
-- Count tweets older than 90 days
select
  count(*) as old_tweets,
  pg_size_pretty(sum(pg_column_size(payload))::bigint) as payload_size
from raw_tweets
where created_at < now() - interval '90 days';
```

#### Estimate Cleanup Impact
```sql
-- Estimate storage recovery
with old_data as (
  select
    'raw_tweets' as table_name,
    count(*) as rows,
    pg_size_pretty(sum(pg_column_size(payload))::bigint) as size
  from raw_tweets
  where created_at < now() - interval '90 days'
  union all
  select
    'sentiment_failures',
    count(*),
    pg_size_pretty(sum(pg_column_size(error_message))::bigint)
  from sentiment_failures
  where last_attempt_at < now() - interval '90 days'
)
select * from old_data;
```

### Resolution Steps (30-60 minutes)

#### Option A: Execute Retention Policy (Free/Pro Tier)
```bash
# Clean up old raw tweets
npm run cleanup:raw-tweets

# Clean up old sentiment failures
npm run cleanup:sentiment-failures

# Clean up old backfill batches
npm run cleanup:backfill-batches

# Reclaim storage
psql -h db.xxx.supabase.co -U postgres -d postgres -c "
  vacuum full raw_tweets;
  vacuum full sentiment_failures;
  vacuum full backfill_batches;"
```

**Expected Recovery:** 30-50% storage reduction

#### Option B: Upgrade Plan (Persistent High Usage)
```bash
# Current limits:
# - Free: 500 MB
# - Pro: 8 GB
# - Team/Enterprise: Custom

# Upgrade via Supabase Dashboard:
open "https://supabase.com/dashboard/project/[PROJECT_ID]/settings/billing"

# Click "Upgrade" and select Pro plan
```

#### Option C: Archive to External Storage
```bash
# Export old raw tweets to S3 before deletion
npm run archive:raw-tweets -- --retention-days=90

# This will:
# 1. Export tweets older than 90 days to S3
# 2. Verify upload success
# 3. Delete local copies
# 4. Update metadata with archive location
```

### Recovery Validation (60-90 minutes)

#### Step 1: Verify Storage Reduction
```sql
select
  pg_size_pretty(pg_database_size('postgres')) as new_size,
  pg_size_pretty(pg_database_size('postgres') - 
    (select pg_database_size('postgres') from (values (1)) as t(x))) as freed_space;
```

#### Step 2: Test Insert Operations
```bash
# Try manual tweet insertion
npm run test:insert-tweet

# Expected: Success with no quota errors
```

#### Step 3: Resume Operations
```bash
# Unpause Vercel cron
# Navigate to: https://vercel.com/[TEAM]/[PROJECT]/settings/crons
# Click "Resume" on data collection cron
```

### Post-Incident Actions

#### Enable Automated Cleanup
```sql
-- Schedule weekly cleanup via pg_cron
select cron.schedule(
  'cleanup-raw-tweets-weekly',
  '0 2 * * 0',  -- Sundays at 2 AM UTC
  $$
    delete from raw_tweets
    where created_at < now() - interval '90 days'
    limit 5000;  -- Batch to avoid locks
  $$
);
```

#### Set Up Storage Alerts
```bash
# Add to monitoring script (scripts/health-check.sh)
STORAGE_PCT=$(psql -h db.xxx.supabase.co -U postgres -t -c "
  select round(pg_database_size('postgres')::numeric / (500 * 1024 * 1024) * 100, 1);")

if [ "$STORAGE_PCT" -gt 80 ]; then
  echo "⚠️ Storage at ${STORAGE_PCT}% - cleanup recommended"
fi
```

---

## Incident 3: Gemini API Quota Exhaustion

### Symptoms
- High failure rate in `sentiment_failures` table
- Error messages: "quota exceeded", "rate limit", "429"
- Growing backlog of `pending_sentiment` tweets
- Sentiment processing endpoint timing out

### Detection
- Monitoring query shows >20% failure rate
- Dashboard sentiment data stale (>4 hours old)
- Gemini API usage dashboard shows quota hit

### Severity: MEDIUM
**Impact:** No new sentiment analysis, backlog grows

### Immediate Response (0-15 minutes)

#### Step 1: Check Current Quota Usage
```bash
# Navigate to Google Cloud Console
open "https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas"

# Look for:
# - Requests per minute (RPM): 15 (free tier)
# - Requests per day (RPD): 1500 (free tier)
# - Tokens per minute: varies by model
```

#### Step 2: Verify Rate Limiting Active
```typescript
// Check src/ApifyPipeline/ExternalServices/Gemini/GeminiClient.ts
// Ensure rate limiting is configured:
// - Delay between requests: 4000ms (15 RPM)
// - Exponential backoff on errors
```

#### Step 3: Check Pending Backlog
```sql
select
  count(*) as pending_count,
  min(collected_at) as oldest,
  max(collected_at) as newest
from normalized_tweets
where status = 'pending_sentiment';
```

### Investigation (15-30 minutes)

#### Analyze Processing Rate
```sql
-- Sentiment processing over last 24 hours
select
  date_trunc('hour', processed_at) as hour,
  count(*) as total_processed,
  count(*) filter (where sentiment_label is not null) as successful,
  count(*) filter (where sentiment_label is null) as failed
from tweet_sentiments
where processed_at >= now() - interval '24 hours'
group by hour
order by hour desc;
```

#### Check for Rate Limit Violations
```sql
-- Recent failures with quota-related errors
select
  error_message,
  count(*) as occurrence_count
from sentiment_failures
where last_attempt_at >= now() - interval '6 hours'
  and error_message ilike '%quota%'
   or error_message ilike '%rate%'
   or error_message ilike '%429%'
group by error_message;
```

### Resolution Steps (30-90 minutes)

#### Option A: Wait for Quota Reset (Free Tier)
```bash
# Free tier quotas reset:
# - RPM: Every minute
# - RPD: Midnight Pacific Time

# Calculate time until reset:
date -u -d "tomorrow 08:00" +%s  # 08:00 UTC = 00:00 PT

# Meanwhile, pause sentiment processing:
# Comment out Vercel cron in vercel.json:
# {
#   "path": "/api/process-sentiments",
#   "schedule": "*/30 * * * *"
# }
```

#### Option B: Reduce Processing Rate
```typescript
// Update src/ApifyPipeline/Core/Services/SentimentProcessor.ts
const RATE_LIMIT_DELAY_MS = 6000; // Increase from 4000ms to 6000ms (10 RPM)
const BATCH_SIZE = 5; // Reduce from 10 to 5
```

#### Option C: Upgrade to Paid Tier
```bash
# Navigate to Google AI Studio
open "https://aistudio.google.com/app/apikey"

# Or Google Cloud Console for enterprise
open "https://console.cloud.google.com/billing"

# Paid tier limits:
# - RPM: 1000+
# - RPD: Unlimited (pay per request)
# - Cost: ~$0.10 per 1M tokens (gemini-2.0-flash-exp)
```

### Recovery Validation (90-120 minutes)

#### Step 1: Test Single Request
```bash
# Manual test via replay script
npm run replay:sentiments -- --limit=1 --dry-run

# Expected: Success without quota errors
```

#### Step 2: Process Backlog Gradually
```bash
# Process in small batches
for i in {1..5}; do
  echo "Processing batch $i..."
  npm run replay:sentiments -- --limit=10
  sleep 300  # 5 minute pause between batches
done
```

#### Step 3: Resume Automated Processing
```bash
# Unpause Vercel cron
vercel --prod
```

### Post-Incident Actions

#### Update Rate Limiting
```typescript
// Increase safety margin in GeminiClient.ts
const SAFETY_MARGIN = 0.8; // Use 80% of quota to prevent hits
const RATE_LIMIT_DELAY_MS = Math.ceil(60000 / (15 * SAFETY_MARGIN)); // ~5s delay
```

#### Implement Quota Monitoring
```typescript
// Add to monitoring script
async function checkGeminiQuota() {
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1/models',
    { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } }
  );
  
  const remaining = response.headers.get('x-ratelimit-remaining');
  if (parseInt(remaining) < 100) {
    console.warn(`⚠️ Gemini quota low: ${remaining} requests remaining`);
  }
}
```

---

## Incident 4: Vercel Cron Failures

### Symptoms
- Cron jobs not executing at scheduled times
- "Execution failed" status in Vercel dashboard
- Missing entries in `cron_runs` table
- Function timeout errors (>10 seconds)
- Authentication failures in logs

### Detection
- Vercel dashboard shows failed executions
- Missing cron_runs records for expected schedule
- Dashboard data stale (>2 hours for sentiments, >6 hours for backfill)
- Monitoring alerts for consecutive failures

### Severity: MEDIUM
**Impact:** No automated data collection/processing, manual triggers required

### Immediate Response (0-15 minutes)

#### Step 1: Check Vercel Cron Dashboard
```bash
# Navigate to Vercel Cron Dashboard
open "https://vercel.com/[TEAM]/[PROJECT]/settings/crons"

# Check for:
# - Failed executions (red status)
# - Last successful execution time
# - Error messages in logs
```

#### Step 2: Verify Cron Configuration
```bash
# Check vercel.json for correct configuration
cat vercel.json

# Expected:
# {
#   "crons": [
#     { "path": "/api/process-sentiments", "schedule": "*/30 * * * *" },
#     { "path": "/api/process-backfill", "schedule": "0 */6 * * *" }
#   ]
# }
```

#### Step 3: Test Manual Trigger
```bash
# Test endpoints manually
curl -X POST https://your-app.vercel.app/api/process-sentiments \
  -H "x-vercel-cron-signature: test"

curl -X POST https://your-app.vercel.app/api/process-backfill \
  -H "x-vercel-cron-signature: test"

# Check response codes and error messages
```

#### Step 4: Notify Stakeholders
```bash
# Post to Slack
# Channel: #apify-pipeline-alerts
🚨 INCIDENT: Vercel Cron failures detected
- Status: Investigating cron execution failures
- Last successful run: [TIMESTAMP]
- Manual triggers available as workaround
- ETA to resolution: 30-60 minutes
```

### Investigation (15-45 minutes)

#### Check Function Logs
```bash
# Navigate to Vercel Logs
open "https://vercel.com/[TEAM]/[PROJECT]/logs"

# Filter by:
# - Function: /api/process-sentiments or /api/process-backfill
# - Time range: Last 24 hours
# - Status: Error

# Look for:
# - Timeout errors (>10s execution)
# - Authentication failures
# - Database connection errors
# - Memory/CPU limits exceeded
```

#### Analyze Error Patterns
```sql
-- Check for pattern in cron_runs errors
select
  trigger_source,
  status,
  errors,
  started_at,
  finished_at,
  extract(epoch from (finished_at - started_at)) as duration_seconds
from cron_runs
where started_at >= now() - interval '24 hours'
  and status in ('failed', 'partial_success')
order by started_at desc;
```

#### Verify Environment Variables
```bash
# Check required environment variables in Vercel
vercel env ls

# Required variables:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - GEMINI_API_KEY
# - INTERNAL_API_KEY (optional)
# - APIFY_TOKEN
# - APIFY_ACTOR_ID
```

#### Check Vercel Plan Limits
```bash
# Navigate to Vercel Usage
open "https://vercel.com/[TEAM]/settings/usage"

# Check:
# - Function invocations remaining
# - Function duration limits
# - Cron jobs quota (Pro plan: unlimited)
```

### Resolution Steps (45-90 minutes)

#### Option A: Fix Timeout Issues
```typescript
// If function timing out, optimize processing
// File: ProcessSentimentsEndpoint.ts or ProcessBackfillEndpoint.ts

// Add timeout handling
const TIMEOUT_MS = 9000; // 9 seconds (leave 1s buffer)

const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Function timeout')), TIMEOUT_MS)
);

try {
  await Promise.race([
    job.processBatch(nextBatch.id),
    timeoutPromise
  ]);
} catch (err) {
  if (err.message === 'Function timeout') {
    // Mark batch as pending, will retry next cron
    await job.updateBatchStatus(batchId, 'pending', {
      note: 'Timeout - will retry next cron'
    });
  }
}
```

#### Option B: Fix Authentication Issues
```typescript
// If authentication failing, check headers
// File: auth.ts

export function authenticateRequest(request: NextRequest): string | null {
  // Add logging for debugging
  console.log('Auth headers:', {
    cronHeader: request.headers.get('x-vercel-cron-signature'),
    apiKey: request.headers.get('x-api-key') ? 'present' : 'missing',
  });

  const cronHeader = request.headers.get('x-vercel-cron-signature');
  if (cronHeader) {
    return null; // Authenticated via Vercel Cron
  }

  // ... rest of auth logic
}
```

#### Option C: Fix Environment Variable Issues
```bash
# Re-add missing environment variables
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste value when prompted

# Redeploy to apply changes
vercel --prod
```

#### Option D: Increase Function Timeout (Pro Plan)
```typescript
// Add to route configuration
// File: app/api/process-backfill/route.ts

export const maxDuration = 30; // 30 seconds (Pro plan)

// Or in vercel.json
{
  "functions": {
    "app/api/process-backfill/route.ts": {
      "maxDuration": 30
    }
  }
}
```

### Recovery Validation (90-120 minutes)

#### Step 1: Wait for Next Scheduled Execution
```bash
# Calculate next cron execution time
# Sentiments: Every 30 minutes (e.g., 14:00, 14:30, 15:00)
# Backfill: Every 6 hours (e.g., 00:00, 06:00, 12:00, 18:00)

# Monitor Vercel dashboard for successful execution
```

#### Step 2: Verify Database Updates
```sql
-- Check for new cron_runs entries
select
  started_at,
  finished_at,
  status,
  trigger_source,
  processed_new_count
from cron_runs
order by started_at desc
limit 5;
```

#### Step 3: Monitor for Consecutive Successes
```bash
# Watch next 3 cron executions
# Expected: All succeed with status 'succeeded'
# If failures persist, escalate to Platform team
```

### Post-Incident Actions

#### Update Monitoring
```typescript
// Add health check endpoint
// File: app/api/health-check/route.ts

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/src/ApifyPipeline/Infrastructure/Config/supabase';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Check database connectivity
    const { error } = await supabase.from('cron_runs').select('id').limit(1);
    if (error) throw error;
    
    // Check last cron run
    const { data: lastRun } = await supabase
      .from('cron_runs')
      .select('started_at, status')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    
    const hoursSinceLastRun = lastRun 
      ? (Date.now() - new Date(lastRun.started_at).getTime()) / 1000 / 60 / 60
      : 999;
    
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      lastCronRun: lastRun?.started_at,
      hoursSinceLastRun,
      alert: hoursSinceLastRun > 7 ? 'Cron may be failing' : 'OK',
    });
  } catch (err) {
    return NextResponse.json(
      { status: 'unhealthy', error: (err as Error).message },
      { status: 503 }
    );
  }
}
```

#### Document Root Cause
```markdown
# Incident Report: Vercel Cron Failure

**Date:** [YYYY-MM-DD]
**Duration:** [X hours]
**Impact:** No automated processing for [X hours]

**Root Cause:**
- [Function timeout / Auth failure / Env var missing / Other]

**Resolution:**
- [Optimized processing / Fixed auth / Re-added env vars / Other]

**Preventive Measures:**
- Added health check endpoint
- Configured function timeout monitoring
- Improved error logging
- Added retry logic for transient failures

**Action Items:**
- [ ] Review function execution times weekly
- [ ] Set up alerts for consecutive cron failures
- [ ] Document maximum expected execution time
- [ ] Consider splitting long-running operations
```

---

## Incident 5: Sentiment Processing Backlog

### Symptoms
- High number of tweets in `pending_sentiment` status (>200)
- `sentiment_failures` table growing rapidly
- Dashboard sentiment data stale (>6 hours old)
- Processing rate slower than ingestion rate

### Detection
- Monitoring query shows large pending count
- Alert threshold exceeded (>100 pending tweets)
- Dashboard shows gaps in sentiment data
- User reports missing sentiment scores

### Severity: LOW
**Impact:** Delayed sentiment analysis, no immediate data loss

### Immediate Response (0-30 minutes)

#### Step 1: Check Pending Backlog Size
```sql
-- Count pending tweets
select
  count(*) as pending_count,
  min(collected_at) as oldest_tweet,
  max(collected_at) as newest_tweet,
  extract(hours from (now() - min(collected_at))) as backlog_age_hours
from normalized_tweets
where status = 'pending_sentiment';
```

#### Step 2: Check Processing Rate
```sql
-- Recent sentiment processing rate
select
  date_trunc('hour', processed_at) as hour,
  count(*) as processed_count
from tweet_sentiments
where processed_at >= now() - interval '6 hours'
group by hour
order by hour desc;
```

#### Step 3: Check for Failures
```sql
-- Recent sentiment failures
select
  error_message,
  count(*) as occurrence_count
from sentiment_failures
where last_attempt_at >= now() - interval '6 hours'
group by error_message
order by occurrence_count desc;
```

### Investigation (30-60 minutes)

#### Identify Bottleneck

**Option 1: Gemini Rate Limit**
```bash
# Check if hitting rate limits (15 RPM free tier)
# Look for 429 errors in sentiment_failures
```

**Option 2: Processing Too Slow**
```typescript
// Check RATE_LIMIT_DELAY_MS in SentimentProcessor.ts
// Current: 4000ms = 15 RPM
// If processing slower, may need optimization
```

**Option 3: High Ingestion Rate**
```sql
-- Compare ingestion vs processing rates
with ingestion as (
  select count(*) as ingested
  from normalized_tweets
  where collected_at >= now() - interval '24 hours'
),
processing as (
  select count(*) as processed
  from tweet_sentiments
  where processed_at >= now() - interval '24 hours'
)
select
  ingestion.ingested,
  processing.processed,
  ingestion.ingested - processing.processed as backlog_growth
from ingestion, processing;
```

### Resolution Steps (60-120 minutes)

#### Option A: Manual Catch-Up Processing
```bash
# Process backlog in batches
npm run replay:sentiments -- --limit=100

# Wait 5 minutes between batches to respect rate limits
# Repeat until backlog under control
```

#### Option B: Increase Processing Frequency
```json
// Update vercel.json
{
  "crons": [
    {
      "path": "/api/process-sentiments",
      "schedule": "*/15 * * * *"  // Changed from */30 to */15
    }
  ]
}
```

#### Option C: Reduce Ingestion Rate
```bash
# Temporarily reduce tweet collection frequency
# Update vercel.json or pause ingestion cron
# Give sentiment processing time to catch up
```

#### Option D: Upgrade Gemini Tier
```bash
# If consistently hitting rate limits
# Upgrade to paid tier: 1000+ RPM
open "https://aistudio.google.com/app/apikey"
```

### Recovery Validation

#### Monitor Backlog Reduction
```sql
-- Track backlog over time
select
  date_trunc('hour', now()) as check_time,
  count(*) as pending_count
from normalized_tweets
where status = 'pending_sentiment';

-- Run every hour, should see declining trend
```

#### Target Metrics
- Backlog under 100 tweets
- Processing rate >= ingestion rate
- Oldest pending tweet <6 hours old

### Post-Incident Actions

#### Adjust Processing Configuration
```typescript
// Consider batch size optimization
// File: ProcessSentimentsCommand.ts

const batchSize = 20; // Increase from 10 to 20
// Processes faster but uses more quota
```

#### Add Backlog Monitoring
```sql
-- Add to monitoring queries
-- Alert if backlog >200 for >4 hours
```

---

## Incident 6: Database Connection Pool Exhaustion

### Symptoms
- "Too many connections" errors in logs
- Slow query performance
- Function timeouts
- Failed database operations
- Error: "remaining connection slots reserved"

### Detection
- Supabase dashboard shows high connection usage (>80%)
- Application errors mentioning connections
- Increased function execution times
- Connection timeout errors

### Severity: HIGH
**Impact:** Pipeline blocked, cannot read/write data

### Immediate Response (0-15 minutes)

#### Step 1: Check Connection Pool Usage
```sql
-- Run in Supabase SQL Editor
select
  count(*) as active_connections,
  max_conn as max_connections,
  round(count(*)::numeric / max_conn * 100, 2) as usage_pct
from pg_stat_activity
cross join (select setting::int as max_conn from pg_settings where name = 'max_connections') as s
group by max_conn;
```

#### Step 2: Identify Connection Sources
```sql
-- Find queries holding connections
select
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query,
  state_change
from pg_stat_activity
where state != 'idle'
order by state_change;
```

#### Step 3: Check for Connection Leaks
```sql
-- Long-running transactions
select
  pid,
  now() - xact_start as duration,
  query,
  state
from pg_stat_activity
where xact_start is not null
  and now() - xact_start > interval '5 minutes'
order by duration desc;
```

### Investigation (15-45 minutes)

#### Check Supabase Client Usage
```typescript
// Review: src/ApifyPipeline/Infrastructure/Config/supabase.ts

// ✅ CORRECT: Create client per request
export async function createSupabaseServerClient() {
  const cookies = await cookieStore();
  return createServerClient(/* ... */);
}

// ❌ INCORRECT: Reusing single client across requests
// const supabase = createClient(/* ... */); // DON'T DO THIS
// export { supabase }; // This causes connection leaks
```

#### Identify Connection Leaks
```typescript
// Common causes:
// 1. Not closing clients after use
// 2. Reusing same client instance
// 3. Transactions not committed/rolled back
// 4. Long-running queries without timeout
```

#### Check for Runaway Queries
```sql
-- Kill long-running queries if necessary
-- (ONLY in emergency, may cause data inconsistency)
select pg_terminate_backend(pid)
from pg_stat_activity
where state != 'idle'
  and now() - state_change > interval '10 minutes';
```

### Resolution Steps (45-90 minutes)

#### Option A: Fix Connection Leaks
```typescript
// Ensure proper client lifecycle
// File: Any endpoint using Supabase

export async function POST(request: NextRequest) {
  let supabase;
  try {
    // ✅ Create client for this request
    supabase = await createSupabaseServerClient();
    
    // Use client
    const { data, error } = await supabase.from('table').select();
    
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error }, { status: 500 });
  }
  // ✅ Client automatically closed when function ends
}
```

#### Option B: Add Connection Pooling
```typescript
// Use Supabase Pooler for connection management
// Connection string format:
// postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

// Update SUPABASE_URL to use pooler
const supabaseUrl = process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_URL;
```

#### Option C: Optimize Query Patterns
```typescript
// Batch operations to reduce connections
// File: BackfillProcessorJob.ts

// ❌ INCORRECT: Multiple separate queries
for (const keyword of keywords) {
  await supabase.from('keywords').select().eq('keyword', keyword);
}

// ✅ CORRECT: Single batched query
await supabase.from('keywords').select().in('keyword', keywords);
```

#### Option D: Upgrade Supabase Plan
```bash
# Connection limits by plan:
# - Free: 60 connections
# - Pro: 200 connections
# - Team: 400 connections

# Upgrade if consistently hitting limits
open "https://supabase.com/dashboard/project/[PROJECT_ID]/settings/billing"
```

### Recovery Validation (90-120 minutes)

#### Step 1: Verify Connection Pool Health
```sql
-- Check connection usage dropped
select
  count(*) as active_connections,
  max_conn as max_connections,
  round(count(*)::numeric / max_conn * 100, 2) as usage_pct
from pg_stat_activity
cross join (select setting::int as max_conn from pg_settings where name = 'max_connections') as s
group by max_conn;

-- Target: usage_pct < 50%
```

#### Step 2: Test Application Functions
```bash
# Test each endpoint
curl -X POST https://your-app.vercel.app/api/process-sentiments
curl -X POST https://your-app.vercel.app/api/process-backfill

# Expected: Success with no connection errors
```

#### Step 3: Monitor for Leaks
```sql
-- Run every 5 minutes for next hour
-- Watch for connection count growth
select count(*) from pg_stat_activity where state != 'idle';
```

### Post-Incident Actions

#### Add Connection Monitoring
```typescript
// Create monitoring endpoint
// File: app/api/health-check/route.ts (add to existing)

const { data: connStats } = await supabase.rpc('get_connection_stats');

return NextResponse.json({
  connections: {
    active: connStats.active,
    max: connStats.max,
    usage_pct: connStats.usage_pct,
    alert: connStats.usage_pct > 70 ? 'High connection usage' : 'OK',
  },
});
```

#### Implement Connection Limits
```typescript
// Add connection timeout to Supabase client
// File: supabase.ts

const supabase = createServerClient(url, key, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: false, // ✅ Don't persist in serverless
  },
  global: {
    fetch: (url, options) => {
      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(10000), // ✅ 10s timeout
      });
    },
  },
});
```

#### Document Connection Best Practices
```markdown
# Supabase Connection Best Practices

1. ✅ Create new client per request (serverless)
2. ✅ Use connection pooler for high traffic
3. ✅ Set query timeouts (10s max)
4. ✅ Batch queries when possible
5. ✅ Monitor connection pool usage
6. ❌ Never reuse client across requests
7. ❌ Never create global client instance
8. ❌ Avoid long-running transactions
```

---

## General Incident Response Checklist

### Detection Phase
- [ ] Identify incident via monitoring/alerts
- [ ] Verify scope and impact
- [ ] Classify severity (High/Medium/Low)
- [ ] Notify stakeholders via Slack

### Response Phase
- [ ] Execute immediate mitigation steps
- [ ] Investigate root cause
- [ ] Apply resolution steps
- [ ] Validate recovery

### Recovery Phase
- [ ] Resume normal operations
- [ ] Monitor for recurrence
- [ ] Update documentation
- [ ] Write incident report

### Post-Mortem Phase
- [ ] Conduct team review
- [ ] Identify preventive measures
- [ ] Update runbooks and monitoring
- [ ] Schedule follow-up review

## Contact Information

**Oncall Engineer:** ops-oncall@company.com  
**Escalation:** backend-lead@company.com  
**Security:** security@company.com  
**Platform:** platform@company.com

**Emergency Phone:** +1-XXX-XXX-XXXX (24/7 hotline)

---

**Last Updated:** September 30, 2025  
**Next Drill:** October 15, 2025  
**Drill Coordinator:** Platform Operations Lead
