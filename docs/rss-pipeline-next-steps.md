# RSS Pipeline - Parallelizable Next Steps

## Overview

The RSS Pipeline implementation is **complete** and ready for deployment. This document outlines the remaining steps to make the system fully operational, organized by independent workstreams that can be executed in parallel by different team members or agents.

---

## 🔄 Workstream 1: Database Setup & Migration

**Owner**: Database/DevOps Team  
**Dependencies**: Supabase access  
**Estimated Time**: 30 minutes

### Tasks

1. **Apply Database Migrations**
   ```bash
   # Set environment variables
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   
   # Run migration script
   npm run apply-rss-migrations
   ```

2. **Verify Schema**
   - Confirm `rss_entries` table exists
   - Verify all indexes are created
   - Test `claim_pending_summaries()` function
   - Check `set_updated_at` trigger

3. **Grant Permissions**
   - Ensure service role can read/write `rss_entries`
   - Verify RLS policies if enabled

### Success Criteria
- ✅ Migration script completes without errors
- ✅ `rss_entries` table visible in Supabase dashboard
- ✅ All 6 indexes present
- ✅ Database functions and triggers operational

---

## 🌐 Workstream 2: Miniflux Instance Setup

**Owner**: Infrastructure Team  
**Dependencies**: None (can run in parallel)  
**Estimated Time**: 1-2 hours

### Tasks

1. **Deploy Miniflux**
   - Option A: Self-hosted (Docker Compose or VM)
   - Option B: Managed service (if available)
   - Recommended: Docker on DigitalOcean/Hetzner droplet

   ```yaml
   # docker-compose.yml example
   version: '3'
   services:
     miniflux:
       image: miniflux/miniflux:latest
       ports:
         - "8080:8080"
       environment:
         - DATABASE_URL=postgres://miniflux:secret@db/miniflux
         - CREATE_ADMIN=1
         - ADMIN_USERNAME=admin
         - ADMIN_PASSWORD=changeme
     db:
       image: postgres:15-alpine
       environment:
         - POSTGRES_USER=miniflux
         - POSTGRES_PASSWORD=secret
         - POSTGRES_DB=miniflux
       volumes:
         - miniflux-db:/var/lib/postgresql/data
   volumes:
     miniflux-db:
   ```

2. **Initial Configuration**
   - Create admin account
   - Generate API key (Settings → API Keys → Create)
   - Note down `MINIFLUX_URL` and `MINIFLUX_API_KEY`

3. **Create Categories**
   - Create category: "Product Updates"
   - Create category: "Research Papers"
   - Create category: "Perspective Pieces"

### Success Criteria
- ✅ Miniflux accessible at configured URL
- ✅ API key generated and tested with curl
- ✅ Three categories created
- ✅ Instance secured (HTTPS, firewall rules)

---

## 🤖 Workstream 3: Ollama Instance Setup

**Owner**: ML/Infrastructure Team  
**Dependencies**: None (can run in parallel)  
**Estimated Time**: 1-2 hours

### Tasks

1. **Deploy Ollama Server**
   - **Recommended**: VM with GPU (AWS g4dn, GCP T4, or Hetzner GPU instance)
   - **Minimum Specs**: 8GB RAM, 20GB disk for llama3.1:8b model
   - **Alternative**: CPU-only instance (slower but functional)

   ```bash
   # Install Ollama on Ubuntu/Debian
   curl -fsSL https://ollama.com/install.sh | sh
   
   # Start Ollama service
   systemctl start ollama
   systemctl enable ollama
   
   # Pull llama3.1:8b model
   ollama pull llama3.1:8b
   
   # Verify model available
   ollama list
   ```

2. **Configure Network Access**
   - By default, Ollama listens on `localhost:11434`
   - For remote access, set environment variable:
     ```bash
     export OLLAMA_HOST=0.0.0.0:11434
     ```
   - **Security**: Use firewall rules or VPN to restrict access
   - **Alternative**: Use SSH tunnel from Vercel to Ollama VM

