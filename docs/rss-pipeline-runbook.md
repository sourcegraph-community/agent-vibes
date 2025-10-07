# RSS Pipeline Runbook

**Version**: 1.0  
**Last Updated**: October 7, 2025  
**Owner**: Engineering Team

## Overview

This runbook provides troubleshooting guidance, manual intervention procedures, and emergency contacts for the RSS Pipeline system. The pipeline syncs RSS feeds from Miniflux, generates AI summaries using Ollama, and displays content in the dashboard.

**System Architecture**:
- **Miniflux**: RSS feed aggregator (external service)
- **Ollama**: LLM service for AI summarization (llama3.1:8b model)
- **Supabase**: Database for storing entries and summaries
- **Vercel Cron**: Automated job scheduling (sync every 15min, summarize every 30min)
- **Dashboard**: Next.js application displaying aggregated content

---

## 🚨 Common Failure Scenarios

### 1. No Entries Syncing (Miniflux Connection Issues)

**Symptoms**:
- Dashboard shows no new entries
- Database query shows no recent `created_at` timestamps
- Cron logs show sync failures

**Likely Causes**:
- Miniflux instance is down
- Invalid or expired `MINIFLUX_API_KEY`
- Incorrect `MINIFLUX_URL` in environment variables
- Network connectivity issues between Vercel and Miniflux
- Miniflux instance behind firewall/VPN

**Troubleshooting Steps**:

1. **Verify Miniflux is accessible**:
   ```bash
   curl https://your-miniflux-instance.com/healthcheck
   ```
   Expected: `200 OK` response

