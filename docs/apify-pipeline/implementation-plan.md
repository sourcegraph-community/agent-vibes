# Apify Pipeline Implementation Plan

Architekturhinweis: Umsetzung erfolgt innerhalb des Vertical Slice `src/Features/ApifyPipeline`. App-Router-Endpunkte (`Ui/Application/Endpoints`), Scheduler-Befehle (`Scheduler/Application`), Domain-Persistenz (`Domain/Persistence`) und Integrationen (`Domain/Integrations`) bleiben slice-lokal und werden aus dem Next.js `app/` Verzeichnis nur weitergereicht.

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
- [x] Compile glossary of data entities (`raw_tweets`, `normalized_tweets`, etc.) with producer/consumer mapping.
- [x] Draft Supabase migration scripts in `src/Features/ApifyPipeline/Domain/Persistence/Migrations/20250929_1200_InitApifyPipeline.sql` (scaffold only).
- [x] Create configuration matrix covering Apify inputs (`tweetLanguage`, `sort`, batch limits) ([apify-scraper-params.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/apify-scraper-params.md#L4-L22)).
- [x] Write runbook outline für den Vercel Cron → internen `/api/start-apify-run` Proxy in `src/Features/ApifyPipeline/Docs/Runbooks/ApifyPipeline-start-apify-run-runbook.md` ([vercel-cron.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/vercel-cron.md#L4-L9)).

#### Deliverables
##### Data Entity Glossary
| Entität | Beschreibung | Primäre Quelle | Hauptverbraucher | Schlüsselattribute | Lineage & Aufbewahrung |
| --- | --- | --- | --- | --- | --- |
| raw_tweets | Rohdatensammlung für Debugging und Backfills ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L31-L36)) | Apify Actor nach jedem Lauf ([overview.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/overview.md#L6-L12)) | Data/Eng Ops für Debug & Re-Runs | `platform_id`, `platform`, `collected_at`, `payload` | Append-only; Retention noch zu finalisieren; Duplikaterkennung über `platform_id`. |
| normalized_tweets | Normalisierte Tweet-Records inkl. Metadaten/Status ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L73-L88)) | Apify Actor nach Transform | Supabase Edge Function, Dashboard, Analytics | `posted_at`, `language`, `keywords[]`, `status` | Append-only, Versionierung via `revision`, steuert Sentiment-Queue. |
| tweet_sentiments | Persistierte Sentiment-Ergebnisse ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L89-L97)) | Supabase Edge Function (Gemini) | Analytics, Dashboard, QA | `sentiment_label`, `sentiment_score`, `model_version`, `processed_at` | Verknüpft mit `normalized_tweet_id`, unterstützt Re-Scoring nach Modellwechsel. |
| sentiment_failures | Fehler-Log für fehlgeschlagene Sentiment-Runs ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L98-L104)) | Supabase Edge Function bei Retry Exhaustion | Ops/ML für Re-Runs, Monitoring | `error_message`, `retry_count`, `last_attempt_at` | Dient als Retry-Backlog; Retention bis Abschluss der Wiederholung offen. |
| keywords | Steuerung der zu trackenden Schlagwörter ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L105-L109)) | Product/Analytics | Apify Actor, Monitoring KPIs | `keyword`, `enabled`, `last_used_at` | Historisiert Aktivierung; Updates greifen beim nächsten Run. |
| cron_runs | Lauf-Metadaten zur Erfolgskontrolle ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L110-L117)) | Vercel Cron bzw. manuelle Trigger | Ops, Observability, Cost Controls | `status`, `processed_count`, `errors` | Append-only Verlauf; bildet Grundlage für Pause-/Duplikatraten-Analyse. |

##### Supabase Migration Draft
Vorgeschlagenes SQL-Skelett für `src/Features/ApifyPipeline/Domain/Persistence/Migrations/20250929_1200_InitApifyPipeline.sql` mit append-only Trigger pro Tabelle und Status-Enums:

