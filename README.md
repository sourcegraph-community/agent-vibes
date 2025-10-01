# Agent Vibes

**Internal Platform | Social Intelligence & Analytics**

Agent Vibes is an internal Next.js 15 application for collecting, analyzing, and visualizing social media sentiment about AI coding agents. The platform automates tweet collection via Apify, processes sentiment using Google Gemini, and presents insights through interactive dashboards.

---

## Project Status

🔒 **Internal Use Only** - Currently deployed on Vercel for internal team access. Not yet public.

🚀 **Features**
- ✅ Apify Pipeline - Automated tweet collection and sentiment analysis
- ✅ Dashboard - Real-time visualization of social sentiment trends
- ✅ Mock Prototypes - Static design references for rapid iteration

---

## Quick Start (Internal Team)

### Prerequisites
- Node.js 20+
- Access to internal Supabase, Apify, and Gemini accounts

### Setup

```bash
# Clone and install
git clone https://github.com/sourcegraph-community/agent-vibes.git
cd agent-vibes
npm install

# Configure environment (copy from team 1Password vault or ask #ops-oncall)
cp .env.example .env.local
# Edit .env.local with credentials

# Start development server
npm run dev
```

Visit [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

**For detailed setup instructions**, see [Apify Pipeline Testing Guide](docs/apify-pipeline/local-testing-guide.md)

---

## Architecture

This project follows **Vertical Slice Architecture** (VSA) - features are organized as self-contained slices rather than horizontal layers.

```
src/
  ApifyPipeline/              # Feature: Social media intelligence pipeline
    Web/                      # User-initiated HTTP requests
      Application/            # Command handlers & orchestration
      Core/                   # Pure business logic
      DataAccess/             # Database operations (Supabase)
      ExternalServices/       # Third-party integrations (Apify, Gemini)
    Background/               # Time-triggered scheduled jobs
    Tests/                    # Unit & integration tests
    Docs/                     # Feature documentation
```

### Core Technologies
- **Framework:** Next.js 15 (App Router, Turbopack)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
- **Testing:** Vitest
- **Linting:** ESLint v9 + ESLint Stylistic (no Prettier)

---

## Available Commands

### Development
```bash
npm run dev              # Start dev server with Turbopack
npm run build            # Production build
npm run start            # Start production server
```

### Testing & Quality
```bash
npm test                 # Run unit tests (Vitest)
npm run test:watch       # Watch mode
npm run test:ui          # Vitest UI

npm run check            # TypeScript + ESLint
npm run check:fix        # Auto-fix and format code
npm run typecheck        # TypeScript only
npm run lint             # ESLint only
npm run lint:fix         # Fix linting issues
```

### Apify Pipeline Operations
```bash
npm run health-check               # Validate environment & connections
npm run apply-migrations           # Apply database migrations programmatically
npm run enqueue:backfill           # Queue historical data (run once, configurable)
npm run process:backfill           # Process backfill batch (manual, repeat per batch)
npm run replay:sentiments          # Retry failed sentiment processing
npm run cleanup:raw-tweets         # Archive old raw data
npm run cleanup:sentiment-failures # Remove stale failure records
npm run rotate:supabase            # Rotate Supabase secrets (ops only)
```

**Note:** All Apify Pipeline scripts automatically load `.env.local` via `dotenv`. Ensure environment variables are configured before running.

---

## Features

### 1. Apify Pipeline (Production)

Automated social intelligence system that collects tweets about AI coding agents, analyzes sentiment, and stores insights for visualization.

**Status:** ✅ Production-ready, deployed on Vercel

**Key Components:**
- **Tweet Collection** - Apify actor scrapes Twitter based on tracked keywords
- **Normalization** - Standardizes tweet data and deduplicates
- **Sentiment Analysis** - Google Gemini classifies sentiment (positive/neutral/negative)
- **Storage** - Supabase PostgreSQL with views for analytics

**Quick Links:**
- Dashboard: `/dashboard` (overview, keywords, tweets)
- API Endpoints: `/api/start-apify-run`, `/api/process-sentiments`, `/api/process-backfill`
- Documentation: [src/ApifyPipeline/README.md](src/ApifyPipeline/README.md)
- Collection Strategy: [docs/apify-pipeline/collection-strategy.md](docs/apify-pipeline/collection-strategy.md) - **Backfill vs Regular Collection**
- Testing Guide: [docs/apify-pipeline/local-testing-guide.md](docs/apify-pipeline/local-testing-guide.md)
- Operational Runbook: [src/ApifyPipeline/Docs/ApifyPipeline-start-apify-run-runbook.md](src/ApifyPipeline/Docs/ApifyPipeline-start-apify-run-runbook.md)

### 2. Mock Dashboards (Prototypes)

Static design references for rapid iteration and stakeholder previews.

**Available Mocks:**
- **Apify Tweet Scraper:** [http://localhost:3000/mocks/apify-tweet-scraper](http://localhost:3000/mocks/apify-tweet-scraper)
  - Data: `mocks/apify-tweet-scraper/data/*.json`
  
- **Agent Intelligence Dashboard:** [http://localhost:3000/mocks/analytics-dashboard](http://localhost:3000/mocks/analytics-dashboard)
  - Data: `mocks/analytics-dashboard/data/dashboard.json`

Update JSON fixtures to adjust stats, copy, or chart data - routes reload on every request.

---

## Configuration

### Environment Variables

| Variable | Purpose | Required | Where to Get |
|----------|---------|----------|--------------|
| `SUPABASE_URL` | Database connection | ✅ Yes | Team 1Password vault |
| `SUPABASE_SERVICE_ROLE_KEY` | Server DB access | ✅ Yes | Team 1Password vault |
| `NEXT_PUBLIC_SUPABASE_URL` | Client DB access | ✅ Yes | Same as SUPABASE_URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client DB access | ✅ Yes | Team 1Password vault |
| `APIFY_TOKEN` | Tweet collection | ✅ Yes | Ask #ops-oncall |
| `APIFY_ACTOR_ID` | Actor to run | ✅ Yes | `apify/twitter-search-scraper` |
| `GEMINI_API_KEY` | Sentiment analysis | ✅ Yes | Ask #ops-oncall |
| `INTERNAL_API_KEY` | Manual API auth | ⚠️ Optional | Generate: `openssl rand -hex 32` |

**Secrets Management:**
- Development: Stored in `.env.local` (git-ignored)
- Production: Stored in Vercel project environment variables
- Rotation: Quarterly via `npm run rotate:supabase` (ops team)

---

## Code Standards

### Formatting & Linting
- **ESLint v9** flat config - see [eslint.config.mjs](eslint.config.mjs)
- **ESLint Stylistic** handles formatting (no Prettier)
- Run `npm run check:fix` to auto-format before committing
- CI checks enforce these standards

### TypeScript
- Strict mode enabled
- Explicit types for public APIs
- Rely on inference internally
- Path alias: `@/*` maps to project root

### Naming Conventions
| Artifact | Naming Scheme | Example |
|----------|---------------|---------|
| Components | PascalCase | `DashboardHeader.tsx` |
| Hooks | camelCase `use*` | `useKnockNotifications.ts` |
| API Routes | `route.ts` in folders | `app/api/start-apify-run/route.ts` |
| Commands/Queries | `{Verb}{Subject}{Type}` | `StartApifyRunCommand.ts` |
| Handlers | `{Command}Handler` | `StartApifyRunCommandHandler.ts` |

### VSA Principles
- **Feature ownership** - Slices own their entire use case
- **REPR flow** - Request → Endpoint → Processing → Response
- **CQRS** - Separate commands (mutations) from queries (reads)
- **Explicit boundaries** - Cross-slice via contracts, not shared internals

See [VSA Architecture Guide](~/CodeProjects/agent-docs/vsa-architecture.md) for details.

---

## Deployment

### Vercel (Production)

**Current Status:** Deployed internally for team access

**Environment:**
- Platform: Vercel
- Branch: `main` (auto-deploys)
- Domain: Internal Vercel URL (not public domain yet)

**Cron Jobs (Vercel):**
- Tweet Collection: Every 2 hours (`/api/start-apify-run`)
- Sentiment Processing: Every 30 minutes (`/api/process-sentiments`)
- Backfill Processing: Manual only (no automated cron)
- Requires: Vercel Pro plan for <24h intervals

**Configuration:**
1. Environment variables set in Vercel project settings
2. Cron definitions in [vercel.json](vercel.json)
3. Build command: `npm run build`

---

## Database

### Supabase (PostgreSQL)

**Schema:**
- `keywords` - Tracked search terms (4 Amp-related keywords)
- `cron_runs` - Execution history and metrics
- `raw_tweets` - Original Apify payloads
- `normalized_tweets` - Standardized tweet data
- `tweet_sentiments` - Gemini analysis results
- `backfill_batches` - Historical data processing queue
- `sentiment_failures` - Failed processing attempts

**Views:**
- `vw_daily_sentiment` - Aggregated daily trends
- `vw_keyword_trends` - Keyword-level analytics

**Migrations:**
- Primary: [src/ApifyPipeline/DataAccess/Migrations/20250929_1200_InitApifyPipeline.sql](src/ApifyPipeline/DataAccess/Migrations/20250929_1200_InitApifyPipeline.sql)
- Seeds: [src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql](src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql)

**Apply Migrations:**
```bash
# Option 1: Programmatically (recommended for local)
npm run apply-migrations

# Option 2: Supabase CLI
supabase db push

# Option 3: Manual via Supabase Studio SQL Editor
# Execute SQL files in order from src/ApifyPipeline/DataAccess/Migrations/
```

---

## Troubleshooting

### Common Issues

**"Environment variable not found"**
```bash
# Verify .env.local exists and variable names match
cat .env.local | grep -E "SUPABASE_URL|APIFY_TOKEN|GEMINI_API_KEY"

# Restart dev server after changes
```

**"Supabase connection failed"**
- Check if project is active (not paused)
- Verify URL format: `https://[project-ref].supabase.co`
- Confirm service role key (not anon key)

**"No keywords available"**
```sql
-- Check keywords in Supabase Studio SQL Editor
SELECT * FROM keywords WHERE enabled = true;

-- Re-run seed if empty
-- Execute: src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql
```

**"Scripts not loading .env.local"**
```bash
# All Apify Pipeline scripts (npm run health-check, enqueue:backfill, etc.) 
# automatically load .env.local via dotenv (installed as dev dependency)
# If you see "Missing required environment variables", verify:
# 1. .env.local exists in project root
# 2. Variable names match exactly (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.)
# 3. No syntax errors in .env.local file
```

**More troubleshooting:** See [Local Testing Guide](docs/apify-pipeline/local-testing-guide.md#common-issues--troubleshooting)

---

## Testing

### Local Testing
Full end-to-end testing guide: [docs/apify-pipeline/local-testing-guide.md](docs/apify-pipeline/local-testing-guide.md)

Quick validation:
```bash
# Validate environment
npm run health-check

# Run unit tests
npm test

# Trigger manual collection
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Content-Type: application/json" \
  -d '{"triggerSource": "manual-test", "ingestion": {"maxItemsPerKeyword": 10}}'
```

### Unit Tests
- **Framework:** Vitest
- **Config:** [vitest.config.ts](vitest.config.ts)
- **Location:** `src/ApifyPipeline/Tests/Unit/`
- **Coverage:** Core transformations, validators, business rules

---

## Documentation

### For Developers
- [Apify Pipeline Feature README](src/ApifyPipeline/README.md) - Feature architecture & development guide
- [Local Testing Guide](docs/apify-pipeline/local-testing-guide.md) - Comprehensive testing procedures
- [Internal Testing Quickstart](docs/apify-pipeline/internal-testing-quickstart.md) - 10-minute quick reference
- [Readiness Checklist](docs/apify-pipeline/readiness-checklist.md) - Pre-deployment validation

### For Operations
- [Operational Runbook](src/ApifyPipeline/Docs/ApifyPipeline-start-apify-run-runbook.md) - Production procedures & monitoring
- [Incident Response Guide](src/ApifyPipeline/Docs/incident-response-runbook.md) - Troubleshooting & recovery

### Architecture
- [Specification](docs/apify-pipeline/specification.md) - Technical requirements
- [Overview](docs/apify-pipeline/overview.md) - System architecture & data flow
- [Implementation Plan](docs/apify-pipeline/implementation-plan.md) - Development roadmap

---

## Known Issues

### ESLint Stylistic Indent Regression (Sep 2025)
`@stylistic/indent` triggers a stack overflow on large TSX trees with TypeScript 5.9.

**Mitigation:** `app/mocks/**` and `mocks/**` are ignored in [eslint.config.mjs](eslint.config.mjs).

**Resolution:** Remove ignores once upstream fix ships ([eslint-stylistic#915](https://github.com/eslint-stylistic/eslint-stylistic/issues/915)).

---

## Team Contacts

| Area | Contact | Channel |
|------|---------|---------|
| **Development** | Engineering Team | `#agent-vibes-dev` |
| **Operations** | Platform Ops | `#ops-oncall` |
| **Analytics** | Analytics Guild | `#analytics-insights` |
| **Incidents** | On-call Engineer | `#backend-support` |
| **Secrets/Access** | DevOps Team | `#ops-oncall` |

---

## Contributing (Internal)

1. **Branch from `main`**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Follow code standards**
   - Run `npm run check` before committing
   - Use `npm run check:fix` to auto-format

3. **Write tests**
   - Unit tests for business logic
   - Manual testing using test guide

4. **Submit PR**
   - Link to any related issues or Slack threads
   - Request review from team lead

5. **Deploy**
   - Merge to `main` triggers auto-deploy to Vercel

---

## License

**Internal Use Only** - Not licensed for public distribution.

---

## Additional Resources

- **Next.js Docs:** https://nextjs.org/docs
- **Apify Docs:** https://docs.apify.com/
- **Supabase Docs:** https://supabase.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **Gemini API Docs:** https://ai.google.dev/docs
