# Apify Pipeline - Start Apify Run Operational Runbook

Document Owner: Ops Platform Team  
Last Updated: 2025-10-03  
Primary Contact: #ops-oncall (Slack)  
Escalation: #backend-support

Note: Vercel cron jobs are currently disabled (vercel.json has no crons). Use manual triggers until re-enabled after testing.

---

## Overview

This runbook covers the operational procedure for tweet collection triggered by the internal route `/api/start-apify-run`. The endpoint starts an Apify Actor run; the Actor performs normalization/deduplication and writes to Supabase.

Key components:
- Trigger: Vercel Cron (disabled for now) or manual
- Endpoint: POST /api/start-apify-run
- External: Apify, Supabase
- Monitoring: Apify Console, Supabase cron_runs, health-check

---

## Quick Reference

### Trigger Mechanisms

- Vercel Cron (production, disabled currently)
  - Schedule (typical): Every 6 hours: `0 */6 * * *`
  - Route: POST https://<domain>/api/start-apify-run
  - Auth header: Authorization: Bearer ${CRON_SECRET} (preferred) or x-vercel-cron

- Manual (testing)
```bash
curl -X POST https://<domain-or-localhost>/api/start-apify-run \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INTERNAL_API_KEY" \
  -d '{
    "triggerSource": "manual-test",
    "ingestion": {"maxItems": 100, "useDateFiltering": false}
  }'
```

### Expected Response

Success (202 Accepted):
```json
{
  "data": {
    "runId": "abc123...",
    "actorId": "apidojo/tweet-scraper",
    "status": "RUNNING",
    "url": "https://console.apify.com/actors/.../runs/...",
    "startedAt": "2025-10-03T16:00:00.000Z"
  }
}
```

Error (401/400/500): `{ "error": "..." }`

---

## Workflow

```
Cron/Manual
   ↓
POST /api/start-apify-run (auth checked)
   ↓
StartApifyRunEndpoint → Apify Run API
   ↓
Apify Actor (TweetCollector): single-batch scrape (max 100), normalization, dedup, trigger sentiment
   ↓
Supabase (raw_tweets, normalized_tweets, cron_runs)
```

---

## Authentication & Secrets

Vercel/Server env:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- APIFY_TOKEN
- APIFY_ACTOR_ID
- CRON_SECRET (preferred for cron auth)
- INTERNAL_API_KEY (manual triggers)

Route auth behavior:
- /api/start-apify-run: Authorization: Bearer ${CRON_SECRET} OR x-vercel-cron OR x-api-key

---

## Monitoring & Verification

Success criteria:
1) Endpoint returns 202 quickly
2) Apify run succeeds (Apify Console)
3) New cron_runs row written
4) normalized_tweets increased by >0 on first runs

Useful checks (SQL):

Recent runs
```sql
SELECT started_at, finished_at, status,
       processed_new_count, processed_duplicate_count, processed_error_count,
       trigger_source
FROM cron_runs
ORDER BY started_at DESC
LIMIT 5;
```

Tweet data freshness (raw)
```sql
SELECT MAX(collected_at) AS last_raw_collected
FROM raw_tweets;
```

Tweet data freshness (normalized)
```sql
SELECT MAX(collected_at) AS last_normalized_collected
FROM normalized_tweets;
```

Duplicate rate (last 30 days)
```sql
SELECT DATE(started_at) AS day,
       ROUND(100.0 * AVG(
         CASE WHEN processed_new_count + processed_duplicate_count > 0
           THEN processed_duplicate_count::float / (processed_new_count + processed_duplicate_count)
           ELSE 0 END
       ), 2) AS avg_duplicate_pct
FROM cron_runs
WHERE started_at > NOW() - INTERVAL '30 days'
  AND status IN ('succeeded', 'partial_success')
GROUP BY day
ORDER BY day DESC;
```

---

## Troubleshooting (common)

- 401 Unauthorized: add Authorization: Bearer ${CRON_SECRET} OR x-api-key OR run via Vercel cron (x-vercel-cron)
- Apify rate limits: reduce keywordBatchSize / maxItemsPerKeyword, ensure cooldowns in Actor logs
- No new tweets: check keywords, date filtering, or duplicates
- DB failures: confirm SUPABASE_* envs; try GET /api/health-check

---

## SLA Targets (reference)

- Endpoint response time: <2s
- Run success rate: ≥95%
- Duplicate rate: 10–30% typical
- Alert on consecutive failures, high error counts

---

## References

- Endpoint: app/api/start-apify-run/route.ts
- Endpoint impl: src/ApifyPipeline/Web/Application/Commands/StartApifyRun/StartApifyRunEndpoint.ts
- Actor: src/ApifyPipeline/Background/Jobs/TweetCollector/TweetCollectorJob.ts
- Apify client: src/ApifyPipeline/ExternalServices/Apify/client.ts
- Health check: app/api/health-check/route.ts
- Testing guide: docs/apify-pipeline/local-testing-guide.md
- Spec/Overview: docs/apify-pipeline/specification.md, docs/apify-pipeline/overview.md

---

## Version History

- 2025-10-03: Align auth/response/SQL names with code; note crons disabled
- 2025-09-30: Initial version
