# Apify Pipeline – Technical Specification

## 1. Goal & Scope
- **Goal:** Automated collection, processing, and visualization of social media mentions about coding agents.
- **Scope:** Production-ready pipeline for tweets (MVP). Extensibility to other sources is planned but not part of the first iteration.

Architecture note: The pipeline is organized as a Vertical Slice `src/ApifyPipeline`. Within the slice are web endpoints (`Web/Application/Commands`), background jobs (`Background/Jobs`), pure business logic (`Core`), Supabase access (`DataAccess`), and external integrations (`ExternalServices`). Shared contracts remain slice-local and are merely re-exported from `app/api`.

## 2. Stakeholders & Responsibilities
- **Product/Analytics:** Define keywords, reporting requirements, and KPIs.
- **Engineering (Data/Backend):** Implement Apify Actor, normalization, Supabase integration.
- **Engineering (ML/AI):** Maintain sentiment service with Gemini and improve models.
- **Engineering (Frontend):** Create dashboard in Next.js, provide visualizations.
- **Ops/Platform:** Manage secrets, monitoring, deployment on Vercel.

## 3. Functional Requirements
### 3.1 Data Collection
- Vercel Cron calls the internal endpoint `/api/start-apify-run`, which proxies the Apify Run API call; intervals under 24h require at least the Vercel Pro plan. The route `app/api/start-apify-run/route.ts` imports the handler `src/ApifyPipeline/Web/Application/Commands/StartApifyRun` (REPR entry point).
- Manual triggers via Apify UI or REST endpoint remain unchanged.
- Data collection uses the Apify Twitter Search Scraper; scraper runs must respect anti-monitoring requirements (pauses, max five queries). The actor defaults to a five-minute cooldown between keyword batches and limits each batch to five queries to comply.
- Actor uses a predefined keyword list (configurable via Supabase table `keywords`).
- On API limit errors or network errors, retry occurs (exponential up to 3 attempts).
- Monitoring of duplicate rate: Stores tweet IDs in Supabase, runs document ratio `new vs. duplicated` (via `cron_runs`).

> Note: Apify scraper runs risk account throttling at high frequency.

### 3.2 Data Processing
- Actor normalizes tweets to a uniform schema (`normalized_tweets`).
- Removes duplicates based on tweet ID + platform.
- Adds metadata: timestamp, source, language, engagement (likes/retweets).

### 3.3 Persistence
- Raw data optionally in `raw_tweets` table (JSON) for debugging.
- Normalized data in `normalized_tweets`.
- Sentiment results in `tweet_sentiments`.
- Historization without mutations (append-only revisions); each status change inserts a new row keyed by tweet ID and incremented `revision`.
- Backfill strategy: One-time manual division of historical data into configurable batches (default: 30 days, 5 days per batch = 6 batches) with increased `maxItems`; processed manually to control rate limits and costs. Configurable via `BACKFILL_DAYS` and `BACKFILL_BATCH_SIZE` environment variables for testing. No automated cron - all backfill processing is user-triggered.
- Slice-specific migrations and seeds are located under `src/ApifyPipeline/DataAccess/Migrations` (naming scheme `yyyyMMdd_HHmm_Description.sql`).

### 3.4 Sentiment Analysis
- Supabase Edge Function `sentiment-processor` polls `normalized_tweets` for `pending_sentiment` records and processes them in batches while tracking retry counts per keyword.
- The function calls `gemini-2.5-flash` or `flash-lite` via Structured Output (enum `positive|neutral|negative`); Google does not provide a dedicated sentiment endpoint.
- Rate limits and costs (Free ~15 RPM/1.5M tokens per day; paid per current pricing) determine batch size and queueing; Supabase Functions + Storage Queue buffer overruns.
- API keys (`GEMINI_API_KEY`) are stored in Supabase Secrets or Vercel Env Vars and are regularly rotated.
- Results (score -1…1, category, extended insights) are stored in `tweet_sentiments`; failed calls go to `sentiment_failures`. A feature-flagged fallback (`SENTIMENT_EDGE_FALLBACK=true`) can run the legacy serverless job if the Edge Function is unavailable.
- Implementation: Source code lives in `src/ApifyPipeline/ExternalServices/Gemini/EdgeFunctions/sentimentProcessor` and is built to `supabase/functions/sentiment-processor` via `npm run build:edge-functions` before deployment.

