# Apify Pipeline - Start Apify Run Operational Runbook

**Document Owner:** Ops Platform Team  
**Last Updated:** September 30, 2025  
**Primary Contact:** `#ops-oncall` (Slack)  
**Escalation:** Backend Team via `#backend-support`

---

## Overview

This runbook covers operational procedures for the Apify Pipeline's tweet collection system, triggered by Vercel Cron calling `/api/start-apify-run`. The system fetches tweets via Apify's Twitter scraper and stores them in Supabase for sentiment analysis.

**Key Components:**
- **Trigger:** Vercel Cron (`0 */2 * * *` - every 2 hours)
- **Endpoint:** `POST /api/start-apify-run`
- **External Services:** Apify (Twitter scraper), Supabase (storage)
- **Monitoring:** Vercel Dashboard, Apify Console, Supabase `cron_runs` table

---

## Quick Reference

### Trigger Mechanism

**Vercel Cron Configuration:**
- Schedule: Every 2 hours (`0 */2 * * *`)
- Target: Production environment only
- Route: `POST https://[production-domain]/api/start-apify-run`
- Authentication: Vercel injects `x-vercel-cron` header

**Manual Trigger (Testing):**
```bash
curl -X POST https://[your-domain]/api/start-apify-run \
  -H "Content-Type: application/json" \
  -d '{
    "triggerSource": "manual",
    "keywords": ["example"],
    "ingestion": {
      "maxItemsPerKeyword": 100,
      "keywordBatchSize": 3
    }
  }'
```

### Expected Response

**Success (202 Accepted):**
```json
{
  "runId": "12345678-abcd-1234-abcd-1234567890ab",
  "message": "Tweet collection started"
}
```

**Error (400/500):**
```json
{
  "error": "Detailed error message"
}
```

---

## Workflow

```
Vercel Cron (every 2h)
    ↓
POST /api/start-apify-run (with x-vercel-cron header)
    ↓
StartApifyRunEndpoint.ts (validates request)
    ↓
TweetCollectorJob.ts (orchestrates collection)
    ↓
Apify Twitter Scraper API (fetches tweets in batches)
    ↓
Normalization & Duplicate Detection
    ↓
Supabase Persistence (cron_runs, raw_tweets, normalized_tweets)
```

---

## Authentication & Secrets

### Required Environment Variables

**Vercel Secrets:**
```bash
SUPABASE_URL              # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY # Service role key (sb_secret_*)
APIFY_TOKEN               # Apify API token
APIFY_ACTOR_ID            # Twitter scraper actor ID (default: apify/twitter-search-scraper)
```

**Verification:**
```bash
# Check if secrets are set in Vercel
vercel env ls

# Expected output should include all required variables
```

### Secret Rotation Schedule

- **Frequency:** Quarterly (Q1, Q2, Q3, Q4)
- **Process:** Run `npm run rotate:supabase`
- **Documentation:** See `scripts/rotate-supabase-secrets.ts`
- **Calendar:** Aligned with Ops rotation calendar (TBD)

**Rotation Steps:**
1. Export required environment variables
2. Run rotation script with `--dry-run` first
3. Execute actual rotation
4. Update Vercel environment variables
5. Verify endpoint functionality

---

## Monitoring & Verification

### Success Criteria Checklist

✅ **1. Vercel Cron Execution**
- Location: Vercel Dashboard → Project → Cron Jobs
- Check: Cron job shows recent successful execution
- Expected: Status "Success", response 2xx

✅ **2. API Endpoint Response**
- Check: Endpoint returns 202 within <2 seconds
- Verify: Response includes valid `runId` UUID

✅ **3. Apify Run Completion**
- Location: Apify Console → Runs
- Check: Run status = `SUCCEEDED`
- Expected: Duration 5-20 minutes depending on volume

✅ **4. Database Records**
- Check: Fresh row in `cron_runs` table
- Query:
  ```sql
  SELECT * FROM cron_runs 
  ORDER BY started_at DESC 
  LIMIT 1;
  ```
- Expected: `status` = 'succeeded' or 'partial_success'

✅ **5. Tweet Data Freshness**
- Check: New tweets in `raw_tweets` table
- Query:
  ```sql
  SELECT COUNT(*) FROM raw_tweets 
  WHERE ingested_at > NOW() - INTERVAL '3 hours';
  ```
- Expected: Count > 0

✅ **6. Dashboard Data Updates**
- Location: Application dashboard (TBD)
- Check: Sentiment data timestamp <3 hours old
- Query:
  ```sql
  SELECT * FROM vw_daily_sentiment 
  WHERE date = CURRENT_DATE;
  ```

