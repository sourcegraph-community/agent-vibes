# Date-Based Tweet Collection Strategy

**Document Owner:** Engineering Team  
**Last Updated:** October 1, 2025  
**Related Documents:** [Local Testing Guide](local-testing-guide.md), [Specification](specification.md)

---

## Overview

The Apify Pipeline uses a **date-based collection strategy** to efficiently fetch tweets incrementally from Twitter. Instead of collecting all tweets every time, the system tracks the last collected date for each keyword and only fetches tweets posted after that date.

## How It Works

### 1. Last Collected Date Tracking

The system tracks the most recent `collected_at` timestamp across **all** tweets:

```sql
-- Query to find the last collected date
SELECT MAX(collected_at) as last_collected_at
FROM normalized_tweets;
```

### 2. Date Range Calculation

When a collection run starts:

1. **Query Database**: Fetch the most recent `collected_at` timestamp
2. **Calculate Since Date**: 
   - If any tweets exist → use that date (e.g., '2025-09-29')
   - If no tweets exist → use default lookback (7 days ago)
3. **Apply to All Keywords**: Use the same `sinceDate` for all keywords

### 3. Apify Actor Integration

The calculated `sinceDate` is passed to the Apify Twitter Search Scraper for all keywords:

```typescript
{
  searchTerms: ['AI agents', 'LLM', 'coding assistants', 'developer tools'],
  sinceDate: '2025-09-29',  // YYYY-MM-DD format - same for all keywords
  maxItems: 200,
  sort: 'Top'
}
```

**Why use a single date for all keywords?**
- Only 4 keywords total, no need for per-keyword tracking
- Simpler logic, fewer database queries
- All keywords stay in sync

## Configuration

### Default Settings

```typescript
{
  useDateFiltering: true,        // Enable/disable date-based filtering
  defaultLookbackDays: 7,        // Days to look back for new keywords
  maxItemsPerKeyword: 200,       // Max tweets per keyword
  keywordBatchSize: 5            // Keywords processed per batch
}
```

### Disable Date Filtering

To collect all tweets regardless of date (not recommended for production):

```bash
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Content-Type: application/json" \
  -d '{
    "triggerSource": "manual",
    "ingestion": {
      "useDateFiltering": false,
      "maxItemsPerKeyword": 100
    }
  }'
```

### Custom Lookback Period

For a new keyword or backfill scenario:

```bash
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Content-Type: application/json" \
  -d '{
    "triggerSource": "manual",
    "ingestion": {
      "useDateFiltering": true,
      "defaultLookbackDays": 14,
      "maxItemsPerKeyword": 500
    }
  }'
```

## Benefits

### 1. Reduced API Costs
- Only fetches new tweets since last collection
- Avoids re-processing duplicate content
- Efficient use of Apify compute units

### 2. Faster Collection
- Smaller result sets
- Quicker processing times
- Lower database load

### 3. Predictable Behavior
- Consistent incremental updates
- No duplicate tweets (enforced by unique constraint)
- Clear audit trail via `cron_runs` table

## Collection Strategies by Use Case

### Regular Collection (Every 2 Hours)

**Recommended Settings:**
```json
{
  "useDateFiltering": true,
  "defaultLookbackDays": 7,
  "maxItemsPerKeyword": 200,
  "sort": "Top"
}
```

**Behavior:**
- First run for new keyword: fetches last 7 days
- Subsequent runs: fetches tweets since last collection
- Captures high-engagement content first

### Real-Time Monitoring

**Recommended Settings:**
```json
{
  "useDateFiltering": true,
  "defaultLookbackDays": 1,
  "maxItemsPerKeyword": 50,
  "sort": "Latest"
}
```

**Behavior:**
- Focuses on recent tweets
- Lower compute cost per run
- Suitable for frequent collection (every 30 min)

### Historical Backfill

**Recommended Settings:**
```json
{
  "useDateFiltering": false,
  "maxItemsPerKeyword": 1000,
  "sort": "Top"
}
```