3. **Test Model**
   ```bash
   curl http://localhost:11434/api/generate -d '{
     "model": "llama3.1:8b",
     "prompt": "Summarize this article in 2 sentences: AI coding assistants are transforming how developers write code.",
     "stream": false
   }'
   ```

4. **Performance Tuning** (Optional)
   - Set concurrent request limit
   - Configure model cache settings
   - Monitor memory usage during batch processing

### Success Criteria
- ✅ Ollama service running and accessible
- ✅ llama3.1:8b model downloaded
- ✅ Test API call returns valid summary
- ✅ Performance acceptable (< 30s per summary)
- ✅ Network access configured securely

---

## 📝 Workstream 4: Miniflux Feed Curation

**Owner**: Content Team  
**Dependencies**: Workstream 2 (Miniflux instance)  
**Estimated Time**: 2-3 hours

### Tasks

1. **Product Update Feeds**
   - **Cursor**: `https://cursor.sh/changelog` (may need RSS discovery)
   - **GitHub Copilot**: `https://github.blog/tag/github-copilot/feed/`
   - **Cody (Sourcegraph)**: `https://sourcegraph.com/blog/feed.xml`
   - **Amp**: Check Amp blog for RSS
   - **Windsurf**: Check for changelog RSS
   - **Continue.dev**: Check for updates feed
   
   **Action**: Add each feed to Miniflux under "Product Updates" category

2. **Research Paper Feeds**
   - **arXiv AI**: `http://export.arxiv.org/rss/cs.AI` (Artificial Intelligence)
   - **arXiv ML**: `http://export.arxiv.org/rss/cs.LG` (Machine Learning)
   - **arXiv SE**: `http://export.arxiv.org/rss/cs.SE` (Software Engineering)
   - **Papers with Code**: Check for RSS feed
   - **ACL Anthology**: Check for recent papers feed
   
   **Action**: Add each feed to Miniflux under "Research Papers" category

3. **Perspective Piece Feeds**
   - **a16z**: `https://a16z.com/feed/`
   - **Sequoia Capital**: Check for blog feed
   - **Simon Willison**: `https://simonwillison.net/atom/everything/`
   - **Stratechery**: `https://stratechery.com/feed/`
   - **Developer advocates**: Curate individual blogs
   
   **Action**: Add each feed to Miniflux under "Perspective Pieces" category

4. **Feed Quality Assurance**
   - Verify each feed loads successfully
   - Check that entries have proper titles, URLs, content
   - Ensure feeds are active (recent entries)
   - Remove inactive or broken feeds

### Success Criteria
- ✅ At least 3 feeds per category (Product, Research, Perspectives)
- ✅ All feeds loading successfully in Miniflux
- ✅ Feeds organized into correct categories
- ✅ Recent entries visible for each feed

### Feed Discovery Tips
- Use browser extension "RSS Feed Finder"
- Check `<link rel="alternate" type="application/rss+xml">` in page source
- Try common paths: `/feed`, `/rss`, `/atom`, `/feed.xml`, `/rss.xml`
- Use services like `https://www.feedspot.com/` to discover feeds

---

## 🔧 Workstream 5: Environment Configuration

**Owner**: DevOps Team  
**Dependencies**: Workstreams 2 & 3 (Miniflux and Ollama URLs)  
**Estimated Time**: 15 minutes

### Tasks

1. **Update Vercel Environment Variables**
   
   Navigate to Vercel Dashboard → Project Settings → Environment Variables:
   
   ```bash
   # RSS Pipeline Configuration
   MINIFLUX_URL=https://your-miniflux-instance.com
   MINIFLUX_API_KEY=your-api-key-here
   OLLAMA_URL=http://your-ollama-vm:11434
   OLLAMA_MODEL=llama3.1:8b
   
   # Ensure existing variables are set
   CRON_SECRET=your-cron-secret
   INTERNAL_API_KEY=your-internal-api-key
   ```