### Key Performance Indicators (KPIs)

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Endpoint Response Time | <2s | >5s |
| Apify Run Duration | 5-20min | >30min |
| Tweet Collection Rate | >50 tweets/run | <10 tweets/run |
| Error Rate | <5% | >20% |
| Duplicate Rate | 10-30% | >70% |

### Monitoring Touchpoints

**1. Vercel Dashboard**
- URL: `https://vercel.com/dashboard/[project]/logs`
- Monitor: Function logs, cron execution history
- Alerts: Set up for consecutive failures

**2. Apify Console**
- URL: `https://console.apify.com/actors/runs`
- Monitor: Run status, duration, item counts
- Alerts: Actor failures, timeout errors

**3. Supabase Dashboard**
- URL: `https://app.supabase.com/project/[project-id]/editor`
- Monitor: `cron_runs` table status field
- Query:
  ```sql
  SELECT status, COUNT(*) 
  FROM cron_runs 
  WHERE started_at > NOW() - INTERVAL '24 hours'
  GROUP BY status;
  ```

**4. Application Logs**
- Check for errors in function execution
- Look for batch processing failures
- Monitor normalization errors

---

## Troubleshooting Guide

### Decision Tree

```
Run Failed?
├─ YES: Check error type
│   ├─ 400 Bad Request
│   │   └─ Verify request payload format
│   ├─ 401/403 Auth Error
│   │   └─ Check secret expiration
│   ├─ 500 Server Error
│   │   ├─ Check Supabase availability
│   │   └─ Check Apify API status
│   └─ Apify Run Failed
│       ├─ Rate limit exceeded → Wait cooldown
│       ├─ Actor timeout → Check Apify status
│       └─ No results → Review keyword configuration
└─ NO: Verify data quality
    ├─ Check duplicate rate
    ├─ Verify tweet count
    └─ Confirm data freshness
```

### Common Failure Scenarios

#### Scenario 1: "Apify rate limit exceeded"

**Symptoms:**
- Apify run fails with rate limit error
- Error message mentions "429 Too Many Requests"

**Root Cause:**
- Exceeded Apify concurrent request limit (max 5)
- Cooldown period not respected (min 5 minutes)

**Remediation:**
1. Check recent run history in Apify console
2. Verify `cooldownSeconds` configuration (should be ≥300)
3. Reduce `keywordBatchSize` if necessary (max 5)
4. Wait for cooldown period to expire
5. Retry manually if needed

**Prevention:**
- Ensure cron schedule respects >5min intervals
- Monitor batch size configuration
- Set up alerts for rate limit warnings

---

#### Scenario 2: "Database connection failed"

**Symptoms:**
- Endpoint returns 500 error
- Logs show Supabase connection timeout

**Root Cause:**
- Supabase service degradation
- Invalid/expired service role key
- Connection pool exhausted

**Remediation:**
1. Check Supabase status: https://status.supabase.com
2. Verify service role key in Vercel env vars
3. Check connection pool usage in Supabase dashboard
4. Restart Vercel deployment if needed:
   ```bash
   vercel --prod --force
   ```

**Prevention:**
- Set up Supabase monitoring alerts
- Regular secret rotation
- Monitor connection pool metrics

---

#### Scenario 3: "No tweets collected"

**Symptoms:**
- Run succeeds but `new_tweets_count` = 0
- No new rows in `raw_tweets` table

**Root Cause:**
- All tweets are duplicates
- Keywords not returning results
- Engagement filters too strict

**Remediation:**
1. Check duplicate rate in latest `cron_runs` row
2. Review keyword effectiveness:
   ```sql
   SELECT keyword, COUNT(*) as tweet_count
   FROM keywords k
   JOIN normalized_tweets nt ON k.keyword = ANY(nt.keywords_matched)
   WHERE nt.created_at > NOW() - INTERVAL '7 days'
   GROUP BY keyword
   ORDER BY tweet_count DESC;
   ```
3. Adjust engagement filters if too restrictive
4. Contact Analytics team for keyword review

**Prevention:**
- Regular keyword performance review
- Set alert for 3 consecutive zero-result runs
- Monitor duplicate rate trends

---

#### Scenario 4: "Partial success with high error rate"

**Symptoms:**
- Run status = 'partial_success'
- `errors` field contains multiple normalization failures

**Root Cause:**
- Apify data format changes
- Missing required fields in tweets
- Normalization logic errors

**Remediation:**
1. Inspect error details:
   ```sql
   SELECT errors 
   FROM cron_runs 
   ORDER BY started_at DESC 
   LIMIT 1;
   ```