**Behavior:**
- Ignores date filtering
- Fetches maximum allowed tweets
- Use backfill workflow instead (see [Local Testing Guide](local-testing-guide.md#workflow-1-backfill-historical-data-manual-only))

## Implementation Details

### Database Schema

**Migration:** `20251001_1630_AddCollectedAtIndex.sql`

```sql
-- Create index on collected_at for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_normalized_tweets_collected_at 
  ON normalized_tweets(collected_at DESC);
```

This index ensures the `MAX(collected_at)` query is fast.

### Code Components

| Component | File | Purpose |
|-----------|------|---------|
| **Repository** | [NormalizedTweetsRepository.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/DataAccess/Repositories/NormalizedTweetsRepository.ts) | `getLastCollectedDate()` - fetches most recent collected_at |
| **Command Schema** | [StartApifyRunCommand.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Web/Application/Commands/StartApifyRun/StartApifyRunCommand.ts) | Validation for date filtering config |
| **Twitter Scraper** | [twitterScraper.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/ExternalServices/Apify/twitterScraper.ts) | Passes `sinceDate` to Apify actor |
| **Background Job** | [TweetCollectorJob.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Background/Jobs/TweetCollector/TweetCollectorJob.ts) | Fetches last collected date once, applies to all keywords |

## Monitoring

### Check Last Collected Date

```sql
-- View the most recent collected date (used for all keywords)
SELECT MAX(collected_at) as last_collected_at
FROM normalized_tweets;

-- Or with more details
SELECT 
  collected_at,
  platform_id,
  author_handle,
  keyword_snapshot
FROM normalized_tweets
ORDER BY collected_at DESC
LIMIT 1;
```

### Verify Date Filtering in Runs

```sql
-- Check recent runs with date filtering metadata
SELECT 
  id,
  trigger_source,
  started_at,
  status,
  processed_new_count,
  metadata->>'useDateFiltering' as use_date_filtering,
  metadata->>'defaultLookbackDays' as lookback_days
FROM cron_runs
ORDER BY started_at DESC
LIMIT 10;
```

### Apify Run Logs

Check Apify Console logs for date filter confirmation:

```
Using date filter for collection {
  lastCollectedAt: '2025-09-29T15:30:00.000Z',
  sinceDate: '2025-09-29',
  keywords: ['AI agents', 'LLM', 'coding assistants', 'developer tools']
}
```

## Troubleshooting

### Issue: Missing Recent Tweets

**Symptom:** Tweets from today are not appearing in dashboard

**Possible Causes:**
1. Collection hasn't run recently
2. Tweets don't match keyword criteria
3. Duplicate detection filtering them out

**Solution:**
```sql
-- Check last collection time
SELECT MAX(collected_at) FROM normalized_tweets;

-- Manually trigger collection
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Content-Type: application/json" \
  -d '{"triggerSource": "manual"}'
```

### Issue: Too Many Duplicates

**Symptom:** `processed_duplicate_count` very high, few new tweets

**Possible Causes:**
1. Collection frequency too high (running more than once per hour)
2. Not enough new tweets matching keywords since last run
3. Apify scraper returning same results

**Solution:**
```sql
-- Check last collection time
SELECT MAX(collected_at) FROM normalized_tweets;

-- Reduce collection frequency (e.g., every 2-4 hours instead of hourly)
-- Or verify tweets are actually new
```

### Issue: No Tweets for New Keyword

**Symptom:** New keyword added but no tweets collected

**Possible Causes:**
1. Keyword not enabled in database
2. No tweets match the keyword in lookback period
3. Default lookback too short

**Solution:**
```sql
-- Verify keyword status
SELECT id, keyword, enabled FROM keywords WHERE keyword = 'new keyword';

-- Manually trigger with longer lookback
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Content-Type: application/json" \
  -d '{
    "ingestion": {
      "defaultLookbackDays": 30
    }
  }'
```

## Best Practices

1. **Default Lookback**: Keep at 7 days to balance coverage and cost
2. **Collection Frequency**: Run every 2-4 hours for regular monitoring
3. **New Keywords**: Manually trigger with 14-30 day lookback after adding
4. **Monitoring**: Set up alerts if no new tweets collected for >24 hours
5. **Date Filtering**: Keep enabled unless doing historical backfill
6. **Batch Size**: Use 5 keywords per batch to avoid rate limits

---

**Related Documents:**
- [Local Testing Guide](local-testing-guide.md) - Testing date-based collection
- [Specification](specification.md) - Overall system architecture
- [Operational Runbook](../../src/ApifyPipeline/Docs/ApifyPipeline-start-apify-run-runbook.md) - Production operations
