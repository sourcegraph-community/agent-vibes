# Monitoring & Alerting Guide (Milestone 5)

## Overview

This guide documents monitoring configurations, alert channels, and runbooks for the Apify Pipeline production operations.

## Monitoring Dashboards

### 1. Supabase Dashboard

**URL:** https://supabase.com/dashboard/project/[PROJECT_ID]

**Key Metrics to Monitor:**
- **Database**: Storage usage, connection pool, query performance
- **Edge Functions**: Invocation count, error rate, cold starts
- **API**: Request rate, response times, error codes
- **Realtime**: Channel usage, message quotas (if enabled)

**Critical Thresholds:**
- Storage: >80% capacity (Free: 500MB, Pro: 8GB)
- Connection pool: >80% connections used
- Edge Functions: Error rate >5%
- API: P95 latency >500ms

**Access Instructions:**
1. Navigate to Supabase Dashboard
2. Select project from organization
3. View relevant tabs: Database, API, Edge Functions

### 2. Apify Console

**URL:** https://console.apify.com/actors/[ACTOR_ID]/runs

**Key Metrics to Monitor:**
- **Run Status**: Success/failure rate
- **Duration**: Average run time, outliers
- **Resource Usage**: Compute units consumed
- **Rate Limits**: Run frequency, cooldown compliance

**Critical Thresholds:**
- Failure rate: >20% consecutive failures
- Run duration: >10 minutes (investigate timeout)
- Cooldown violations: Runs <5 minutes apart
- Query count: >5 simultaneous queries

**Access Instructions:**
1. Log into Apify Console
2. Navigate to Actors → [Your Actor]
3. View Runs tab for historical data
4. Check Settings → Monitoring for alerts

### 3. Vercel Dashboard

**URL:** https://vercel.com/[TEAM]/[PROJECT]

**Key Metrics to Monitor:**
- **Deployments**: Build status, deployment frequency
- **Functions**: Invocation count, execution duration, errors
- **Cron Jobs**: Execution history, failures
- **Analytics**: Request traffic, error rates

**Critical Thresholds:**
- Cron failures: ≥2 consecutive failures
- Function errors: >5% error rate
- Function duration: >10s (near timeout)
- Build failures: Any failed deployment

**Access Instructions:**
1. Log into Vercel Dashboard
2. Select project from team
3. View Analytics, Deployments, and Cron tabs

## Alert Channels

### Slack Integration

**Channel:** `#apify-pipeline-alerts`

**Alert Types:**
- ⚠️ **Warning**: High resource usage, slow queries
- 🚨 **Critical**: Service failures, data inconsistencies
- ✅ **Resolution**: Issue resolved notifications

**Configuration:**
```bash
# Set Slack webhook URL in environment variables
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
```

### Email Notifications

**Recipients:**
- Primary: ops-team@company.com
- Secondary: backend-oncall@company.com

**Alert Types:**
- Critical failures (immediate)
- Daily summary reports (8 AM UTC)
- Weekly trend analysis (Monday 8 AM UTC)

## Key Performance Indicators (KPIs)

### Pipeline Health

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Cron success rate | >95% | <90% | <80% |
| Tweet processing latency | <30s | >60s | >120s |
| Sentiment processing rate | >85% | <75% | <60% |
| Duplicate rate | <30% | >50% | >70% |
| API error rate | <2% | >5% | >10% |

### Resource Usage

| Resource | Target | Warning | Critical |
|----------|--------|---------|----------|
| Supabase storage | <60% | >80% | >90% |
| Database connections | <50% | >70% | >85% |
| Apify compute units | <75% plan | >85% | >95% |
| Vercel function duration | <5s | >8s | >10s |

### Data Quality

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Missing sentiment scores | <5% | >10% | >20% |
| Failed sentiment retries | <10 | >50 | >100 |
| Null metadata fields | <2% | >5% | >15% |
| Orphaned records | 0 | >10 | >50 |

## Monitoring Queries

### Daily Pipeline Statistics

