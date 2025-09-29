# Apify Pipeline Implementation Plan

## Data-First Backbone
- **Primary storage (`Supabase`, Postgres 17):** tables `raw_tweets`, `normalized_tweets`, `tweet_sentiments`, `sentiment_failures`, `keywords`, `cron_runs` mirror the specification draft and remain append-first for lineage tracking ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L64-L117)).
- **Derived artifacts:** Supabase views (`vw_daily_sentiment`, `vw_keyword_trends`) and CSV exports feed analytics; Gemini responses are logged to `tweet_sentiments` with `model_version` to preserve provenance ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L38-L43)).
- **Operational metadata:** `cron_runs` captures run statistics, failure payloads, and concurrency notes required for Apify throttling reviews ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L110-L117), [apify-scraper-params.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/apify-scraper-params.md#L11-L22)).
- **Secrets & compliance:** `sb_secret_*` keys, Gemini API tokens, and Apify tokens rotate via Supabase and Vercel secret stores aligned with PG17 extension constraints ([overview.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/overview.md#L15-L22), [supabase.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/supabase.md#L7-L20)).

### Data Artifact Checklist
- [ ] Confirm `raw_tweets` JSON schema and retention policy.
- [ ] Validate `keywords` seed list and ownership (Analytics).
- [ ] Document Supabase views/materializations needed for dashboard KPIs.
- [ ] Define audit trail for Gemini prompts and outputs.

---

## Milestone 0 — Foundations (Sprint 0)
**Sprint window:** Weeks 1–2

### Goals & Success Criteria
- Shared understanding of pipeline scope, compliance constraints, and data lineage aligned with Apify scraper limits and Vercel cron proxying ([overview.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/overview.md#L6-L20), [vercel-cron.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/vercel-cron.md#L4-L9), [apify-twitter.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/apify-twitter.md#L8-L21)).
- Data model (ERD + Supabase migration draft) signed off by Data + Analytics.
- Secrets inventory documented using `sb_secret_*` rotation guidance ([supabase.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/supabase.md#L7-L20)).

### Task Checklist (assignable to junior devs)
- [ ] Compile glossary of data entities (`raw_tweets`, `normalized_tweets`, etc.) with producer/consumer mapping.
- [ ] Draft Supabase migration scripts in `db/migrations/000-init.sql` (scaffold only).
- [ ] Create configuration matrix covering Apify inputs (`tweetLanguage`, `sort`, batch limits) ([apify-scraper-params.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/apify-scraper-params.md#L4-L22)).
- [ ] Write runbook outline for Vercel cron -> internal `/api/start-apify-run` proxy ([vercel-cron.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/vercel-cron.md#L4-L9)).

### Dependencies & Touchpoints
- **Analytics:** Confirm keyword taxonomy and reporting cadence.
- **Ops:** Define secret storage workflow on Supabase/Vercel; align on cron schedule >5 minute pauses per Apify policy ([apify-twitter.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/apify-twitter.md#L8-L21)).

### Risk Mitigation & Validation
- [ ] Review Apify anti-monitoring requirements with legal/compliance to avoid account throttling.
- [ ] Dry-run migration scripts against Supabase local dev (`supabase start`) with empty tables.

---

## Milestone 1 — Supabase Schema & Data Access (Sprint 1)
**Sprint window:** Weeks 3–4

### Goals & Success Criteria
- Supabase tables, indexes, and append-only triggers deployed; lineage metadata present ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L64-L117)).
- `vw_daily_sentiment` and `vw_keyword_trends` views return seeded sample data for dashboard use.
- Secrets rotated and stored as `sb_secret_*` values per platform guidance ([supabase.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/supabase.md#L7-L15)).

### Task Checklist
- [ ] Implement migrations for core tables + triggers updating `status` and timestamps.
- [ ] Seed `keywords` with Analytics-provided list; add ownership notes in README.
- [ ] Create Supabase Row Level Security rules for `normalized_tweets` and `tweet_sentiments` (read-only for dashboard role).
- [ ] Script for rotating Supabase secrets via CLI, documenting the process.

### Dependencies & Touchpoints
- **Analytics:** Provide initial keyword list + priority tags.
- **Ops:** Approve secret rotation process and schedule.

### Risk Mitigation & Validation
- [ ] Run Supabase migration tests locally and in staging, capturing rollback steps.
- [ ] Verify PG17 extensions used remain supported; identify alternatives if necessary ([supabase.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/supabase.md#L8-L11)).

---

## Milestone 2 — Apify Ingestion Pipeline (Sprint 2)
**Sprint window:** Weeks 5–6

### Goals & Success Criteria
- Apify actor configured to pull keywords from Supabase, respect query batching (<5 simultaneous) and pause limits ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L15-L35), [apify-twitter.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/apify-twitter.md#L8-L21)).
- Runs persist raw payloads and normalized rows with duplicate checks by `platform_id` + `platform`.
- Vercel cron hitting `/api/start-apify-run`; manual trigger docs updated ([vercel-cron.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/vercel-cron.md#L4-L9)).

### Task Checklist
- [ ] Scaffold Apify actor with TypeScript template; implement input schema using `tweetLanguage`, `sort`, `maxItems`.
- [ ] Connect actor to Supabase via service role; fetch `keywords` and log `cron_runs` metrics.
- [ ] Build normalization module mapping actor output to `normalized_tweets` with enrichment (timestamp, language, engagement) ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L26-L35)).
- [ ] Implement Vercel API route that authenticates Apify and logs invocation metadata.
- [ ] Add retry/backoff logic for network and rate-limit errors (max 3 attempts) ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L20-L21)).

### Dependencies & Touchpoints
- **Ops:** Provision Apify proxy pool if scraping requires it; confirm cron schedule meets Pro plan limits.
- **Analytics:** Validate normalization output fields before ingestion continues.

### Risk Mitigation & Validation
- [ ] Sandbox run against low-volume keyword with Apify console; verify pause compliance.
- [ ] Record ingestion metrics in Supabase and share with Ops for review.

---

## Milestone 3 — Sentiment Processing (Sprint 3)
**Sprint window:** Weeks 7–8

### Goals & Success Criteria
- Supabase Edge Function processes new `normalized_tweets` entries, calls `gemini-2.5-flash` with structured output (enum labels), stores results in `tweet_sentiments` ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L38-L43), [gemini-sentiment.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/gemini-sentiment.md#L4-L21)).
- Failure handling writes to `sentiment_failures` with retry counts and schedules fallback replays.
- Rate-limit guardrails documented (Free vs paid RPM/RPD) with scaling plan.

### Task Checklist
- [ ] Implement Supabase Edge Function (TypeScript) monitoring `normalized_tweets` insert queue.
- [ ] Create prompt template enforcing enum output (`positive|neutral|negative`) and summary field.
- [ ] Add Gemini client wrapper with exponential backoff + cost logging.
- [ ] Build CLI or script to replay failed sentiments using Vercel serverless fallback.

### Dependencies & Touchpoints
- **Ops:** Ensure Gemini API key stored in Supabase/Vercel secrets; review cost forecasts.
- **Analytics:** Sign off sentiment categories and summary schema.

### Risk Mitigation & Validation
- [ ] Run load test with mock Gemini stub before hitting live API ([gemini-sentiment.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/gemini-sentiment.md#L10-L16)).
- [ ] Track token usage vs rate limits; define alert thresholds.

---

## Milestone 4 — Dashboard & API Integration (Sprint 4)
**Sprint window:** Weeks 9–10

### Goals & Success Criteria
- Next.js 15 App Router dashboard consuming Supabase views with async request APIs compliant with Node.js 20 deployments ([overview.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/overview.md#L11-L19), [nextjs-vercel.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/nextjs-vercel.md#L4-L17)).
- Pages: Overview metrics, keyword trends, tweet detail with filters (time, sentiment, language) ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L45-L48)).
- Authentication uses Supabase `@supabase/ssr` helpers and respects async request APIs.

### Task Checklist
- [ ] Scaffold dashboard pages with layout + loading states; integrate Supabase client via server actions.
- [ ] Implement charts/tables referencing `vw_daily_sentiment` and `vw_keyword_trends`.
- [ ] Add filters and pagination hitting Supabase RPCs or queries.
- [ ] Configure Vercel deployment targeting Node.js 20; update `next.config.ts` if needed.
- [ ] Document manual QA checklist covering accessibility and responsive layout.

### Dependencies & Touchpoints
- **Design/Analytics:** Provide chart specs and KPI definitions.
- **Ops:** Validate Vercel Pro tier budget given cron and dashboard usage ([nextjs-vercel.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/nextjs-vercel.md#L14-L17)).

### Risk Mitigation & Validation
- [ ] Run `npm run check` and accessibility audit (Lighthouse) nightly.
- [ ] Smoke test Supabase auth flows in staging to ensure token refresh works with async APIs.

---

## Milestone 5 — Operations & Hardening (Sprint 5)
**Sprint window:** Weeks 11–12

### Goals & Success Criteria
- Monitoring, alerting, and runbooks established across Apify, Supabase, Vercel ([overview.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/overview.md#L97-L102), [specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L136-L157)).
- Backfill strategy executed for last 30 days respecting Apify pause limits ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L35-L43)).
- Compliance checklist (data retention, rate-limit adherence, secret rotation) signed off.

### Task Checklist
- [ ] Implement Supabase cron + queue pattern for backfill batches; log progress to `cron_runs` ([supabase.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/supabase.md#L11-L12)).
- [ ] Configure monitoring dashboards (Supabase logs, Apify run logs, Vercel cron status) and alert channels.
- [ ] Finalize data retention policy for `raw_tweets` (TTL or archival job).
- [ ] Conduct incident response drill for Apify ban scenario (switch to manual triggers, adjust schedule).

### Dependencies & Touchpoints
- **Ops/Legal:** Approve retention and compliance documentation.
- **Analytics:** Validate backfill completeness and trend accuracy.

### Risk Mitigation & Validation
- [ ] Perform staged backfill dry-run with capped `maxItems` before full execution.
- [ ] Document recovery steps for each critical failure path (Apify outage, Supabase downtime, Gemini quota exhaustion).

---

## Ongoing Operations & Extension Ideas
- **Routine checks:** Weekly review of `cron_runs` success ratio, Gemini cost dashboards, and Supabase storage (target <80% capacity) ([overview.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/overview.md#L97-L102), [supabase.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/supabase.md#L13-L15)).
- **Extension backlog:** Evaluate Supabase Realtime streaming once quotas allow, consider alerting for sentiment spikes, and explore PPR once Next.js graduates the feature from experimental ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L48-L49), [nextjs-vercel.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/nextjs-vercel.md#L8-L17)).
- **Future data sources:** Prepare ingestion adapters for Reddit/HN once policies permit, reusing the established raw/normalized/sentiment schema ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L5-L6)).

---

## Appendix — Reference Roles & Artifacts
- **Runbooks:** `docs/runbooks/apify-ingestion.md`, `docs/runbooks/gemini-sentiment.md` (to be authored during execution).
- **Secrets registry:** Maintained in Ops vault referencing Supabase/Vercel secret IDs.
- **Test fixtures:** Synthetic tweet datasets stored in `mocks/apify/` for local dry runs ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L204-L210)).
