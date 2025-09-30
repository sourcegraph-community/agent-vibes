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

[Continue with similar detailed structure for remaining incidents...]

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