2. **Verify Variable Scope**
   - Set for Production, Preview, and Development environments
   - Ensure sensitive values (API keys) are encrypted

3. **Redeploy Application**
   ```bash
   git push origin main  # Triggers automatic Vercel deployment
   ```

### Success Criteria
- ✅ All 4 RSS environment variables set in Vercel
- ✅ Deployment successful with new variables
- ✅ No environment variable errors in logs

---

## 🧪 Workstream 6: Integration Testing

**Owner**: QA/Testing Team  
**Dependencies**: All previous workstreams  
**Estimated Time**: 1 hour

### Tasks

1. **Test Manual Sync**
   ```bash
   # Set environment variables locally
   export MINIFLUX_URL="https://your-miniflux-instance.com"
   export MINIFLUX_API_KEY="your-api-key"
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   
   # Run manual sync
   npm run sync-rss-entries
   ```
   
   **Expected**: Script outputs "✅ Sync completed" with entry counts

2. **Verify Database Entries**
   ```sql
   -- Check entries were inserted
   SELECT 
     category, 
     COUNT(*) as count,
     MAX(published_at) as latest_entry
   FROM rss_entries
   GROUP BY category;
   ```
   
   **Expected**: Rows for 'product', 'research', 'perspective' with counts > 0

3. **Test Manual Summarization**
   ```bash
   export OLLAMA_URL="http://your-ollama-vm:11434"
   export OLLAMA_MODEL="llama3.1:8b"
   
   npm run summarize-rss-entries
   ```
   
   **Expected**: Script outputs "✅ Summaries generated" with success count

4. **Verify AI Summaries**
   ```sql
   -- Check summaries were generated
   SELECT 
     title,
     ai_summary,
     summary_status
   FROM rss_entries
   WHERE summary_status = 'done'
   LIMIT 5;
   ```
   
   **Expected**: Entries with non-null `ai_summary` field

5. **Test Dashboard API**
   ```bash
   # Test product updates endpoint
   curl "https://your-app.vercel.app/api/rss/entries?category=product&limit=5"
   
   # Test research papers endpoint
   curl "https://your-app.vercel.app/api/rss/entries?category=research&limit=5"
   
   # Test perspectives endpoint
   curl "https://your-app.vercel.app/api/rss/entries?category=perspective&limit=5"
   ```
   
   **Expected**: JSON responses with entry arrays

6. **Test Dashboard UI**
   - Navigate to `https://your-app.vercel.app/dashboard-v2`
   - Scroll to "Product Updates" section
   - Verify entries display with titles, sources, summaries
   - Check "Research Papers" section
   - Check "Perspective Pieces" section
   
   **Expected**: All sections show real entries (not placeholders)

7. **Test Cron Endpoints** (Manual Trigger)
   ```bash
   # Test sync endpoint
   curl -X POST "https://your-app.vercel.app/api/rss/sync" \
     -H "x-api-key: your-internal-api-key"
   
   # Test summarize endpoint
   curl -X POST "https://your-app.vercel.app/api/rss/summarize" \
     -H "x-api-key: your-internal-api-key"
   ```
   
   **Expected**: Both return 200 with success messages

### Success Criteria
- ✅ Manual sync populates database with entries
- ✅ Manual summarization generates AI summaries
- ✅ Dashboard API returns entries for all categories
- ✅ Dashboard UI displays entries correctly
- ✅ Cron endpoints respond successfully

---

## 📊 Workstream 7: Monitoring & Alerting Setup

**Owner**: DevOps/SRE Team  
**Dependencies**: Workstream 6 (system operational)  
**Estimated Time**: 1-2 hours

### Tasks