2. Check for common error patterns
3. Verify Apify actor version hasn't changed
4. If format changed, escalate to Backend team
5. Consider temporary keyword filter to isolate issue

**Escalation Required:**
- Error rate >20%
- New error types appearing
- Apify data format changes

---

#### Scenario 5: "Secret rotation failed"

**Symptoms:**
- Authentication errors after rotation
- Old key still in use

**Root Cause:**
- Rotation script didn't update Vercel
- Environment variables not propagated
- Deployment not triggered

**Remediation:**
1. Manually verify secrets in Vercel:
   ```bash
   vercel env ls
   ```
2. Update secrets manually if needed:
   ```bash
   vercel env add SUPABASE_SERVICE_ROLE_KEY production
   ```
3. Force redeployment:
   ```bash
   vercel --prod --force
   ```
4. Test endpoint after deployment
5. Roll back to old key if needed (if kept via `--keep-old`)

**Rollback Procedure:**
1. Retrieve old key from rotation backup
2. Update Vercel environment variable
3. Force redeploy
4. Verify functionality
5. Plan new rotation attempt

---

## Incident Response Procedures

### Severity Levels

**P0 - Critical (Immediate Response)**
- Complete system outage
- Data loss or corruption
- Security breach

**P1 - High (Response within 1 hour)**
- ≥2 consecutive run failures
- Partial data pipeline failure
- Degraded performance affecting SLA

**P2 - Medium (Response within 4 hours)**
- Single run failure
- Non-critical errors
- Performance degradation <SLA

**P3 - Low (Response within 24 hours)**
- Warning conditions
- Proactive maintenance
- Documentation issues

### Response Workflow

**Step 1: Acknowledge**
- Acknowledge alert in monitoring system
- Post in `#ops-oncall` Slack channel
- Document start time

**Step 2: Assess**
- Check all monitoring touchpoints
- Determine severity level
- Identify affected components
- Review recent changes

**Step 3: Mitigate**
- Follow relevant troubleshooting scenario
- Apply immediate fixes if available
- Consider temporary workarounds

**Step 4: Escalate (if needed)**
- P0/P1: Page Backend on-call
- Provide: Error details, timestamps, attempted fixes
- Join incident bridge call

**Step 5: Resolve**
- Verify fix resolves issue
- Monitor for recurrence
- Document resolution

**Step 6: Postmortem (P0/P1 only)**
- Schedule postmortem within 48 hours
- Document timeline, root cause, action items
- Update runbook with learnings

---

## Rollback Procedures

### Scenario: Bad Deployment

**When to Rollback:**
- New deployment causing consistent failures
- Breaking changes to API contract
- Environment configuration errors

**Rollback Steps:**
1. Identify last known good deployment:
   ```bash
   vercel list
   ```

2. Promote previous deployment:
   ```bash
   vercel promote [deployment-url] --yes
   ```

3. Verify rollback:
   ```bash
   curl -X POST https://[production-domain]/api/start-apify-run \
     -H "Content-Type: application/json" \
     -d '{"triggerSource":"manual"}'
   ```

4. Monitor next scheduled cron run

5. Document rollback reason in incident log

**Note:** Rollback does not affect database state (append-only design)

### Scenario: Bad Database Migration

**When to Rollback:**
- Schema changes causing query failures
- Performance degradation after migration
- Data integrity issues

**Rollback Steps:**
1. Access Supabase SQL Editor
2. Review migration history:
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations 
   ORDER BY version DESC;
   ```

3. Execute rollback SQL (if available)
4. Verify data integrity
5. Test API endpoints
6. Monitor application logs

**Warning:** Not all migrations are reversible. Consult Backend team before rolling back schema changes.

---

## Escalation Paths

### Primary Contact: Ops On-Call

**When to Contact:**
- Any P0/P1 incidents
- Routine operational questions
- Secret rotation issues
- Monitoring alerts

**Contact Methods:**
- Slack: `#ops-oncall` (fastest)
- PagerDuty: Ops On-Call rotation
- Email: ops-oncall@[company].com

### Secondary Contact: Backend Team

**When to Contact:**
- Application code issues
- Apify actor problems
- Data normalization failures
- Schema/migration issues

**Contact Methods:**
- Slack: `#backend-support`
- PagerDuty: Backend On-Call rotation (P0 only)
- Email: backend@[company].com

### Tertiary Contact: Analytics Team

**When to Contact:**
- Keyword performance issues
- Data quality concerns
- Dashboard/reporting problems

**Contact Methods:**
- Slack: `#analytics-insights`
- Email: analytics@[company].com

---

