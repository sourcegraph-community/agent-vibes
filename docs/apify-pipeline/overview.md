# Apify Pipeline Concept

## Objective
The pipeline regularly collects tweets about coding agents, normalizes the data, analyzes sentiments, and presents the results in a hosted dashboard.

Architecture note: The repository follows a Vertical Slice Architecture. The complete pipeline lives in the `src/ApifyPipeline` slice, which encapsulates both the scheduler jobs and the Next.js App Router interface. API routes in the `app/api` directory merely import slice endpoints (REPR: Request → Endpoint → Handler → Response DTO), so any changes remain within the slice.

## High-Level Flow
1. **Trigger:** A Vercel Cron Job (Pro plan) calls the internal endpoint `/api/start-apify-run`, which then invokes the Apify Run API. The App Router file `app/api/start-apify-run/route.ts` re-exports the slice endpoint `src/ApifyPipeline/Web/Application/Commands/StartApifyRun`. Manual runs can also be triggered.
2. **Data Collection (Apify Actor):** The Actor uses either X API Pro access (~US$5k/month) or the Apify Tweet Scraper; the latter is subject to anti-monitoring restrictions, so intervals must be carefully throttled.
3. **Preprocessing:** Raw tweets are cleaned, enriched (e.g., source, timestamp, platform), and transformed into a uniform format.
4. **Persistence (Supabase):** Normalized records are stored in Supabase. Historical values are preserved and form the foundation for analysis.
5. **Sentiment Analysis (Gemini):** Gemini 2.5 classifies sentiments via Structured Output (no dedicated sentiment API) and stores results back in Supabase; costs/TPS are monitored depending on model variant (Flash, Flash Lite, Pro).
6. **Frontend (Vercel):** A Next.js application visualizes the data (trends, metrics, individual records) and exclusively consumes the Supabase API.

## Components & Responsibilities
- **Apify Actor:** Data collection, normalization, delivery to Supabase – either via X API (Pro tier) or Apify Scraper with regulatory throttling. (Slice: `src/ApifyPipeline/Background/Jobs/TweetCollector`)
- **Supabase:** Persistence layer (tables for raw data, normalized tweets, sentiment results) with `sb_secret_*` keys and PG17-compliant extensions. (Slice: `src/ApifyPipeline/DataAccess`)
- **Google Gemini:** Structured-output classification via a server-side function or worker that responds to new records. (Slice: `src/ApifyPipeline/ExternalServices/Gemini`)
- **Next.js Frontend:** Display of statistics, filtering, trend detection; build target Node.js 20+ on Vercel. (Slice: `src/ApifyPipeline/Web/Components/Dashboard`)
- **Vercel Cron:** Time-triggered execution of the internal `/api/start-apify-run` proxy. (Slice: `src/ApifyPipeline/Web/Application/Commands/StartApifyRun`)

> Note: Supabase rotates secrets as `sb_secret_*`; deployments must regularly renew service role keys and choose PG17-compatible extensions.
> Note: Next.js builds on Vercel run exclusively on Node.js 20+ as of September 2025, tests should account for the App Router's async Request APIs.

## Data Flow (Mermaid)
```mermaid
graph TB
    %% Data Sources
    subgraph Sources [🌐 Data Sources]
        Twitter[📢 Twitter/X<br/>Coding Agent Keywords]
    end

    %% Collection Layer
    subgraph Collection [📥 Data Collection]
        AutoCron[⏰ Vercel Cron<br/>Automatic Runs]
        ManualTrigger[🔍 Manual Trigger]
        Actor[🤖 Apify Actor
              <br/>Fetching & Normalization]
    end

    %% Processing & Intelligence
    subgraph Processing [🧠 Processing]
        DataNorm[📊 Data Normalization]
        Sentiment[😊 Sentiment Analysis]
        Insights[💡 Insights & Trends]
    end

    %% Storage
    subgraph Storage [🗄️ Persistence]
        Database[(📚 Supabase<br/>Tweets & Analysis)]
    end

    %% Frontend
    subgraph Frontend [🌐 Web Application]
        Analytics[📈 Dashboard on Vercel]
    end

    %% External Services
    subgraph External [☁️ External Services]
        Gemini[🤖 Gemini API]
        Vercel[⚡ Vercel Hosting & Cron]
    end

    %% Main Data Flow
    Twitter --> Actor

    AutoCron --> Actor
    ManualTrigger --> Actor

    Actor --> DataNorm
    DataNorm --> Database
    DataNorm --> Sentiment

    Sentiment --> Gemini
    Gemini --> Database

    Database --> Insights
    Insights --> Analytics

    Vercel -.-> AutoCron
    Vercel -.-> Analytics

    classDef source fill:#1a365d,stroke:#3182ce,color:#ffffff
    classDef collect fill:#2d3748,stroke:#38b2ac,color:#ffffff
    classDef process fill:#2d3748,stroke:#9f7aea,color:#ffffff
    classDef storage fill:#2d3748,stroke:#e53e3e,color:#ffffff
    classDef frontend fill:#2d3748,stroke:#48bb78,color:#ffffff
    classDef external fill:#2d3748,stroke:#ed8936,color:#ffffff

    class Twitter source
    class AutoCron,ManualTrigger,Actor collect
    class DataNorm,Sentiment,Insights process
    class Database storage
    class Analytics frontend
    class Gemini,Vercel external
```

## Current Status
- The Supabase base schema including append-only triggers and RLS policies exists as a migration under `src/ApifyPipeline/DataAccess/Migrations/20250929_1200_InitApifyPipeline.sql`.
- Views `vw_daily_sentiment` and `vw_keyword_trends` are created and provide sample metrics for the dashboard thanks to seed data (`src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql`).
- Supabase secret rotation runs via `npm run rotate:supabase` (TypeScript script [`scripts/rotate-supabase-secrets.ts`](file:///home/prinova/CodeProjects/agent-vibes/scripts/rotate-supabase-secrets.ts) uses Supabase Management API + Secrets Endpoint).
- The ingestion slice provides `/api/start-apify-run` via `app/api/start-apify-run/route.ts` and delegates to `src/ApifyPipeline/Web/Application/Commands/StartApifyRun` + `Background/Jobs/TweetCollector`.
- The Apify Actor under `src/ApifyPipeline/Background/Jobs/TweetCollector/TweetCollectorJob.ts` fetches keywords from Supabase, starts the Twitter scraper, writes `cron_runs`, `raw_tweets` and `normalized_tweets`, and marks duplicates.

## Open Items for Later Iterations
- Specify error handling and monitoring (retries, alerting).
- Define authentication and access functions for Supabase and Apify.
- Evaluate cost and latency considerations for Apify, Supabase, and Gemini.
- Plan integration tests and staging setup.