2. **Test API key authentication**:
   ```bash
   curl https://your-miniflux-instance.com/v1/me \
     -H "X-Auth-Token: your-api-key"
   ```
   Expected: JSON response with user details
   
   If 401 Unauthorized: API key is invalid or expired → [Generate new key](#regenerate-miniflux-api-key)

3. **Verify environment variables in Vercel**:
   - Navigate to Vercel Dashboard → Project → Settings → Environment Variables
   - Confirm `MINIFLUX_URL` and `MINIFLUX_API_KEY` are set
   - Check for trailing slashes in URL (should not have trailing slash)

4. **Check Vercel cron logs**:
   ```
   Vercel Dashboard → Deployments → [Latest] → Logs
   Filter: /api/rss/sync
   ```
   Look for error messages containing "Miniflux", "fetch failed", "ECONNREFUSED"

5. **Test sync endpoint manually**:
   ```bash
   curl -X POST https://your-app.vercel.app/api/rss/sync \
     -H "x-api-key: your-internal-api-key"
   ```
   Check response for specific error details

**Resolution**:
- If Miniflux is down → Restart Miniflux instance (see [Miniflux Operations](#miniflux-operations))
- If API key invalid → [Regenerate API key](#regenerate-miniflux-api-key)
- If network issue → Check firewall rules, VPN settings, or use SSH tunnel
- If environment variables missing → Add in Vercel and redeploy

---

### 2. Summaries Failing (Ollama Connection Issues)

**Symptoms**:
- Entries sync successfully but `summary_status` remains 'pending'
- Database shows high count of `summary_status = 'error'`
- Cron logs show summarization failures
- `ai_summary` field is null or contains error messages

**Likely Causes**:
- Ollama service is down or unresponsive
- Incorrect `OLLAMA_URL` in environment variables
- Ollama model (llama3.1:8b) not loaded
- Network timeout between Vercel and Ollama
- Ollama server out of memory

**Troubleshooting Steps**:

1. **Verify Ollama is running**:
   ```bash
   # SSH into Ollama server
   ssh user@ollama-vm
   
   # Check service status
   systemctl status ollama
   ```
   Expected: `active (running)`
   
   If stopped: `sudo systemctl start ollama`

2. **Test Ollama API directly**:
   ```bash
   curl http://your-ollama-vm:11434/api/tags
   ```
   Expected: JSON with model list including `llama3.1:8b`
   
   If empty or missing model:
   ```bash
   ssh user@ollama-vm
   ollama pull llama3.1:8b
   ```

3. **Test summarization locally**:
   ```bash
   curl http://your-ollama-vm:11434/api/generate -d '{
     "model": "llama3.1:8b",
     "prompt": "Summarize: Test article about AI coding assistants.",
     "stream": false
   }'
   ```
   Expected: JSON response with generated summary
   
   If timeout → Ollama is overloaded or model not loaded in memory

4. **Check Vercel environment variables**:
   - Verify `OLLAMA_URL` format: `http://ip-or-domain:11434` (no trailing slash)
   - Verify `OLLAMA_MODEL` is set to `llama3.1:8b`

5. **Review error logs in database**:
   ```sql
   SELECT entry_id, title, error_message, updated_at
   FROM rss_entries
   WHERE summary_status = 'error'
   ORDER BY updated_at DESC
   LIMIT 10;
   ```

6. **Check Vercel function timeout**:
   - Vercel Hobby plan: 10s timeout (may be insufficient)
   - Vercel Pro plan: 60s timeout (should be adequate)
   - If timeouts persist → Consider increasing batch size or upgrading Ollama VM

**Resolution**:
- If Ollama down → Restart Ollama service (see [Ollama Operations](#ollama-operations))
- If model missing → Pull llama3.1:8b model
- If timeouts → Optimize Ollama server (add GPU, increase RAM) or reduce batch size
- If persistent errors → Run [manual retry procedure](#retry-failed-summaries)

---

### 3. High Queue Depth (Ollama Performance Issues)

**Symptoms**:
- Large number of entries with `summary_status = 'pending'`
- Queue depth exceeds 200+ entries
- Summaries taking longer than 30s per entry
- Dashboard shows stale content

**Likely Causes**:
- Ollama processing too slowly (CPU-only instance)
- Large backlog of entries from new feed additions
- Batch size too large (overwhelming Ollama)
- Concurrent summarization jobs interfering

**Troubleshooting Steps**:

1. **Check current queue depth**:
   ```sql
   SELECT COUNT(*) as pending_count
   FROM rss_entries
   WHERE summary_status = 'pending';
   ```

2. **Check Ollama resource usage**:
   ```bash
   ssh user@ollama-vm
   htop  # or top
   ```
   Look for:
   - CPU usage near 100%
   - High memory usage
   - Disk I/O bottlenecks

3. **Measure average summarization time**:
   ```sql
   SELECT 
     AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
   FROM rss_entries
   WHERE summary_status = 'done'
     AND updated_at > NOW() - INTERVAL '1 hour';
   ```
   Target: < 25 seconds average

4. **Check for concurrent processing**:
   ```sql
   SELECT COUNT(*) as processing_count
   FROM rss_entries
   WHERE summary_status = 'processing';
   ```
   If > 20: Multiple jobs may be running simultaneously

**Resolution**:

1. **Immediate: Pause sync, process backlog**:
   - Temporarily comment out sync cron in `vercel.json`
   - Allow summarization cron to clear backlog
   - Monitor queue depth every 30 minutes
   - Re-enable sync once queue < 50

2. **Short-term: Optimize batch size**:
   - Edit `scripts/RssPipeline/Application/Jobs/summarizeEntries.ts`
   - Reduce `batchSize` from 20 to 10 or 5
   - Redeploy application

3. **Long-term: Scale Ollama**:
   - Upgrade to GPU-enabled VM (AWS g4dn, GCP T4, Hetzner GPU)
   - Increase RAM allocation (16GB+ recommended)
   - Consider horizontal scaling (multiple Ollama instances with load balancer)

4. **Alternative: Rate limit sync**:
   - Change sync cron from 15min to 30min or 1 hour
   - Reduces inflow rate to match processing capacity

---

### 4. Stuck Entries (Timeout Issues)

**Symptoms**:
- Entries with `summary_status = 'processing'` for extended periods (>30 minutes)
- No progress in summarization despite Ollama being healthy
- `updated_at` timestamp not changing

**Likely Causes**:
- Summarization job crashed mid-processing
- Vercel function timeout (entry claimed but not completed)
- Database transaction deadlock
- Ollama connection dropped during processing

**Troubleshooting Steps**:

1. **Identify stuck entries**:
   ```sql
   SELECT entry_id, title, summary_status, updated_at,
          EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as stuck_minutes
   FROM rss_entries
   WHERE summary_status = 'processing'
     AND updated_at < NOW() - INTERVAL '30 minutes'
   ORDER BY updated_at ASC;
   ```

2. **Check Vercel function logs for crashes**:
   ```
   Vercel Dashboard → Logs → Filter: /api/rss/summarize
   Look for: timeout errors, out-of-memory errors, unhandled exceptions
   ```

**Resolution**:

Run the [manual reset procedure](#reset-stuck-entries) to mark entries as 'pending' for retry.

---

### 5. Cron Jobs Not Running

**Symptoms**:
- No new entries for extended period (>1 hour)
- No activity in Vercel cron logs
- `vercel.json` shows cron configuration but jobs don't execute

**Likely Causes**:
- Cron configuration invalid or not deployed
- `CRON_SECRET` environment variable missing/incorrect
- Vercel plan doesn't support cron (Hobby plan has limits)
- Deployment failed or is in preview mode

**Troubleshooting Steps**:

1. **Verify cron configuration**:
   ```bash
   cat vercel.json
   ```
   Confirm `crons` array contains:
   - `{ "path": "/api/rss/sync", "schedule": "*/15 * * * *" }`
   - `{ "path": "/api/rss/summarize", "schedule": "*/30 * * * *" }`

2. **Check deployment status**:
   ```
   Vercel Dashboard → Deployments
   Ensure latest deployment is:
   - Status: Ready
   - Type: Production (not Preview)
   ```

3. **Verify CRON_SECRET is set**:
   ```
   Vercel Dashboard → Settings → Environment Variables
   Confirm CRON_SECRET exists and is set for Production
   ```

4. **Check Vercel plan limits**:
   - Hobby plan: Limited cron executions per month
   - Pro plan: Unlimited cron executions
   - Navigate to: Vercel Dashboard → Usage

5. **Test cron endpoints manually**:
   ```bash
   # Should fail with 401 if CRON_SECRET is wrong
   curl -X POST https://your-app.vercel.app/api/rss/sync \
     -H "Authorization: Bearer wrong-secret"
   
   # Should succeed with correct secret
   curl -X POST https://your-app.vercel.app/api/rss/sync \
     -H "Authorization: Bearer correct-cron-secret"
   ```

**Resolution**:
- If config missing → Add cron config to `vercel.json` and redeploy
- If secret wrong → Update `CRON_SECRET` in Vercel and redeploy
- If preview deployment → Merge to main branch to trigger production deployment
- If plan limits → Upgrade Vercel plan or reduce cron frequency

---

## 🔧 Manual Intervention Procedures

### Manually Sync Entries

When automated sync fails or you need to force an immediate sync:

```bash
# Option 1: API endpoint (requires INTERNAL_API_KEY)
curl -X POST https://your-app.vercel.app/api/rss/sync \
  -H "x-api-key: your-internal-api-key"

# Option 2: Local script (requires environment variables)
export MINIFLUX_URL="https://your-miniflux-instance.com"
export MINIFLUX_API_KEY="your-api-key"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

npm run sync-rss-entries
```

**Expected Output**:
```
✅ Sync completed
   Product Updates: 12 new entries
   Research Papers: 8 new entries
   Perspective Pieces: 5 new entries
   Total: 25 new entries
```

**Verification**:
```sql
SELECT category, COUNT(*) as count, MAX(created_at) as latest
FROM rss_entries
WHERE created_at > NOW() - INTERVAL '5 minutes'
GROUP BY category;
```

---

### Manually Trigger Summarization

When automated summarization fails or you need to process backlog immediately:

```bash
# Option 1: API endpoint (requires INTERNAL_API_KEY)
curl -X POST https://your-app.vercel.app/api/rss/summarize \
  -H "x-api-key: your-internal-api-key"

# Option 2: Local script (requires environment variables)
export OLLAMA_URL="http://your-ollama-vm:11434"
export OLLAMA_MODEL="llama3.1:8b"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

npm run summarize-rss-entries
```

**Expected Output**:
```
✅ Summaries generated
   Processed: 20 entries
   Succeeded: 18 entries
   Failed: 2 entries
   Average time: 22.4s per entry
```

**Verification**:
```sql
SELECT summary_status, COUNT(*) as count
FROM rss_entries
GROUP BY summary_status;
```

---

### Reset Stuck Entries

When entries are stuck in 'processing' status:

**Option 1: SQL Script**:
```sql
-- Reset entries stuck for more than 30 minutes
UPDATE rss_entries
SET summary_status = 'pending',
    processing_metadata = NULL
WHERE summary_status = 'processing'
  AND updated_at < NOW() - INTERVAL '30 minutes';
```

**Option 2: Custom Script** (create if needed):
```bash
npm run reset-stuck-entries
```

**After Reset**:
- Wait for next summarization cron (runs every 30min)
- Or manually trigger summarization (see above)
- Monitor for recurrence → indicates deeper Ollama timeout issue

---

### Retry Failed Summaries

When entries failed summarization and need retry:

**Option 1: Reset error status**:
```sql
-- Reset failed entries to pending (try again)
UPDATE rss_entries
SET summary_status = 'pending',
    error_message = NULL,
    processing_metadata = NULL
WHERE summary_status = 'error'
  AND created_at > NOW() - INTERVAL '24 hours';
```

**Option 2: Replay specific entries**:
```sql
-- Reset only entries with specific error pattern
UPDATE rss_entries
SET summary_status = 'pending',
    error_message = NULL
WHERE summary_status = 'error'
  AND error_message LIKE '%timeout%';
```

**After Reset**:
- Trigger manual summarization (see above)
- Monitor success rate
- If failures persist → investigate root cause (Ollama performance, model issues)

---

### Cleanup Failed Entries

Remove old failed entries to keep database clean:

**Option 1: Archive old errors**:
```sql
-- Delete failed entries older than 7 days
DELETE FROM rss_entries
WHERE summary_status = 'error'
  AND created_at < NOW() - INTERVAL '7 days';
```

**Option 2: Cleanup script** (if available):
```bash
npm run cleanup-rss-failures
```

**Best Practice**:
- Run weekly during low-traffic periods
- Keep recent failures (last 7 days) for debugging
- Log deleted entry count for metrics

---

### Regenerate Miniflux API Key

When API key is compromised or expired:

1. **Login to Miniflux**:
   ```
   Navigate to: https://your-miniflux-instance.com
   Login with admin credentials
   ```

2. **Create new API key**:
   ```
   Settings → API Keys → Create a new API key
   Copy the generated key (shown once)
   ```

3. **Update Vercel environment variables**:
   ```
   Vercel Dashboard → Settings → Environment Variables
   Edit: MINIFLUX_API_KEY
   Value: [new-api-key]
   Apply to: Production, Preview, Development
   ```

4. **Redeploy application**:
   ```bash
   git commit --allow-empty -m "Update Miniflux API key"
   git push origin main
   ```

5. **Revoke old API key**:
   ```
   Miniflux → Settings → API Keys → [old key] → Delete
   ```

---

## 📊 Monitoring and Health Checks

### Key Metrics to Monitor

| Metric | Target | Query |
|--------|--------|-------|
| **Queue Depth** | < 100 | `SELECT COUNT(*) FROM rss_entries WHERE summary_status = 'pending'` |
| **Failure Rate (24h)** | < 10% | `SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE summary_status = 'error') / COUNT(*), 2) FROM rss_entries WHERE created_at > NOW() - INTERVAL '24 hours'` |
| **Stuck Entries** | < 5 | `SELECT COUNT(*) FROM rss_entries WHERE summary_status = 'processing' AND updated_at < NOW() - INTERVAL '30 minutes'` |
| **Sync Freshness** | < 20 min | `SELECT MAX(created_at) FROM rss_entries` (should be within last 20 minutes) |
| **Avg Summary Time** | < 25s | `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) FROM rss_entries WHERE summary_status = 'done' AND updated_at > NOW() - INTERVAL '1 hour'` |

### Health Check Queries

**System Health Dashboard**:
```sql
-- Overall system status
SELECT 
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE summary_status = 'done') as completed,
  COUNT(*) FILTER (WHERE summary_status = 'pending') as pending,
  COUNT(*) FILTER (WHERE summary_status = 'processing') as processing,
  COUNT(*) FILTER (WHERE summary_status = 'error') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE summary_status = 'done') / NULLIF(COUNT(*), 0), 2) as success_rate
FROM rss_entries
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Recent Activity**:
```sql
-- Entries synced in last hour
SELECT 
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as entries_synced
FROM rss_entries
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY minute
ORDER BY minute DESC;
```

**Category Breakdown**:
```sql
-- Status by category
SELECT 
  category,
  summary_status,
  COUNT(*) as count
FROM rss_entries
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY category, summary_status
ORDER BY category, summary_status;
```

### Automated Health Check Endpoint

Create monitoring endpoint at `app/api/rss/health/route.ts`:

```typescript
export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: metrics } = await supabase.rpc('get_rss_health_metrics');
  
  const alerts = [];
  if (metrics.pending_count > 200) alerts.push('⚠️ High queue depth');
  if (metrics.failure_rate > 10) alerts.push('⚠️ High failure rate');
  if (metrics.stuck_count > 5) alerts.push('⚠️ Stuck entries detected');
  
  return Response.json({
    status: alerts.length === 0 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    metrics,
    alerts
  });
}
```

**Monitor with external service** (Better Stack, Datadog, etc.):
```bash
curl https://your-app.vercel.app/api/rss/health
```

---

## 🔧 Service Operations

### Miniflux Operations

**Restart Miniflux** (Docker):
```bash
ssh user@miniflux-vm
cd /path/to/docker-compose
docker-compose restart miniflux
docker-compose logs -f miniflux  # Monitor logs
```

**Check Miniflux Health**:
```bash
# API health check
curl https://your-miniflux-instance.com/healthcheck

# Check database connectivity
docker-compose exec miniflux miniflux -healthcheck
```

**Backup Miniflux Data**:
```bash
# Backup database
docker-compose exec db pg_dump -U miniflux miniflux > miniflux_backup_$(date +%Y%m%d).sql

# Backup config
docker-compose exec miniflux cat /etc/miniflux.conf > miniflux_config_backup.conf
```

---

### Ollama Operations

**Restart Ollama Service**:
```bash
ssh user@ollama-vm
sudo systemctl restart ollama
sudo systemctl status ollama
```

**Check Ollama Logs**:
```bash
journalctl -u ollama -f  # Follow logs
journalctl -u ollama --since "1 hour ago"  # Recent logs
```

**Verify Model Loaded**:
```bash
ollama list  # Should show llama3.1:8b
ollama show llama3.1:8b  # Model details
```

**Clear Ollama Cache** (if model misbehaving):
```bash
sudo systemctl stop ollama
rm -rf ~/.ollama/models/manifests/*
ollama pull llama3.1:8b  # Re-download model
sudo systemctl start ollama
```

**Monitor Ollama Performance**:
```bash
# Real-time resource usage
htop

# GPU usage (if GPU-enabled)
nvidia-smi -l 1

# Network connections
netstat -an | grep 11434
```

---

## 🚨 Alert Thresholds

Configure alerts in your monitoring system:

| Severity | Condition | Threshold | Action |
|----------|-----------|-----------|--------|
| 🟡 Warning | Queue Depth | > 200 | Monitor, consider manual processing |
| 🔴 Critical | Queue Depth | > 500 | Scale Ollama or pause sync immediately |
| 🟡 Warning | Failure Rate (1h) | > 10% | Investigate error logs |
| 🔴 Critical | Failure Rate (1h) | > 25% | Page on-call engineer |
| 🟡 Warning | Stuck Entries | > 5 | Run reset procedure |
| 🔴 Critical | Stuck Entries | > 20 | Check Ollama health immediately |
| 🔴 Critical | Sync Stale | > 45 min | Check Miniflux and cron jobs |
| 🔴 Critical | Ollama Down | Service unreachable | Restart Ollama service |

---

## 📞 Emergency Contacts

### Team Contacts

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| **Engineering Lead** | [Name] | [Email/Slack] | Business hours + on-call rotation |
| **DevOps/Infrastructure** | [Name] | [Email/Slack/Phone] | 24/7 for critical issues |
| **Product Owner** | [Name] | [Email/Slack] | Business hours |
| **On-Call Engineer** | [Rotation] | [PagerDuty/OpsGenie] | 24/7 |

### Escalation Path

1. **Level 1** (Minor issues, degraded performance):
   - Notify in #rss-pipeline-alerts Slack channel
   - Engineer investigates during business hours

2. **Level 2** (Service partially down, high failure rate):
   - Notify in #engineering-oncall Slack channel
   - On-call engineer responds within 30 minutes

3. **Level 3** (Complete service outage, data loss risk):
   - Page on-call engineer via PagerDuty
   - Escalate to Engineering Lead if not resolved in 1 hour

### External Service Contacts

| Service | Support | SLA | Escalation |
|---------|---------|-----|------------|
| **Vercel** | support@vercel.com | Pro: 1 hour response | Dashboard → Help → Contact Support |
| **Supabase** | support@supabase.io | Pro: 4 hour response | Dashboard → Support ticket |
| **Miniflux** | Self-hosted | N/A | Internal infrastructure team |
| **Ollama** | Self-hosted | N/A | Internal ML/infrastructure team |

---

## 🔗 Related Documentation

- **Implementation Plan**: [rss-pipeline-implementation-plan.md](rss-pipeline-implementation-plan.md)
- **Next Steps Guide**: [rss-pipeline-next-steps.md](rss-pipeline-next-steps.md)
- **Miniflux Integration**: [miniflux-integration.md](miniflux-integration.md)
- **Dashboard V2 Integration**: [dashboard-v2-integration.md](dashboard-v2-integration.md)

### External Documentation

- **Miniflux API**: https://miniflux.app/docs/api.html
- **Ollama API**: https://github.com/ollama/ollama/blob/main/docs/api.md
- **Supabase PostgreSQL**: https://supabase.com/docs/guides/database
- **Vercel Cron Jobs**: https://vercel.com/docs/cron-jobs
- **Next.js App Router**: https://nextjs.org/docs/app

### Code References

- **Sync Script**: `scripts/RssPipeline/Application/Jobs/syncEntries.ts`
- **Summarize Script**: `scripts/RssPipeline/Application/Jobs/summarizeEntries.ts`
- **API Endpoints**: `app/api/rss/*`
- **Database Schema**: `src/RssPipeline/DataAccess/Migrations/001_initial_schema.sql`
- **Miniflux Client**: `src/RssPipeline/ExternalServices/Miniflux/minifluxClient.ts`
- **Ollama Client**: `src/RssPipeline/ExternalServices/Ollama/ollamaClient.ts`

---

## 📝 Runbook Maintenance

**Review Frequency**: Monthly or after major incidents

**Update Checklist**:
- [ ] Verify all commands and queries still work
- [ ] Update contact information
- [ ] Add new failure scenarios encountered
- [ ] Update alert thresholds based on performance trends
- [ ] Review and refine troubleshooting steps
- [ ] Update external documentation links

**Change Log**:
- 2025-10-07: Initial version created
- [Add future updates here]

---

*For urgent issues outside business hours, page the on-call engineer via PagerDuty.*
