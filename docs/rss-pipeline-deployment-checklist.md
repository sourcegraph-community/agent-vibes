# RSS Pipeline Deployment Checklist

**Purpose**: Step-by-step deployment guide for the RSS Pipeline  
**Target**: DevOps/Engineering teams deploying from scratch  
**Estimated Total Time**: 6-8 hours (parallelizable)

---

## 1. Pre-Deployment Checklist

### 1.1 Prerequisites
- [ ] Supabase project created with service role access
- [ ] Vercel project configured and connected to repository
- [ ] Server/VM available for Miniflux (2GB RAM minimum)
- [ ] Server/VM available for Ollama (8GB RAM minimum, GPU recommended)
- [ ] Access to project repository with latest code
- [ ] Environment variable management strategy defined

### 1.2 Required Credentials
- [ ] `SUPABASE_URL` obtained
- [ ] `SUPABASE_SERVICE_ROLE_KEY` obtained
- [ ] `CRON_SECRET` generated (use: `openssl rand -base64 32`)
- [ ] `INTERNAL_API_KEY` generated (use: `openssl rand -base64 32`)

### 1.3 Pre-Flight Check
- [ ] Run `npm install` to verify dependencies
- [ ] Run `npm run check` to verify code quality
- [ ] Confirm git branch is up to date with `main`
- [ ] Review [docs/rss-pipeline-next-steps.md](rss-pipeline-next-steps.md) for context

---

## 2. Database Migration Checklist

### 2.1 Environment Setup
```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

- [ ] Environment variables exported in terminal
- [ ] Supabase connection tested: `npm run health-check`

### 2.2 Apply Migrations
```bash
# Run RSS migration script
npm run apply-rss-migrations
```

- [ ] Migration script completed without errors
- [ ] Console output shows "✅ Migration completed successfully"

### 2.3 Verify Database Schema
- [ ] Open Supabase Dashboard → Database → Tables
- [ ] Confirm `rss_entries` table exists with columns:
  - [ ] `id` (UUID, primary key)
  - [ ] `miniflux_entry_id` (BIGINT, unique)
  - [ ] `feed_id` (BIGINT)
  - [ ] `category` (TEXT)
  - [ ] `title` (TEXT)
  - [ ] `url` (TEXT)
  - [ ] `content` (TEXT)
  - [ ] `author` (TEXT, nullable)
  - [ ] `published_at` (TIMESTAMPTZ)
  - [ ] `ai_summary` (TEXT, nullable)
  - [ ] `summary_status` (TEXT)
  - [ ] `summary_metadata` (JSONB, nullable)
  - [ ] `created_at` (TIMESTAMPTZ)
  - [ ] `updated_at` (TIMESTAMPTZ)

### 2.4 Verify Indexes
- [ ] `idx_rss_entries_miniflux_id` (unique)
- [ ] `idx_rss_entries_category`
- [ ] `idx_rss_entries_published_at`
- [ ] `idx_rss_entries_summary_status`
- [ ] `idx_rss_entries_feed_id`
- [ ] `idx_rss_entries_category_published`

### 2.5 Verify Database Functions
```sql
-- Test claim_pending_summaries function
SELECT claim_pending_summaries(5);
```
- [ ] Function returns array of claimed entry IDs
- [ ] No SQL errors

### 2.6 Verify Triggers
- [ ] `set_updated_at` trigger exists on `rss_entries` table
- [ ] Test: Update a row and verify `updated_at` changes automatically

**✅ Database Migration Complete**

---

## 3. Miniflux Setup Checklist

### 3.1 Deploy Miniflux Instance

#### Option A: Docker Compose (Recommended)
```bash
# Create deployment directory
mkdir -p ~/miniflux-deploy
cd ~/miniflux-deploy

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3'
services:
  miniflux:
    image: miniflux/miniflux:latest
    ports:
      - "8080:8080"
    depends_on:
      - db
    environment:
      - DATABASE_URL=postgres://miniflux:miniflux_secret@db/miniflux?sslmode=disable
      - CREATE_ADMIN=1
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=ChangeMe123!
      - RUN_MIGRATIONS=1
      - BASE_URL=http://your-domain-or-ip:8080
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=miniflux
      - POSTGRES_PASSWORD=miniflux_secret
      - POSTGRES_DB=miniflux
    volumes:
      - miniflux-db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U miniflux"]
      interval: 10s
      timeout: 5s
      retries: 5
