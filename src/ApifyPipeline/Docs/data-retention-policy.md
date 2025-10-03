# Data Retention Policy

## Overview

This document defines the data retention strategy for the Apify Pipeline, balancing operational needs, compliance requirements, and storage optimization.

## Retention Policies by Table

### 1. `raw_tweets`

**Retention Period:** 90 days

**Rationale:**
- Primary use: Debugging, backfills, and re-normalization
- After 90 days, normalized data is sufficient for analytics
- Largest table by storage footprint
- Not required for day-to-day operations

**Storage Impact:**
- Typical row size: 5-10 KB (JSON payload)
- Expected volume: ~10,000 tweets/week
- 90-day storage: ~40-80 MB

**Archival Strategy:**
- Option A: Delete after 90 days (simplest)
- Option B: Export to S3/GCS before deletion (recommended for backfills)
- Option C: Move to cold storage tier (if using PG partitioning)

**Implementation:**
```sql
-- Manual cleanup (run monthly)
delete from raw_tweets
where created_at < now() - interval '90 days';
```

**Automated Job:** See `scripts/cleanup-old-raw-tweets.ts`

### 2. `normalized_tweets`

**Retention Period:** Indefinite (append-only)

**Rationale:**
- Core analytical dataset
- Required for sentiment analysis and reporting
- Used by dashboard queries
- Storage footprint manageable with proper indexing

**Storage Impact:**
- Typical row size: 2-3 KB
- Growth rate: ~10,000 tweets/week = ~20-30 MB/week
- Annual projection: ~1-1.5 GB

**Notes:**
- Revisions create new rows rather than updating
- Consider archiving old revisions after sentiment processing complete
- Monitor storage usage quarterly

### 3. `tweet_sentiments`

**Retention Period:** Indefinite (append-only)

**Rationale:**
- Critical for analytics and trending
- Small footprint compared to raw/normalized tables
- Required for historical trend analysis

**Storage Impact:**
- Typical row size: 500 bytes
- Linked 1:1 with normalized_tweets
- Annual projection: ~250 MB

### 4. `sentiment_failures`

**Retention Period:** 30 days after resolution

**Rationale:**
- Operational debugging only
- Should be resolved via replay script
- Can be safely deleted once tweet has successful sentiment

**Cleanup Strategy:**
```sql
-- Delete resolved failures (successful sentiment exists)
delete from sentiment_failures
where normalized_tweet_id in (
  select ts.normalized_tweet_id
  from tweet_sentiments ts
  where ts.processed_at > sentiment_failures.last_attempt_at
)
and last_attempt_at < now() - interval '30 days';

-- Delete old unresolved failures (>90 days old)
delete from sentiment_failures
where last_attempt_at < now() - interval '90 days';
```

**Automated Job:** See `scripts/cleanup-sentiment-failures.ts`

### 5. `cron_runs`

**Retention Period:** Indefinite (append-only)

**Rationale:**
- Operational metrics and billing data
- Small footprint (one row per run)
- Used for capacity planning and alerting
- Historical trend analysis

**Storage Impact:**
- Typical row size: 500 bytes
- Growth: ~1,000 runs/month = ~500 KB/month
- Annual projection: ~6 MB

**Notes:**
- Consider aggregating to monthly summaries after 1 year
- Never delete without creating summary records

### 6. `keywords`

**Retention Period:** Indefinite (configuration table)

**Rationale:**
- Active configuration, not historical data
- Tiny footprint (<1 MB)
- Required for pipeline operation

### 7. `backfill_batches`

**Retention Period:** 90 days after completion

**Rationale:**
- Operational tracking for historical backfills
- No value after backfill complete and validated
- Cleanup frees up metadata storage

**Cleanup Strategy:**
```sql
-- Delete completed backfill batches older than 90 days
delete from backfill_batches
where status in ('completed', 'failed')
  and updated_at < now() - interval '90 days';
```

## Archival Procedures

### Export to External Storage

For compliance or historical analysis, raw tweets can be exported before deletion:

```sql
-- Export raw tweets to JSON (run via psql or Supabase SQL Editor)
copy (
  select
    id,
    platform,
    platform_id,
    collected_at,
    payload,
    created_at
  from raw_tweets
  where created_at < now() - interval '90 days'
) to '/tmp/raw_tweets_archive.json';
```

**Storage Targets:**
- AWS S3: Cost-effective, integrates with Supabase via extensions
- Google Cloud Storage: Natural fit if using Gemini API
- Supabase Storage: Managed option, check quota limits

### Archival Script

See `scripts/archive-old-raw-tweets.ts` for automated S3 upload implementation.

## Compliance Considerations

### Data Deletion Requests

Per GDPR/CCPA compliance:

```sql
-- Delete all data for specific tweet/user
delete from sentiment_failures where normalized_tweet_id in (
  select id from normalized_tweets where platform_id = '<TWEET_ID>'
);
delete from tweet_sentiments where normalized_tweet_id in (
  select id from normalized_tweets where platform_id = '<TWEET_ID>'
);
delete from normalized_tweets where platform_id = '<TWEET_ID>';
delete from raw_tweets where platform_id = '<TWEET_ID>';
```

**Process:**
1. Verify deletion request legitimacy
2. Record deletion in audit log
3. Execute deletion SQL (append-only triggers will block, requires admin override)
4. Confirm deletion with requestor

### Legal Hold

If data subject to legal hold:
- Do NOT execute retention policies
- Tag records in metadata field: `{"legal_hold": true}`
- Document hold request and expiration
- Resume retention after hold lifted

## Monitoring Retention Compliance

### Storage Growth Dashboard

```sql
-- Table sizes over time
select
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as bytes
from pg_tables
where schemaname = 'public'
  and tablename in ('raw_tweets', 'normalized_tweets', 'tweet_sentiments', 'cron_runs', 'backfill_batches', 'sentiment_failures')
order by bytes desc;
```

### Retention Policy Audit

```sql
-- Check for data older than retention period
select
  'raw_tweets' as table_name,
  count(*) as rows_exceeding_retention
from raw_tweets
where created_at < now() - interval '90 days'
union all
select
  'sentiment_failures',
  count(*)
from sentiment_failures
where last_attempt_at < now() - interval '90 days'
union all
select
  'backfill_batches',
  count(*)
from backfill_batches
where status in ('completed', 'failed')
  and updated_at < now() - interval '90 days';
```

## Automated Cleanup Schedule

### Weekly Cleanup (Supabase pg_cron)

```sql
-- Run every Sunday at 2 AM UTC
select cron.schedule(
  'cleanup-sentiment-failures',
  '0 2 * * 0',
  $$
    delete from sentiment_failures
    where normalized_tweet_id in (
      select normalized_tweet_id
      from tweet_sentiments
      where processed_at > sentiment_failures.last_attempt_at
    )
    and last_attempt_at < now() - interval '30 days';
  $$
);
```

### Monthly Cleanup

```sql
-- Run first day of month at 3 AM UTC
select cron.schedule(
  'cleanup-raw-tweets',
  '0 3 1 * *',
  $$
    delete from raw_tweets
    where created_at < now() - interval '90 days'
    limit 10000; -- Batch to avoid long locks
  $$
);

select cron.schedule(
  'cleanup-backfill-batches',
  '0 3 1 * *',
  $$
    delete from backfill_batches
    where status in ('completed', 'failed')
      and updated_at < now() - interval '90 days';
  $$
);
```

## Manual Cleanup Scripts

### Immediate Cleanup (Emergency)

```bash
# Force cleanup raw tweets older than 90 days
npm run cleanup:raw-tweets

# Cleanup resolved sentiment failures
npm run cleanup:sentiment-failures

# Cleanup old backfill batches
npm run cleanup:backfill-batches
```

### Dry Run (Preview)

```bash
# Show what would be deleted without executing
npm run cleanup:raw-tweets -- --dry-run
npm run cleanup:sentiment-failures -- --dry-run
npm run cleanup:backfill-batches -- --dry-run
```

## Storage Optimization

### Vacuum and Analyze

After large deletions, reclaim space:

```sql
-- Reclaim storage from deleted rows
vacuum full raw_tweets;
vacuum full sentiment_failures;
vacuum full backfill_batches;

-- Update query planner statistics
analyze raw_tweets;
analyze sentiment_failures;
analyze backfill_batches;
```

**Note:** `VACUUM FULL` requires exclusive lock and can take time. Run during maintenance window.

### Index Maintenance

```sql
-- Rebuild indexes for optimal performance
reindex table raw_tweets;
reindex table sentiment_failures;
reindex table backfill_batches;
```

## Disaster Recovery

### Backup Before Deletion

Always verify backups exist before executing retention policies:

```bash
# Check latest Supabase backup
# Navigate to: https://supabase.com/dashboard/project/[PROJECT_ID]/settings/backup

# Alternatively, create manual backup via pg_dump
pg_dump -h db.xxx.supabase.co -U postgres -t raw_tweets > raw_tweets_backup.sql
```

### Restore from Archive

If archived data needed:

```bash
# Restore from S3 archive
aws s3 cp s3://your-bucket/raw_tweets_archive_2025-01.json.gz - | \
  gunzip | \
  psql -h db.xxx.supabase.co -U postgres -c "COPY raw_tweets FROM STDIN CSV HEADER"
```

## Review Schedule

- **Monthly:** Review storage usage and retention compliance
- **Quarterly:** Audit retention policy effectiveness
- **Annually:** Update policy based on usage patterns and compliance changes

---

**Policy Version:** 1.0  
**Effective Date:** September 30, 2025  
**Next Review:** December 30, 2025  
**Owner:** Data Governance Team  
**Approved By:** Platform Operations Lead