```sql
-- src/Features/ApifyPipeline/Domain/Persistence/Migrations/20250929_1200_InitApifyPipeline.sql (Draft)
create schema if not exists public;

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create type normalized_tweet_status as enum ('pending_sentiment', 'processed', 'failed');
create type cron_run_status as enum ('queued', 'running', 'succeeded', 'partial_success', 'failed');

create or replace function public.enforce_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Append-only table "%": direct % not permitted', TG_TABLE_NAME, TG_OP;
end;
$$;

create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null,
  keyword_batch text[] not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status cron_run_status not null,
  processed_new_count integer not null default 0 check (processed_new_count >= 0),
  processed_duplicate_count integer not null default 0 check (processed_duplicate_count >= 0),
  processed_error_count integer not null default 0 check (processed_error_count >= 0),
  metadata jsonb not null default '{}',
  errors jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.raw_tweets (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.cron_runs(id) on delete restrict,
  platform text not null default 'twitter',
  platform_id text not null,
  collected_at timestamptz not null,
  payload jsonb not null,
  ingestion_reason text not null default 'initial',
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint raw_tweets_unique_per_run unique (run_id, platform, platform_id)
);

create table if not exists public.normalized_tweets (
  id uuid primary key default gen_random_uuid(),
  raw_tweet_id uuid references public.raw_tweets(id) on delete restrict,
  run_id uuid references public.cron_runs(id) on delete restrict,
  platform text not null default 'twitter',
  platform_id text not null,
  revision smallint not null default 1 check (revision > 0),
  author_handle text,
  author_name text,
  posted_at timestamptz not null,
  collected_at timestamptz not null,
  language text,
  content text not null,
  url text,
  engagement_likes integer check (engagement_likes >= 0),
  engagement_retweets integer check (engagement_retweets >= 0),
  keyword_snapshot text[] not null default '{}',
  status normalized_tweet_status not null default 'pending_sentiment',
  status_changed_at timestamptz not null default now(),
  model_context jsonb not null default '{}',
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint normalized_tweets_unique_version unique (platform, platform_id, revision)
);

create table if not exists public.tweet_sentiments (
  id uuid primary key default gen_random_uuid(),
  normalized_tweet_id uuid not null references public.normalized_tweets(id) on delete restrict,
  model_version text not null,
  sentiment_label text not null check (sentiment_label in ('positive', 'neutral', 'negative')),
  sentiment_score numeric(4,3) check (sentiment_score between -1 and 1),
  reasoning jsonb,
  processed_at timestamptz not null default now(),
  latency_ms integer check (latency_ms >= 0),
  created_at timestamptz not null default now(),
  constraint tweet_sentiments_unique_model unique (normalized_tweet_id, model_version)
);

create table if not exists public.sentiment_failures (
  id uuid primary key default gen_random_uuid(),
  normalized_tweet_id uuid references public.normalized_tweets(id) on delete restrict,
  model_version text,
  failure_stage text not null,
  error_code text,
  error_message text not null,
  retry_count integer not null default 0 check (retry_count >= 0),
  last_attempt_at timestamptz not null default now(),
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.keywords (
  keyword text primary key,
  is_enabled boolean not null default true,
  priority smallint not null default 100,
  source text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  note text
);

create trigger cron_runs_prevent_update
  before update or delete on public.cron_runs
  for each row execute function public.enforce_append_only();

create trigger raw_tweets_prevent_update
  before update or delete on public.raw_tweets
  for each row execute function public.enforce_append_only();

create trigger normalized_tweets_prevent_update
  before update or delete on public.normalized_tweets
  for each row execute function public.enforce_append_only();

create trigger tweet_sentiments_prevent_update
  before update or delete on public.tweet_sentiments
  for each row execute function public.enforce_append_only();

create trigger sentiment_failures_prevent_update
  before update or delete on public.sentiment_failures
  for each row execute function public.enforce_append_only();

create trigger keywords_prevent_update
  before update or delete on public.keywords
  for each row execute function public.enforce_append_only();

-- TODO: Indexstrategie nach Query-Analyse definieren.
-- TODO: RLS-Policies nach Rollenkonzept ergänzen.
-- TODO: Entscheid für Duplikat-Handling/Revision finalisieren.
```