volumes:
  miniflux-db:
EOF

# Start services
docker-compose up -d
```

- [ ] `docker-compose.yml` created
- [ ] Services started: `docker-compose up -d`
- [ ] Containers running: `docker-compose ps`
- [ ] Logs show no errors: `docker-compose logs -f`

#### Option B: VM Installation
```bash
# Ubuntu/Debian installation
wget https://github.com/miniflux/v2/releases/download/2.1.0/miniflux_2.1.0_amd64.deb
sudo dpkg -i miniflux_2.1.0_amd64.deb
```

- [ ] Miniflux binary installed
- [ ] PostgreSQL database configured
- [ ] Miniflux service started

### 3.2 Initial Configuration
- [ ] Access Miniflux at `http://your-ip:8080`
- [ ] Login with admin credentials
- [ ] Change default admin password
- [ ] Navigate to Settings → API Keys
- [ ] Click "Create a new API key"
- [ ] Copy API key and save securely
- [ ] Record `MINIFLUX_URL` (e.g., `http://your-ip:8080`)
- [ ] Record `MINIFLUX_API_KEY`

### 3.3 Test API Access
```bash
# Test API connection
curl -H "X-Auth-Token: your-api-key" \
  http://your-ip:8080/v1/me | jq
```

- [ ] API returns user object with `id`, `username`, etc.
- [ ] No authentication errors

### 3.4 Create Categories
- [ ] Navigate to Settings → Categories
- [ ] Create category: "Product Updates"
- [ ] Create category: "Research Papers"
- [ ] Create category: "Perspective Pieces"
- [ ] Note category IDs for each