## Operational Checklists

### Daily Operations

- [ ] Review overnight cron execution logs
- [ ] Check for any failed runs in past 24h
- [ ] Verify dashboard data freshness
- [ ] Monitor duplicate rate trends
- [ ] Review error counts in `cron_runs`

### Weekly Operations

- [ ] Review keyword performance metrics
- [ ] Analyze tweet collection trends
- [ ] Check Apify credit usage
- [ ] Review Supabase storage usage
- [ ] Verify all monitoring alerts functional

### Monthly Operations

- [ ] Secret rotation check (if due)
- [ ] Review SLA adherence
- [ ] Analyze incident trends
- [ ] Update runbook if needed
- [ ] Performance optimization review

### Quarterly Operations

- [ ] Execute secret rotation
- [ ] Disaster recovery drill
- [ ] Capacity planning review
- [ ] Cost optimization analysis
- [ ] Security audit

---

## SLA Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Endpoint Availability | 99.5% | Monthly uptime |
| Run Success Rate | 95% | Successful + Partial Success |
| Data Freshness | <3 hours | Time since last successful run |
| Response Time | <2 seconds | P95 endpoint latency |
| Error Rate | <5% | Errors per total tweets processed |

**Alert Thresholds:**
- Availability <99% → P1 Alert
- 2 consecutive failures → P1 Alert
- Data age >6 hours → P2 Alert
- Response time >5s → P2 Alert
- Error rate >20% → P1 Alert

---

## Reference Links

### Documentation
- [Implementation Plan](../../../docs/apify-pipeline/implementation-plan.md)
- [Specification](../../../docs/apify-pipeline/specification.md)
- [Overview](../../../docs/apify-pipeline/overview.md)
- [VSA Architecture Guide](~/CodeProjects/agent-docs/vsa-architecture.md)

### External Services
- [Apify Documentation](https://docs.apify.com/)
- [Apify Console](https://console.apify.com/)
- [Supabase Dashboard](https://app.supabase.com/)
- [Vercel Dashboard](https://vercel.com/dashboard)

### Internal Resources
- Secret Rotation Script: `scripts/rotate-supabase-secrets.ts`
- Migration Files: `src/ApifyPipeline/DataAccess/Migrations/`
- Seed Data: `src/ApifyPipeline/DataAccess/Seeds/`

---

## Useful SQL Queries

### Check Recent Run Status
```sql
SELECT 
  id,
  started_at,
  status,
  new_tweets_count,
  duplicate_count,
  error_count,
  trigger_source
FROM cron_runs
ORDER BY started_at DESC
LIMIT 10;
```

### Find Failed Runs
```sql
SELECT 
  started_at,
  status,
  errors
FROM cron_runs
WHERE status = 'failed'
  AND started_at > NOW() - INTERVAL '7 days'
ORDER BY started_at DESC;
```

### Check Keyword Performance
```sql
SELECT 
  k.keyword,
  k.enabled,
  COUNT(nt.id) as tweet_count,
  AVG(ts.score) as avg_sentiment
FROM keywords k
LEFT JOIN normalized_tweets nt 
  ON k.keyword = ANY(nt.keywords_matched)
LEFT JOIN tweet_sentiments ts 
  ON nt.id = ts.normalized_tweet_id
WHERE nt.created_at > NOW() - INTERVAL '7 days'
GROUP BY k.keyword, k.enabled
ORDER BY tweet_count DESC;
```

### Monitor Duplicate Rate
```sql
SELECT 
  DATE(started_at) as date,
  AVG(CASE 
    WHEN new_tweets_count + duplicate_count > 0 
    THEN duplicate_count::float / (new_tweets_count + duplicate_count) * 100
    ELSE 0 
  END) as avg_duplicate_rate_percent
FROM cron_runs
WHERE started_at > NOW() - INTERVAL '30 days'
  AND status IN ('succeeded', 'partial_success')
GROUP BY DATE(started_at)
ORDER BY date DESC;
```

### Check Data Freshness
```sql
SELECT 
  MAX(ingested_at) as last_ingestion,
  NOW() - MAX(ingested_at) as age,
  COUNT(*) as recent_tweets
FROM raw_tweets
WHERE ingested_at > NOW() - INTERVAL '6 hours';
```

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-09-30 | Initial runbook creation | Amp AI Agent |

---

## Feedback & Updates

This runbook is a living document. If you encounter scenarios not covered here or have suggestions for improvements:

1. Post in `#ops-oncall` or `#backend-support`
2. Create issue in project tracker
3. Submit PR with proposed changes

**Document Review Schedule:** Quarterly or after major incidents