1. **Create Monitoring Dashboard**
   
   **Option A: Supabase Dashboard Queries**
   ```sql
   -- Queue depth (pending summaries)
   SELECT COUNT(*) as pending_count
   FROM rss_entries
   WHERE summary_status = 'pending';
   
   -- Failure rate (last 24 hours)
   SELECT 
     COUNT(*) FILTER (WHERE summary_status = 'error') as failed,
     COUNT(*) FILTER (WHERE summary_status = 'done') as succeeded,
     ROUND(100.0 * COUNT(*) FILTER (WHERE summary_status = 'error') / 
       NULLIF(COUNT(*), 0), 2) as failure_rate
   FROM rss_entries
   WHERE created_at > NOW() - INTERVAL '24 hours';
   
   -- Stuck entries (processing > 30 min)
   SELECT COUNT(*) as stuck_count
   FROM rss_entries
   WHERE summary_status = 'processing'
     AND updated_at < NOW() - INTERVAL '30 minutes';
   ```

2. **Set Up Alerts** (Choose monitoring platform)
   
   **Option A: Vercel Monitoring**
   - Configure error rate alerts for `/api/rss/*` endpoints
   - Set up notification channel (email/Slack)
   
   **Option B: Custom Health Check Endpoint**
   ```typescript
   // app/api/rss/health/route.ts
   export async function GET() {
     const metrics = await getRssMetrics();
     
     const alerts = [];
     if (metrics.pendingCount > 500) {
       alerts.push('High queue depth: ' + metrics.pendingCount);
     }
     if (metrics.failureRate > 20) {
       alerts.push('High failure rate: ' + metrics.failureRate + '%');
     }
     if (metrics.stuckCount > 10) {
       alerts.push('Stuck entries detected: ' + metrics.stuckCount);
     }
     
     return Response.json({
       status: alerts.length === 0 ? 'healthy' : 'degraded',
       metrics,
       alerts
     });
   }
   ```
   
   **Option C: External Monitoring**
   - Use Better Stack, Datadog, or New Relic
   - Set up uptime checks for health endpoint
   - Configure alert thresholds

3. **Set Alert Thresholds**
   - ⚠️ **Warning**: Pending queue > 200 entries
   - 🚨 **Critical**: Pending queue > 500 entries
   - ⚠️ **Warning**: Failure rate > 10% (last hour)
   - 🚨 **Critical**: Failure rate > 25% (last hour)
   - ⚠️ **Warning**: Stuck entries > 5
   - 🚨 **Critical**: Cron job hasn't run in 2 hours

4. **Document Runbook**
   Create `docs/rss-pipeline-runbook.md` with:
   - Common failure scenarios
   - Troubleshooting steps
   - Manual intervention procedures
   - Contact information

### Success Criteria
- ✅ Monitoring dashboard shows current metrics
- ✅ Alerts configured and tested (trigger test alert)
- ✅ Runbook documented and accessible
- ✅ Team notified of monitoring setup

---

## 🚀 Workstream 8: Production Validation

**Owner**: Product/Engineering Lead  
**Dependencies**: All previous workstreams  
**Estimated Time**: 1 hour

### Tasks

1. **Wait for First Cron Cycle**
   - Sync cron runs every 15 minutes
   - Summarize cron runs every 30 minutes
   - Wait at least 45 minutes after deployment

2. **Verify Automated Processing**
   ```sql
   -- Check recent sync activity
   SELECT 
     DATE_TRUNC('hour', created_at) as hour,
     COUNT(*) as entries_synced
   FROM rss_entries
   WHERE created_at > NOW() - INTERVAL '2 hours'
   GROUP BY hour
   ORDER BY hour DESC;
   
   -- Check recent summarization activity
   SELECT 
     DATE_TRUNC('hour', updated_at) as hour,
     COUNT(*) as summaries_generated
   FROM rss_entries
   WHERE summary_status = 'done'
     AND updated_at > NOW() - INTERVAL '2 hours'
   GROUP BY hour
   ORDER BY hour DESC;
   ```