```sql
-- Run in Supabase SQL Editor
select
  date_trunc('day', started_at) as run_date,
  count(*) as total_runs,
  sum(case when status = 'succeeded' then 1 else 0 end) as successful_runs,
  sum(processed_new_count) as total_new_tweets,
  sum(processed_duplicate_count) as total_duplicates,
  round(avg(extract(epoch from (finished_at - started_at))), 2) as avg_duration_seconds
from cron_runs
where started_at >= now() - interval '7 days'
group by run_date
order by run_date desc;
```

### Pending Sentiment Backlog

```sql
-- Check backlog size
select
  count(*) as pending_count,
  min(collected_at) as oldest_tweet,
  max(collected_at) as newest_tweet
from normalized_tweets
where status = 'pending_sentiment';
```

### Failed Sentiment Analysis

```sql
-- Recent failures requiring attention
select
  sf.id,
  nt.platform_id,
  sf.error_message,
  sf.retry_count,
  sf.last_attempt_at
from sentiment_failures sf
join normalized_tweets nt on nt.id = sf.normalized_tweet_id
where sf.retry_count >= 3
  and sf.last_attempt_at >= now() - interval '24 hours'
order by sf.last_attempt_at desc
limit 20;
```

### Backfill Progress

```sql
-- Monitor backfill batch queue
select
  status,
  count(*) as batch_count,
  min(start_date) as earliest_date,
  max(end_date) as latest_date
from backfill_batches
group by status
order by status;
```

## Automated Monitoring Scripts

### Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh

# Check Supabase connectivity
curl -s "https://${SUPABASE_URL}/rest/v1/" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  || echo "❌ Supabase unreachable"