### 3.5 Frontend / Dashboard
- Next.js 15 App Router (async Request APIs) visualizes mentions, sentiment distribution, and trends.
- Supabase integration via `@supabase/ssr` helpers and Server Actions; token refresh and cookies follow the new async pattern.
- Detail view per tweet including original link and filtering by time range, language, keyword, and sentiment.
- Realtime updates via Supabase Realtime optional (stretch goal) considering current channel and message quotas.

## 4. Non-Functional Requirements
- **Performance:** Pipeline processes at least 500 tweets per run without timeout (>60s buffer).
- **Availability:** Planned uptime 24/7; cron window may fail at most two consecutive runs.
- **Scalability:** Increase frequency and data sources without code changes (configuration only).
- **Security:** Secrets as `sb_secret_*` in Vercel/Apify/Supabase secret stores; no secrets in repo and regular rotation.
- **Compliance:** Adherence to Apify scraper guidelines; data deletion on request.

## 5. Architecture & Components
- **Apify Actor:** Node.js/TypeScript scripts using Apify Twitter Search Scraper with anti-monitoring pacing. (Slice: `src/ApifyPipeline/Background/Jobs/TweetCollector`)
- **Supabase:** Postgres + Edge Functions, auth via `sb_secret_*` keys; PG17-compatible extensions (e.g., alternatives to TimescaleDB) are considered. (Slice: `src/ApifyPipeline/DataAccess`)
- **Sentiment Worker:** Supabase Edge Function with Gemini 2.5 Structured Output, optional Vercel Serverless fallback for bulk re-runs. (Slice: `src/ApifyPipeline/ExternalServices/Gemini`)
- **Frontend:** Next.js 15 App Router on Vercel (Node.js 20, async Request APIs, `@supabase/ssr` integration). (Location: `app/dashboard/*`)
- **Monitoring:** Supabase Logs/Realtime Limits, Apify Actor Run Logs, Vercel Cron Status & plan usage. (Slice Docs: `src/ApifyPipeline/Docs`)

## 6. Data Model (Draft)
```text
raw_tweets
- id (uuid)
- platform_id (text) -- Tweet ID
- platform (text) -- "twitter"
- collected_at (timestamptz)
- payload (jsonb)

normalized_tweets
- id (uuid)
- platform_id (text)
- platform (text)
- author_handle (text)
- author_name (text)
- posted_at (timestamptz)
- collected_at (timestamptz)
- language (text)
- content (text)
- url (text)
- engagement_likes (int)
- engagement_retweets (int)
- keyword_snapshot (text[])
- status (text) -- "pending_sentiment" | "processed" | "failed"

tweet_sentiments
- id (uuid)
- normalized_tweet_id (uuid)
- sentiment_label (text) -- "positive" | "neutral" | "negative"
- sentiment_score (numeric)
- summary (text)
- model_version (text)
- processed_at (timestamptz)

sentiment_failures
- id (uuid)
- normalized_tweet_id (uuid)
- error_message (text)
- retry_count (int)
- last_attempt_at (timestamptz)

keywords
- keyword (text) PRIMARY KEY
- is_enabled (boolean)
- last_used_at (timestamptz)

cron_runs
- id (uuid)
- started_at (timestamptz)
- finished_at (timestamptz)
- status (text)
- processed_new_count (int)
- processed_duplicate_count (int)
- processed_error_count (int)
- errors (jsonb)
```

> Note: For high-volume runs, use Supabase Cron + Queue pattern (Storage + Edge Functions) to comply with Gemini limits and scraper pauses.