##### Apify Configuration Matrix
| Parameter | Beschreibung | Empfehlung | Quelle | Owner | Hinweise | Secret/Config |
| --- | --- | --- | --- | --- | --- | --- |
| `tweetLanguage` | ISO 639-1 Filter | Primär `en`, `de`; Erweiterung nach Analytics-Freigabe | [specification.md §12](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L168-L196), [apify-scraper-params.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/apify-scraper-params.md#L4-L9) | Analytics | Sprachumfang muss Keywords spiegeln. | Config (Supabase `keywords` Metadaten) |
| `sort` | Ergebnisreihenfolge | Default `Top`; `Latest` für Echtzeit-Kampagnen | [specification.md §12](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L193-L194), [apify-scraper-params.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/apify-scraper-params.md#L6-L9) | Analytics | `Latest` erhöht Load → längere Pausen. | Config |
| `searchTerms` | Keyword-Batch | Supabase `keywords` ≤5 pro Run | [specification.md §3.1](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L16-L23) | Analytics | Deaktivierte Keywords überspringen Batch. | Config |
| `maxItems` | Tweets pro Keyword | 200 für Backfill, ≥50 laut Policy | [specification.md §12](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L175-L176) | Analytics | Für Dev kleiner wählen. | Config |
| `maxRequestRetries` | Retry-Anzahl | 3 mit Exponential Backoff | [specification.md §3.1](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L16-L22) | Ops | >3 triggert Anti-Monitoring. | Config |
| `batchQueriesPerRun` | Query-Kapazität | ≤5 simultane Queries | [apify-scraper-params.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/apify-scraper-params.md#L11-L13) | Ops | Größere Listen aufteilen. | Config |
| `runCooldownMinutes` | Pause zwischen Runs | ≥5 Minuten | [apify-scraper-params.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/apify-scraper-params.md#L11-L13) | Ops | Abhängig von `sort` dynamisch justieren. | Config |
| `minimumRetweets`/`minimumFavorites`/`minimumReplies` | Engagement-Filter | Default `null`; kampagnenspezifisch setzen | [specification.md §12](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L188-L190) | Analytics | Hohe Werte senken Volumen. | Config |
| `APIFY_TOKEN` | Apify Auth | Vierteljährlich rotieren | [specification.md §8](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L142-L146) | Ops | Pflicht für Cron & Manual Run. | Secret |
| `SUPABASE_SECRET_KEY` | Service Role | In Vercel & Apify Secret Store halten | [specification.md §8](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L142-L146) | Ops | Nicht in Logs exposen. | Secret |

##### Vercel Cron Runbook Outline
- **Trigger:** Vercel Cron (z. B. `0 */2 * * *`) ruft `/api/start-apify-run` nur auf Production auf ([vercel-cron.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/vercel-cron.md#L4-L14)); die Route `app/api/start-apify-run/route.ts` re-exportiert den Slice-Endpunkt `src/Features/ApifyPipeline/Ui/Application/Endpoints/StartApifyRun`.
- **Auth & Secrets:** `sb_secret_*` und `APIFY_TOKEN` über Vercel Secret Store; Rotation gemäß Ops-Kalender (TBD) ([overview.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/overview.md#L15-L22)).
- **Ablauf:** Cron -> API Route -> Apify Run API -> Persistenz in `cron_runs`; die Slice-Schicht verarbeitet dies über `src/Features/ApifyPipeline/Scheduler/Application/Commands/ScheduleApifyRun`, Fehlerpfade schreiben detaillierte Payloads.
- **Monitoring:** Vercel Cron Dashboard, Apify Run Logs, Supabase `cron_runs` KPIs; Alerts bei ≥2 aufeinanderfolgenden Fehlschlägen (TBD).
- **Eskalation:** Primär Ops-Oncall, sekundär Backend für Actor Issues; Slack-Kanal & Rotation noch zu bestätigen.
- **Verification Checklist:** Cron erfolgreich, API <2s 2xx, Apify Run `SUCCEEDED`, frische `cron_runs`-Zeile, Dashboard-Daten <3h alt.

#### Outstanding Questions & Follow-ups
- Retention-Entscheidung für `raw_tweets` & `sentiment_failures` finalisieren ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L162)).
- Apify Bestätigung einholen: Mindestanzahl Tweets pro Query (≥50) und Cooldown-Policy schriftlich absichern.
- Secret-Rotation-Kalender mit Ops abstimmen (`sb_secret_*`, `APIFY_TOKEN`, Gemini Schlüssel).
- Staging-Cron-Zeitplan und Request-Signature-Strategie für `/api/start-apify-run` klären.
- Owner für Gemini Retry-Fallback und Monitoring-Alerting definieren.

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
- [x] Implement migrations for core tables + triggers updating `status` and timestamps.
- [x] Seed `keywords` with Analytics-provided list; add ownership notes in README.
- [x] Create Supabase Row Level Security rules for `normalized_tweets` and `tweet_sentiments` (read-only for dashboard role).
- [x] Script for rotating Supabase secrets via `npm run rotate:supabase` (TypeScript Management-API Workflow) dokumentiert.

### Dependencies & Touchpoints
- **Analytics:** Provide initial keyword list + priority tags.
- **Ops:** Approve secret rotation process and schedule.

#### Delivery Notes (2025-09-29)
- `src/Features/ApifyPipeline/Domain/Persistence/Migrations/20250929_1200_InitApifyPipeline.sql` provisions tables, append-only triggers, RLS, and analytic views required for Milestone 1.
- `src/Features/ApifyPipeline/Domain/Persistence/Seeds/20250929_1230_KeywordsSeed.sql` hydrates keywords plus demo sentiment data to validate `vw_daily_sentiment` and `vw_keyword_trends`.
- `npm run rotate:supabase` (Script [`scripts/rotate-supabase-secrets.ts`](file:///home/prinova/CodeProjects/agent-vibes/scripts/rotate-supabase-secrets.ts)) rotiert `sb_secret_*` Credentials via Supabase Management API + Secrets Endpoint ohne Werte zu loggen.

### Risk Mitigation & Validation
- [ ] Run Supabase migration tests locally and in staging, capturing rollback steps.
- [ ] Verify PG17 extensions used remain supported; identify alternatives if necessary ([supabase.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/supabase.md#L8-L11)).

---

## Milestone 2 — Apify Ingestion Pipeline (Sprint 2)
**Sprint window:** Weeks 5–6

### Goals & Success Criteria
- Apify actor configured to pull keywords from Supabase, respect query batching (<5 simultaneous) and pause limits ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L15-L35), [apify-twitter.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/apify-twitter.md#L8-L21)).
- Runs persist raw payloads and normalized rows with duplicate checks by `platform_id` + `platform`.
- Vercel Cron hitting `/api/start-apify-run` (`app/api/start-apify-run/route.ts` → `src/Features/ApifyPipeline/Ui/Application/Endpoints/StartApifyRun`); manual trigger docs updated ([vercel-cron.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/vercel-cron.md#L4-L9)).

### Task Checklist
- [x] Scaffold Apify actor with TypeScript template; implement input schema using `tweetLanguage`, `sort`, `maxItems`.
- [x] Connect actor to Supabase via service role; fetch `keywords` and log `cron_runs` metrics.
- [x] Build normalization module mapping actor output to `normalized_tweets` with enrichment (timestamp, language, engagement) ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L26-L35)).
- [x] Implement Vercel API route `app/api/start-apify-run/route.ts`, die den Slice-Handler `src/Features/ApifyPipeline/Ui/Application/Endpoints/StartApifyRun` authentifiziert und Invocation-Metadaten schreibt.
- [x] Add retry/backoff logic for network and rate-limit errors (max 3 attempts) ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L20-L21)).

### Dependencies & Touchpoints
- **Ops:** Provision Apify proxy pool if scraping requires it; confirm cron schedule meets Pro plan limits.
- **Analytics:** Validate normalization output fields before ingestion continues.

### Risk Mitigation & Validation
- [ ] Sandbox run against low-volume keyword with Apify console; verify pause compliance.
- [ ] Record ingestion metrics in Supabase and share with Ops for review.

#### Delivery Notes (2025-09-29)
- `app/api/start-apify-run/route.ts` re-exportiert den Slice-Endpunkt für Vercel Cron und manuelle Trigger.
- `src/Features/ApifyPipeline/Ui/Application/Endpoints/StartApifyRun/StartApifyRunEndpoint.ts` kapselt Request-Parsing und ruft den Scheduler-Command an.
- `src/Features/ApifyPipeline/Scheduler/Application/Commands/StartApifyRun/StartApifyRunCommand.ts` validiert Optionen und startet den Apify Actor via REST API.
- `src/Features/ApifyPipeline/Scheduler/Application/Actors/TweetCollector/TweetCollectorActor.ts` orchestriert Keyword-Fetch, Apify Scraper-Läufe, Duplikatprüfung sowie Inserts in `cron_runs`, `raw_tweets` und `normalized_tweets`.
- Neue Slice-Layer (`Domain/Integrations`, `Domain/Persistence/Repositories`, `Domain/Transformations`, `Domain/Utilities`) stellen Supabase-Service-Clients, Repositories und Normalisierungslogik bereit.

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
- **Runbooks:** `src/Features/ApifyPipeline/Docs/Runbooks/ApifyPipeline-ingestion-runbook.md`, `src/Features/ApifyPipeline/Docs/Runbooks/ApifyPipeline-gemini-sentiment-runbook.md` (to be authored during execution).
- **Secrets registry:** Maintained in Ops vault referencing Supabase/Vercel secret IDs.
- **Test fixtures:** Synthetic tweet datasets stored in `src/Features/ApifyPipeline/Tests/Fixtures/apify/` für lokale Dry Runs ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L204-L210)).