# Check pending backlog
PENDING=$(curl -s "https://${SUPABASE_URL}/rest/v1/normalized_tweets?status=eq.pending_sentiment&select=count" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" | jq '.[0].count')

if [ "$PENDING" -gt 100 ]; then
  echo "⚠️ High backlog: $PENDING pending tweets"
fi

# Check recent cron failures
FAILED=$(curl -s "https://${SUPABASE_URL}/rest/v1/cron_runs?status=eq.failed&started_at=gte.$(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S)&select=count" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" | jq '.[0].count')

if [ "$FAILED" -gt 0 ]; then
  echo "🚨 Recent cron failures: $FAILED"
fi
```

## Incident Response Procedures

### 1. Apify Rate Limit / Ban Scenario

**Symptoms:**
- Consecutive Apify run failures
- Error messages mentioning rate limits or anti-monitoring
- Duplicate rate approaching 100%

**Immediate Actions:**
1. Pause Vercel cron job in vercel.json or via dashboard
2. Increase cooldown between runs (currently 5 minutes minimum)
3. Reduce query batch size (currently max 5 queries)
4. Switch to manual trigger mode for controlled testing

**Investigation Steps:**
```bash
# Check recent Apify run logs
# Navigate to: https://console.apify.com/actors/[ACTOR_ID]/runs

# Review run frequency
select
  started_at,
  finished_at,
  extract(epoch from (finished_at - started_at)) as duration_seconds,
  extract(epoch from (started_at - lag(started_at) over (order by started_at))) as pause_minutes / 60
from cron_runs
where started_at >= now() - interval '24 hours'
order by started_at desc;
```

**Recovery Steps:**
1. Wait minimum 1 hour cooldown period
2. Test single keyword run with maxItems=10
3. Gradually increase frequency (start with 15-minute intervals)
4. Monitor duplicate rate and error logs
5. Resume normal operations once stable

### 2. Supabase Storage Limit

**Symptoms:**
- Storage usage >80% in dashboard
- Insert failures with storage-related errors
- Slow query performance

**Immediate Actions:**
1. Check current usage in Supabase Dashboard → Database → Usage
2. Identify largest tables with storage query
3. Archive or delete old `raw_tweets` data per retention policy

**Investigation Query:**
```sql
-- Check table sizes
select
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
from pg_tables
where schemaname = 'public'
order by pg_total_relation_size(schemaname||'.'||tablename) desc;
```

**Recovery Steps:**
1. Execute retention policy (see Data Retention section)
2. Consider upgrading Supabase plan if persistent
3. Implement archival to external storage (S3, GCS)

### 3. Gemini API Quota Exhaustion

**Symptoms:**
- High failure rate in `sentiment_failures` table
- Error messages mentioning quota or rate limits
- Backlog growing in `pending_sentiment` status

**Immediate Actions:**
1. Check current usage: https://console.cloud.google.com/apis/dashboard
2. Verify rate limiting is active (4-second delay between requests)
3. Reduce batch size in `/api/process-sentiments` calls

**Investigation Query:**
```sql
-- Check sentiment processing rate
select
  date_trunc('hour', processed_at) as hour,
  count(*) as sentiments_processed,
  sum(case when sentiment_label is not null then 1 else 0 end) as successful
from tweet_sentiments
where processed_at >= now() - interval '24 hours'
group by hour
order by hour desc;
```

**Recovery Steps:**
1. Wait for quota reset (daily at midnight Pacific Time)
2. Consider upgrading to paid Gemini API tier
3. Implement more aggressive rate limiting
4. Use replay script for manual processing: `npm run replay:sentiments`

## Data Retention Policy

### Raw Tweets (`raw_tweets`)

**Policy:** Retain for 90 days, then archive or delete

**Rationale:**
- Primary purpose: Debugging and backfills
- After 90 days, normalized data sufficient
- Storage optimization for free/pro tiers

**Implementation:**
```sql
-- Archive old raw tweets (manual run)
delete from raw_tweets
where created_at < now() - interval '90 days';

-- TODO: Implement scheduled job in Supabase
```

### Sentiment Failures (`sentiment_failures`)

**Policy:** Retain indefinitely until manually resolved or retry limit reached

**Rationale:**
- Contains actionable error information
- Required for manual replay operations
- Relatively small table size

**Cleanup:**
```sql
-- Clean up resolved failures (after successful replay)
delete from sentiment_failures
where normalized_tweet_id in (
  select normalized_tweet_id
  from tweet_sentiments
  where processed_at > sentiment_failures.last_attempt_at
);
```

### Cron Runs (`cron_runs`)

**Policy:** Retain all records (append-only)

**Rationale:**
- Critical for operational analytics
- Relatively small footprint
- Used for billing and capacity planning

## Runbook Checklist

### Weekly Operations Review

- [ ] Review cron success rate (target >95%)
- [ ] Check Supabase storage usage
- [ ] Verify sentiment processing backlog <100
- [ ] Review Apify compute unit consumption
- [ ] Check for any failed backfill batches
- [ ] Review Gemini API quota usage
- [ ] Verify all alerts are functioning

### Monthly Compliance Audit

- [ ] Verify secret rotation (quarterly schedule)
- [ ] Review data retention compliance
- [ ] Check for orphaned or inconsistent records
- [ ] Audit API access logs
- [ ] Verify backup and recovery procedures
- [ ] Update monitoring thresholds if needed

### Quarterly Planning

- [ ] Review capacity and plan upgrades if needed
- [ ] Rotate Supabase secret keys (`npm run rotate:supabase`)
- [ ] Rotate Apify tokens
- [ ] Rotate Gemini API keys
- [ ] Review and update monitoring queries
- [ ] Conduct incident response drill

## Escalation Paths

### Level 1 - Automated Alerts
- Slack notifications
- Email to ops-team@company.com

### Level 2 - Oncall Engineer
- Phone/SMS for critical alerts
- Expected response time: 15 minutes
- Escalation after 30 minutes

### Level 3 - Backend Team Lead
- Escalation for unresolved Level 2 issues
- Complex architectural decisions
- Vendor escalation coordination

### Level 4 - Platform Engineering
- Infrastructure-level failures
- Supabase/Vercel outages
- Security incidents

## Contact Information

**Primary Oncall:** ops-oncall@company.com (rotate weekly)  
**Backend Lead:** backend-lead@company.com  
**Platform Engineering:** platform@company.com  
**Security Team:** security@company.com

## External Resources

- [Supabase Status](https://status.supabase.com/)
- [Vercel Status](https://www.vercel-status.com/)
- [Apify Status](https://status.apify.com/)
- [Google Cloud Status](https://status.cloud.google.com/)

---

**Last Updated:** September 30, 2025  
**Next Review:** October 30, 2025  
**Owner:** Platform Operations Team