## 7. Workflows
### 7.1 Automatic Run
1. Vercel Cron calls `/api/start-apify-run` (Vercel Function) which proxies the Apify Run API call. The route imports the slice endpoint `src/ApifyPipeline/Web/Application/Commands/StartApifyRun`.
2. Actor uses Apify Scraper tokens and reads `keywords` from Supabase.
3. Actor fetches tweets, stores raw data (`raw_tweets`).
4. Actor transforms and upserts `normalized_tweets`.
5. Actor marks records as `pending_sentiment`.
6. Vercel cron proxy `/api/process-sentiments` invokes Supabase Edge Function `sentiment-processor`, which calls Gemini 2.5 via Structured Output.
7. Sentiment result is stored in `tweet_sentiments`, status revisions are inserted with `processed` or `failed` markers.
8. Dashboard consumes data via Supabase API.

### 7.2 Manual Run
1. User starts Actor in Apify UI or via API.
2. Steps identical to automatic run.

### 7.3 Error Handling
- Actor logs errors per run in `cron_runs.errors`.
- On API limit exceeded: backoff and abort after reaching limit, run marked as `failed`.
- Sentiment worker attempts up to 2 automatic retries; then entry in `sentiment_failures`.

## 8. Integrations & Secrets
- **Apify Tokens:** Apify Token in Apify KV Store (Production) and `.env.local` (Development).
- **Supabase Secret Keys:** `sb_secret_*` values in Vercel & Apify Secret Store; `sb_publishable_*` for client-side use.
- **Gemini API Key:** In Vercel Secret Store (Edge Function) / Supabase Secrets; rotation parallel to model version (`gemini-2.5-*`).
- **API Authentication:** `CRON_SECRET` for Vercel cron authentication (recommended), `INTERNAL_API_KEY` for manual API triggers (optional).
- **Environment Variables:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_FUNCTIONS_URL` (optional override), `SUPABASE_PUBLISHABLE_KEY`, `APIFY_TOKEN`, `APIFY_ACTOR_ID`, `GEMINI_API_KEY`, `CRON_SECRET` (recommended for production), `INTERNAL_API_KEY` (optional for manual triggers), `SENTIMENT_EDGE_FALLBACK` (optional toggle to run the legacy job when the Edge Function fails).

## 9. Deployment & Environments
- **Development:** Local Actor test with Apify CLI, Supabase local DB or project dev project; Next.js 15 App uses async Request APIs (`npm run dev`, Node 20).
- **Staging:** Separate Supabase project, Vercel Preview Environment with cron on `/api/start-apify-run`, dedicated Apify Actor env.
- **Production:** Vercel Production (Pro plan, Node.js 20 runtime), Supabase Prod, Apify Prod Actor version.
- CI/CD deploys Actor scripts via GitHub Actions/Apify CLI; frontend builds evaluate Turbopack (beta) before rollout.

## 10. Observability & Monitoring
- Apify Run Logs for each execution.
- Supabase Logdrains & Realtime dashboards for Functions and channel/message quotas.
- Vercel Cron Monitoring (Pro plan usage, failure alerts via Slack/email).
- Optional: Metrics in Supabase table `metrics_pipeline`.

## 11. Open Questions & Follow-ups
- Timeline for expansion to other sources (Reddit/HN, etc.).
- Monitoring & fine-tuning of Apify limits (validation `maxItems` ≈ 200 per keyword, cost guardrails).
- Finalize retention duration for `raw_tweets` and archival strategy.
- Handling of empty/rate-limited Actor runs (retry, alerting, pauses between runs).
- Data quality for deleted/protected tweets and missing metadata (marking vs. discarding).
- Error and retry strategy for Gemini sentiment including trigger for Vercel fallback without duplicates.

## 12. Apify Tweet Scraper Inputs
| Field | Type | Description | Default |
| --- | --- | --- | --- |
| `startUrls` | Array<string> | List of direct Twitter URLs (tweet, profile, search, list) to be crawled immediately. | `[]` |
| `searchTerms` | Array<string> | Free-text search terms, supports advanced Twitter search. | `[]` |
| `twitterHandles` | Array<string> | Twitter handles whose public timeline is searched. | `[]` |
| `conversationIds` | Array<string> | Conversation IDs for thread queries. | `[]` |
| `tweetLanguage` | string | ISO-639-1 language code to restrict results. | `null` |
| `maxItems` | number | Maximum number of returned tweets. | `Infinity` |
| `onlyVerifiedUsers` | boolean | Returns only tweets from verified accounts. | `false` |
| `onlyTwitterBlue` | boolean | Returns only tweets from Twitter Blue subscribers. | `false` |
| `onlyImage` | boolean | Filters to tweets with image attachments. | `false` |
| `onlyVideo` | boolean | Filters to tweets with video attachments. | `false` |
| `onlyQuote` | boolean | Filters to tweets that are quotes. | `false` |
| `author` | string | Restricts to tweets from a specific person (handle). | `null` |
| `inReplyTo` | string | Returns only replies to a specific account (handle). | `null` |
| `mentioning` | string | Returns tweets mentioning a specific account (handle). | `null` |
| `geotaggedNear` | string | Free-text location, tweets from the vicinity of the location. | `null` |
| `withinRadius` | string | Radius specification to combine with `geotaggedNear` (e.g., "50km"). | `null` |
| `geocode` | string | Geo-coordinates + radius (`lat,long,km`) for location filtering. | `null` |
| `placeObjectId` | string | IDs for Twitter Places; filters to tweets with this place tag. | `null` |
| `minimumRetweets` | number | Minimum number of retweets per tweet. | `null` |
| `minimumFavorites` | number | Minimum number of likes per tweet. | `null` |
| `minimumReplies` | number | Minimum number of replies per tweet. | `null` |
| `start` | string | Start date/time (ISO 8601) for result set. | `null` |
| `end` | string | End date/time (ISO 8601) for result set. | `null` |
| `sort` | string | Sorting of search results (`Top` · `Latest`). | `Top` |
| `includeSearchTerms` | boolean | Adds the used search term to each result. | `false` |
| `customMapFunction` | string | JavaScript function to customize returned objects (no filtering!). | `null` |

**Notes:**
- `customMapFunction` is executed server-side and must be idempotent; filter logic leads to Actor blocking.
- Geographic filters (`geotaggedNear`, `withinRadius`, `geocode`, `placeObjectId`) are optional but can be combined.
- When using `startUrls` and search parameters simultaneously, both sources are processed until `maxItems` is reached.

> Note: The Tweet Scraper allows only one run at a time, maximum five queries per batch and pauses of several minutes; cron schedules must meet these requirements.

## 13. Local Test Run (Pre-Prod)
1. **Start Supabase locally:** `supabase start`, apply schema migrations (tables from Section 6).
2. **Apify Actor locally:** `apify run` with `apify_config_dev.json`, keep `maxItems` small, either mock tweets or use real test keyword.
3. **Gemini Mock:** Local stub API (e.g., Express/Edge Function) or replay files to simulate sentiment without cost.
4. **Sentiment Worker locally:** Build Edge Function source with `npm run build:edge-functions`, then serve via `npm run functions:serve`; provide local `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY` secrets in `supabase/.env.local`.
5. **Next.js Frontend:** `npm run dev` (Node 20) with `.env.local`, test `@supabase/ssr` helpers and async Request APIs.
6. **End-to-End Run:** Actor -> Supabase -> Sentiment -> Frontend; check logs, duplicate statistics, and Gemini quotas; optionally test `next build --turbopack` (beta) against CI.

## 14. Future Extensions
- **Extended Dashboard KPIs:** Implementation of VistaSocial recommendations (sentiment score trends, mention volume, share of voice, platform breakdown, keyword & engagement analysis, influencer & issue tracking).
- **Sentiment Alerts:** Automated alerting on negative sentiment spikes including threshold definition and alert channel (Slack/email).
- **Realtime Functionality:** Check if limited near-real-time updates are possible without violating Apify guidelines (e.g., tightly scheduled ad-hoc runs).
- **Hosting & Cost Management:** Monitor Vercel Pro cron credits, Supabase Realtime quotas, and Gemini token prices; prepare for Next.js 16 async API stabilization.