### 3.5 Security Configuration
- [ ] Configure HTTPS/SSL (recommended: Let's Encrypt with Nginx reverse proxy)
- [ ] Set up firewall rules (allow only port 443/80 if using reverse proxy)
- [ ] Configure domain name (optional)
- [ ] Enable automatic backups for PostgreSQL volume

**✅ Miniflux Setup Complete**

---

## 4. Ollama Setup Checklist

### 4.1 Provision Server
**Recommended Specs**:
- **Cloud Provider**: AWS (g4dn.xlarge), GCP (n1-standard-4 with T4), Hetzner (GPU instance)
- **Minimum**: 8GB RAM, 20GB disk, 4 vCPUs
- **Optimal**: 16GB RAM, 50GB disk, GPU (NVIDIA T4 or better)

- [ ] Server provisioned
- [ ] SSH access configured
- [ ] Security groups/firewall configured (port 11434)

### 4.2 Install Ollama

#### Ubuntu/Debian Installation
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Verify installation
ollama --version
```

- [ ] Ollama binary installed
- [ ] Version displayed correctly

### 4.3 Configure Network Access
```bash
# Edit systemd service for remote access
sudo systemctl edit ollama

# Add these lines:
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

- [ ] Service configuration updated
- [ ] Ollama service restarted
- [ ] Service status: `sudo systemctl status ollama` (should be "active")

### 4.4 Download Model
```bash
# Pull llama3.1:8b model (~4.7GB download)
ollama pull llama3.1:8b

# Verify model available
ollama list
```

- [ ] Model downloaded successfully
- [ ] Model appears in `ollama list` output

### 4.5 Test Model
```bash
# Test generation API
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Summarize this in 2 sentences: AI coding assistants are revolutionizing software development by providing intelligent code completion and generation.",
  "stream": false
}' | jq '.response'
```

- [ ] API returns valid JSON response
- [ ] Summary is coherent (2-3 sentences)
- [ ] Response time < 30 seconds

### 4.6 Performance Tuning (Optional)
```bash
# Set concurrent request limit
export OLLAMA_MAX_LOADED_MODELS=1
export OLLAMA_NUM_PARALLEL=2

# For GPU instances
export OLLAMA_NUM_GPU=1
```

- [ ] Environment variables set (if needed)
- [ ] Performance tested under load

### 4.7 Security Configuration
**Option A: Firewall Restriction**
```bash
# Allow only from Vercel IP ranges
sudo ufw allow from 76.76.21.0/24 to any port 11434
```

**Option B: VPN/Private Network**
- [ ] Configure VPN between Vercel and Ollama server
- [ ] Update `OLLAMA_URL` to use private IP

**Option C: SSH Tunnel (Development Only)**
```bash
# Not recommended for production
ssh -L 11434:localhost:11434 user@ollama-server
```

- [ ] Security method implemented
- [ ] Access restricted to authorized sources only

### 4.8 Monitoring Setup
```bash
# Enable Ollama service logging
sudo journalctl -u ollama -f
```

- [ ] Logs accessible via journalctl
- [ ] Consider centralized logging (optional)

**✅ Ollama Setup Complete**

---

## 5. Vercel Configuration Checklist

### 5.1 Set Environment Variables
Navigate to: Vercel Dashboard → Your Project → Settings → Environment Variables

```bash
# RSS Pipeline Configuration
MINIFLUX_URL=http://your-miniflux-ip:8080
MINIFLUX_API_KEY=your-miniflux-api-key
OLLAMA_URL=http://your-ollama-ip:11434
OLLAMA_MODEL=llama3.1:8b

# Existing Variables (verify)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-cron-secret
INTERNAL_API_KEY=your-internal-api-key
```

#### For Each Variable:
- [ ] `MINIFLUX_URL` - Added to Production, Preview, Development
- [ ] `MINIFLUX_API_KEY` - Added to Production, Preview, Development (sensitive)
- [ ] `OLLAMA_URL` - Added to Production, Preview, Development
- [ ] `OLLAMA_MODEL` - Added to Production, Preview, Development
- [ ] `SUPABASE_URL` - Verified in all environments
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Verified in all environments (sensitive)
- [ ] `CRON_SECRET` - Verified in all environments (sensitive)
- [ ] `INTERNAL_API_KEY` - Verified in all environments (sensitive)

### 5.2 Verify Cron Configuration
- [ ] Open `vercel.json` in repository
- [ ] Confirm cron jobs configured:
  ```json
  {
    "crons": [
      {
        "path": "/api/rss/sync",
        "schedule": "*/15 * * * *"
      },
      {
        "path": "/api/rss/summarize",
        "schedule": "*/30 * * * *"
      }
    ]
  }
  ```
- [ ] Cron jobs appear in Vercel Dashboard → Settings → Cron

### 5.3 Deploy Application
```bash
# Option A: Git push (automatic deployment)
git push origin main

# Option B: Manual deployment via Vercel CLI
vercel --prod
```

- [ ] Deployment triggered
- [ ] Build completed successfully
- [ ] No build errors in logs
- [ ] Deployment URL accessible

### 5.4 Verify Deployment
- [ ] Visit production URL
- [ ] Check Vercel Dashboard → Deployments → Latest
- [ ] Review build logs for errors
- [ ] Confirm environment variables loaded (check logs for "undefined" errors)

**✅ Vercel Configuration Complete**

---

## 6. Feed Curation Checklist

### 6.1 Product Update Feeds

#### Add to Miniflux (Category: "Product Updates")
- [ ] **Cursor**: Find RSS feed at `https://cursor.sh/changelog`
  - Try: `https://cursor.sh/changelog/rss.xml` or use RSS discovery
- [ ] **GitHub Copilot**: `https://github.blog/tag/github-copilot/feed/`
- [ ] **Cody (Sourcegraph)**: `https://sourcegraph.com/blog/feed.xml`
- [ ] **Amp**: Check `https://ampcode.com/blog` for RSS
- [ ] **Windsurf**: Search for changelog/blog RSS feed
- [ ] **Continue.dev**: Check `https://continue.dev/blog` for RSS

**Feed Addition Steps (for each feed)**:
1. Login to Miniflux
2. Click "Add Feed" → "Enter Feed URL"
3. Paste feed URL
4. Select category: "Product Updates"
5. Click "Find Subscription"
6. Review and click "Add"

### 6.2 Research Paper Feeds

#### Add to Miniflux (Category: "Research Papers")
- [ ] **arXiv AI**: `http://export.arxiv.org/rss/cs.AI`
- [ ] **arXiv ML**: `http://export.arxiv.org/rss/cs.LG`
- [ ] **arXiv SE**: `http://export.arxiv.org/rss/cs.SE`
- [ ] **Papers with Code**: `https://paperswithcode.com/feeds/latest/` (verify URL)
- [ ] **Hugging Face Papers**: Check for RSS feed

### 6.3 Perspective Piece Feeds

#### Add to Miniflux (Category: "Perspective Pieces")
- [ ] **a16z**: `https://a16z.com/feed/`
- [ ] **Sequoia Capital**: Check `https://www.sequoiacap.com/blog/`
- [ ] **Simon Willison**: `https://simonwillison.net/atom/everything/`
- [ ] **Stratechery**: `https://stratechery.com/feed/`
- [ ] **Kent C. Dodds**: `https://kentcdodds.com/blog/rss.xml`
- [ ] **Dan Abramov**: Check for RSS feed

### 6.4 Feed Quality Assurance
For each feed:
- [ ] Feed loads successfully in Miniflux
- [ ] Recent entries visible (within last 30 days)
- [ ] Entries have proper titles
- [ ] Entries have valid URLs
- [ ] Content is relevant to category
- [ ] Remove any broken/inactive feeds

### 6.5 Feed Discovery Tips
- Use browser extension: "RSS Feed Reader" or "Feedbro"
- Check page source for: `<link rel="alternate" type="application/rss+xml">`
- Try common paths: `/feed`, `/rss`, `/atom`, `/feed.xml`, `/rss.xml`
- Use: `https://rss.app/` or `https://www.feedspot.com/` for discovery

**✅ Feed Curation Complete**

---

## 7. Testing Checklist

### 7.1 Local Script Testing

#### Test Manual Sync
```bash
# Set environment variables
export MINIFLUX_URL="http://your-miniflux-ip:8080"
export MINIFLUX_API_KEY="your-api-key"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run sync script
npm run sync-rss-entries
```

- [ ] Script executes without errors
- [ ] Console shows "✅ Sync completed"
- [ ] Entry counts displayed per category

#### Test Manual Summarization
```bash
# Set Ollama environment variables
export OLLAMA_URL="http://your-ollama-ip:11434"
export OLLAMA_MODEL="llama3.1:8b"

# Run summarization script
npm run summarize-rss-entries
```

- [ ] Script executes without errors
- [ ] Console shows "✅ Summaries generated"
- [ ] Success count > 0

### 7.2 Database Verification

#### Check Synced Entries
```sql
SELECT 
  category, 
  COUNT(*) as count,
  MAX(published_at) as latest_entry
FROM rss_entries
GROUP BY category
ORDER BY category;
```

- [ ] Query returns rows for 'product', 'research', 'perspective'
- [ ] Counts > 0 for each category
- [ ] `latest_entry` is recent (within 24 hours)

#### Check AI Summaries
```sql
SELECT 
  title,
  LEFT(ai_summary, 100) as summary_preview,
  summary_status,
  summary_metadata
FROM rss_entries
WHERE summary_status = 'done'
ORDER BY updated_at DESC
LIMIT 5;
```

- [ ] Entries returned with `summary_status='done'`
- [ ] `ai_summary` is non-null and readable
- [ ] `summary_metadata` contains latency info

### 7.3 API Endpoint Testing

#### Test Dashboard API
```bash
# Test product updates
curl "https://your-app.vercel.app/api/rss/entries?category=product&limit=5" | jq

# Test research papers
curl "https://your-app.vercel.app/api/rss/entries?category=research&limit=5" | jq

# Test perspectives
curl "https://your-app.vercel.app/api/rss/entries?category=perspective&limit=5" | jq
```

- [ ] Product endpoint returns JSON array with entries
- [ ] Research endpoint returns JSON array with entries
- [ ] Perspective endpoint returns JSON array with entries
- [ ] Each entry has: `id`, `title`, `url`, `aiSummary`, `publishedAt`, `source`

### 7.4 Cron Endpoint Testing

#### Manual Trigger (Authenticated)
```bash
# Test sync endpoint
curl -X POST "https://your-app.vercel.app/api/rss/sync" \
  -H "x-api-key: your-internal-api-key" \
  -H "Content-Type: application/json"

# Test summarize endpoint
curl -X POST "https://your-app.vercel.app/api/rss/summarize" \
  -H "x-api-key: your-internal-api-key" \
  -H "Content-Type: application/json"
```

- [ ] Sync endpoint returns 200 with success message
- [ ] Summarize endpoint returns 200 with success message
- [ ] No authentication errors

### 7.5 Dashboard UI Testing
- [ ] Navigate to `https://your-app.vercel.app/dashboard-v2`
- [ ] Page loads without errors (< 3 seconds)
- [ ] "Product Updates" section displays real entries
- [ ] "Research Papers" section displays real entries
- [ ] "Perspective Pieces" section displays real entries
- [ ] Entries show: title, source, summary, published date
- [ ] Links are clickable and open correct URLs
- [ ] No placeholder/mock data visible

### 7.6 Error Handling Testing
```bash
# Test with invalid API key
curl -X POST "https://your-app.vercel.app/api/rss/sync" \
  -H "x-api-key: invalid-key"
```

- [ ] Returns 401 Unauthorized
- [ ] Error message is clear

**✅ Testing Complete**

---

## 8. Post-Deployment Validation Checklist

### 8.1 Cron Job Validation

#### Wait for First Cycle
- [ ] Wait 15 minutes after deployment (for sync cron)
- [ ] Wait 30 minutes after deployment (for summarize cron)

#### Check Vercel Logs
- [ ] Open Vercel Dashboard → Project → Logs
- [ ] Filter by `/api/rss/sync`
- [ ] Verify successful execution (200 response)
- [ ] Filter by `/api/rss/summarize`
- [ ] Verify successful execution (200 response)
- [ ] No error logs present

### 8.2 Automated Processing Validation

#### Database Activity Check
```sql
-- Check recent sync activity (last 2 hours)
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as entries_synced
FROM rss_entries
WHERE created_at > NOW() - INTERVAL '2 hours'
GROUP BY hour
ORDER BY hour DESC;
```

- [ ] Query shows entries created in last 2 hours
- [ ] Entry count matches expected feed volume

#### Summarization Activity Check
```sql
-- Check recent summarization (last 2 hours)
SELECT 
  DATE_TRUNC('hour', updated_at) as hour,
  COUNT(*) as summaries_generated
FROM rss_entries
WHERE summary_status = 'done'
  AND updated_at > NOW() - INTERVAL '2 hours'
GROUP BY hour
ORDER BY hour DESC;
```

- [ ] Query shows summaries generated in last 2 hours
- [ ] Summary count > 0

### 8.3 Performance Validation

#### Dashboard Performance
- [ ] Measure `/dashboard-v2` load time (DevTools Network tab)
- [ ] Load time < 3 seconds (acceptable)
- [ ] Load time < 1 second (excellent)

#### API Performance
```bash
# Measure API response time
time curl -s "https://your-app.vercel.app/api/rss/entries?category=product&limit=10" > /dev/null
```

- [ ] Response time < 500ms (acceptable)
- [ ] Response time < 200ms (excellent)

#### Ollama Performance
```sql
-- Check average summarization latency
SELECT 
  AVG((summary_metadata->>'latency')::numeric) as avg_latency_ms
FROM rss_entries
WHERE summary_status = 'done'
  AND summary_metadata ? 'latency';
```

- [ ] Average latency < 30 seconds (acceptable)
- [ ] Average latency < 15 seconds (excellent)

### 8.4 Data Quality Validation

#### Manual Review (Sample 10 Entries)
- [ ] Select 10 random entries across all categories
- [ ] Verify each summary is accurate and coherent
- [ ] Check that summaries are 2-3 sentences
- [ ] Ensure no truncated or garbled text
- [ ] Confirm summaries capture key points

#### Stakeholder UAT
- [ ] Share dashboard with 3-5 stakeholders
- [ ] Gather feedback on entry relevance
- [ ] Collect feedback on summary quality
- [ ] Document any issues or improvement requests

### 8.5 Monitoring Setup

#### Create Monitoring Dashboard
```sql
-- Queue depth
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
```

- [ ] Queries saved in Supabase dashboard
- [ ] Pending count < 100 (healthy)
- [ ] Failure rate < 10% (healthy)

#### Alert Configuration (Optional)
- [ ] Configure alerts for high queue depth (> 200)
- [ ] Configure alerts for high failure rate (> 20%)
- [ ] Configure alerts for cron failures
- [ ] Test alert delivery

### 8.6 Success Metrics Validation

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Sync Success Rate | > 95% | _____ | [ ] Pass |
| Summarization Success Rate | > 90% | _____ | [ ] Pass |
| Queue Depth | < 100 | _____ | [ ] Pass |
| Avg Summarization Time | < 25s | _____ | [ ] Pass |
| Dashboard Load Time | < 3s | _____ | [ ] Pass |
| API Response Time | < 500ms | _____ | [ ] Pass |

**✅ Post-Deployment Validation Complete**

---

## 9. Rollback Procedures

### 9.1 Emergency Rollback (Immediate)

#### Stop Cron Jobs
```bash
# Temporarily disable in vercel.json
{
  "crons": []
}

# Deploy immediately
git add vercel.json
git commit -m "EMERGENCY: Disable RSS cron jobs"
git push origin main
```

- [ ] Cron jobs disabled
- [ ] Deployment successful
- [ ] No new entries being processed

#### Revert Code Changes
```bash
# Find last working commit
git log --oneline | head -20

# Revert to last known good commit
git revert <commit-hash>
git push origin main
```

- [ ] Code reverted
- [ ] Application functional
- [ ] RSS pipeline disabled

### 9.2 Partial Rollback (Specific Issues)

#### Disable Only Summarization
```bash
# Comment out in vercel.json
{
  "crons": [
    {
      "path": "/api/rss/sync",
      "schedule": "*/15 * * * *"
    }
    // Summarization disabled
  ]
}
```

- [ ] Sync continues (entries collected)
- [ ] Summarization paused
- [ ] Issue investigated

#### Reset Failed Entries
```sql
-- Reset error entries to pending
UPDATE rss_entries
SET summary_status = 'pending',
    summary_metadata = NULL
WHERE summary_status = 'error';
```

- [ ] Failed entries reset
- [ ] Ready for retry

### 9.3 Database Rollback

#### Backup Current State
```bash
# Export current data
pg_dump -h your-supabase-db -U postgres -d postgres -t rss_entries > rss_backup.sql
```

- [ ] Backup created
- [ ] Backup verified (non-zero size)

#### Rollback Migration (If Needed)
```sql
-- Drop table (CAUTION: Data loss)
DROP TABLE IF EXISTS rss_entries CASCADE;

-- Rollback changes
-- (Re-run previous migration if available)
```

- [ ] Table removed
- [ ] Previous schema restored

### 9.4 Service Degradation Fallback

#### Reduce Cron Frequency
```json
{
  "crons": [
    {
      "path": "/api/rss/sync",
      "schedule": "0 */2 * * *"  // Every 2 hours instead of 15 min
    },
    {
      "path": "/api/rss/summarize",
      "schedule": "30 */2 * * *"  // Every 2 hours instead of 30 min
    }
  ]
}
```

- [ ] Frequency reduced
- [ ] Load decreased
- [ ] System stabilized

### 9.5 Communication Plan
- [ ] Notify stakeholders of rollback
- [ ] Document issue and root cause
- [ ] Create incident report
- [ ] Schedule post-mortem meeting
- [ ] Update deployment checklist with lessons learned

**✅ Rollback Procedures Documented**

---

## 10. Final Sign-Off

### 10.1 Deployment Checklist Summary
- [ ] All 9 sections completed
- [ ] All checkboxes marked
- [ ] No critical issues outstanding
- [ ] Documentation updated

### 10.2 Stakeholder Approval
- [ ] Engineering Lead approval
- [ ] DevOps approval
- [ ] Product Owner approval

### 10.3 Handoff to Operations
- [ ] Operations team briefed
- [ ] Runbook shared: [docs/rss-pipeline-runbook.md](rss-pipeline-runbook.md)
- [ ] Monitoring access granted
- [ ] On-call rotation updated

### 10.4 Post-Deployment Tasks
- [ ] Schedule 1-week check-in
- [ ] Schedule 1-month review
- [ ] Add to production service inventory
- [ ] Update architecture diagrams

**🎉 RSS Pipeline Deployment Complete!**

---

## Appendix: Quick Reference

### Key URLs
- **Supabase**: `https://app.supabase.com/project/[project-id]`
- **Vercel**: `https://vercel.com/[team]/[project]`
- **Miniflux**: `http://[your-ip]:8080`
- **Ollama**: `http://[your-ip]:11434`
- **Dashboard**: `https://[your-app].vercel.app/dashboard-v2`

### Key Commands
```bash
# Health check
npm run health-check

# Manual sync
npm run sync-rss-entries

# Manual summarization
npm run summarize-rss-entries

# Database migration
npm run apply-rss-migrations

# Code quality check
npm run check
```

### Support Resources
- RSS Pipeline Docs: [docs/rss-pipeline-next-steps.md](rss-pipeline-next-steps.md)
- Miniflux Docs: https://miniflux.app/docs/
- Ollama Docs: https://github.com/ollama/ollama/blob/main/docs/
- Vercel Cron Docs: https://vercel.com/docs/cron-jobs

---

*Last Updated: October 7, 2025*