3. **Check Vercel Cron Logs**
   - Navigate to Vercel Dashboard → Project → Logs
   - Filter by `/api/rss/sync` and `/api/rss/summarize`
   - Verify successful executions
   - Check for any error logs

4. **User Acceptance Testing**
   - Share dashboard link with stakeholders
   - Gather feedback on entry quality
   - Verify summaries are accurate and useful
   - Check for any UI/UX issues

5. **Performance Validation**
   - Measure page load time for `/dashboard-v2`
   - Check API response times for `/api/rss/entries`
   - Verify Ollama response times (should be < 30s)
   - Monitor Supabase query performance

### Success Criteria
- ✅ Cron jobs executing on schedule without errors
- ✅ New entries appearing in dashboard automatically
- ✅ Summaries being generated successfully
- ✅ Dashboard loads in < 3 seconds
- ✅ Positive feedback from stakeholders
- ✅ No critical bugs or issues

---

## 📋 Task Assignment Template

Use this template to assign workstreams to team members or agents:

```markdown
## Workstream Assignment

**Workstream**: [1-8]  
**Assignee**: [Name/Agent ID]  
**Start Date**: [YYYY-MM-DD]  
**Target Completion**: [YYYY-MM-DD]  
**Status**: [ ] Not Started | [ ] In Progress | [ ] Blocked | [ ] Complete

### Progress Notes
- [Date] [Status update]
- [Date] [Status update]

### Blockers
- [Description of any blockers]

### Questions
- [Any questions or clarifications needed]
```

---

## 🎯 Success Metrics

Once all workstreams are complete, the RSS Pipeline should meet these metrics:

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Sync Success Rate** | > 95% | Successful sync cron runs / Total runs |
| **Summarization Success Rate** | > 90% | Entries with `status='done'` / Total entries |
| **Queue Depth** | < 100 | Count of `status='pending'` entries |
| **Average Summarization Time** | < 25s | Average latency from metadata |
| **Dashboard Load Time** | < 3s | Time to interactive on `/dashboard-v2` |
| **API Response Time** | < 500ms | P95 response time for `/api/rss/entries` |
| **Cron Reliability** | > 98% | Successful cron executions / Scheduled runs |
| **Entry Freshness** | < 30 min | Time from feed publish to dashboard display |

---

## 🔄 Daily Operations (Post-Launch)

Once operational, the RSS Pipeline requires minimal daily intervention:

1. **Automated Processes** (No Action Required)
   - Every 15 min: Miniflux entries synced to database
   - Every 30 min: AI summaries generated
   - Dashboard updates in real-time

2. **Weekly Maintenance** (15 min/week)
   - Review failure logs
   - Run cleanup script: `npm run cleanup-rss-failures`
   - Check for new feeds to add

3. **Monthly Review** (1 hour/month)
   - Analyze metrics and trends
   - Review feed quality and relevance
   - Update feed list based on stakeholder feedback
   - Performance tuning if needed

---

## 🆘 Troubleshooting Quick Reference

| Issue | Likely Cause | Solution |
|-------|-------------|----------|
| No entries syncing | Miniflux URL/API key wrong | Check environment variables |
| Summaries failing | Ollama unreachable | Verify `OLLAMA_URL` and network access |
| High queue depth | Ollama too slow | Scale Ollama instance or reduce batch size |
| Dashboard empty | No feeds configured | Add feeds to Miniflux |
| Cron not running | Vercel configuration issue | Check `vercel.json` and redeploy |
| Stuck entries | Ollama timeout | Run `resetStuckEntries()` function |

---

## 📞 Support Contacts

**Infrastructure Issues**: [DevOps team contact]  
**Feed Curation**: [Content team contact]  
**Application Bugs**: [Engineering team contact]  
**Product Feedback**: [Product team contact]

---

*This document will be updated as workstreams progress. Last updated: October 7, 2025*
