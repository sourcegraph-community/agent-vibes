Tino, here’s a focused migration plan to integrate Source → Target while keeping strict VSA boundaries and giving the new features their own pipeline module.

Source: '/home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing'
Target: '/home/prinova/CodeProjects/agent-vibes'

What’s new in Source (high-level)
- New VSA slice: RSS Pipeline under [RssPipeline](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/src/RssPipeline) with Core, DataAccess, ExternalServices (Miniflux + Summarizer), and Web/Application Commands.
- New API routes: [app/api/rss/*](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/app/api/rss) (sync, summarize, entries, health) and [app/api/social-sentiment](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/app/api/social-sentiment/route.ts).
- New dashboard: [app/dashboard-v2](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/app/dashboard-v2) (uses chart.js/react-chartjs-2).
- DB migrations for RSS: [src/RssPipeline/DataAccess/Migrations](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/src/RssPipeline/DataAccess/Migrations) plus a Supabase RPC: [supabase/migrations/002_create_claim_pending_summaries_function.sql](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/supabase/migrations/002_create_claim_pending_summaries_function.sql).
- Scripts: RSS ops and migrations: [apply-rss-migrations.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/scripts/apply-rss-migrations.ts), [sync-rss-entries.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/scripts/sync-rss-entries.ts), [summarize-rss-entries.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/scripts/summarize-rss-entries.ts), [cleanup-rss-failures.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/scripts/cleanup-rss-failures.ts), [reset-and-sync-rss.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/scripts/reset-and-sync-rss.ts).
- Cron: add RSS jobs in [vercel.json](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/vercel.json).

Target context to reuse
- Supabase server client: [supabase.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Infrastructure/Config/supabase.ts) (RSS already imports this path).
- Existing Apify migrations runner: [scripts/apply-migrations.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/apply-migrations.ts).
- Dashboard repository for sentiment trends already exists: [DashboardRepository.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/DataAccess/Repositories/DashboardRepository.ts).

Migration plan (phased, minimal risk)

Phase 1 — Bring the new slice and routes
Status: Completed
- Add the slice:
  - Copy [src/RssPipeline](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/src/RssPipeline) into Target under `src/` (keeps VSA vertical boundaries).
- Add API routes:
  - Copy [app/api/rss/*](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/app/api/rss) and [app/api/social-sentiment/route.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/app/api/social-sentiment/route.ts).
- Optional UI:
  - Copy [app/dashboard-v2](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/app/dashboard-v2). This is outside the slice (consistent with existing `app/` pages). Keep as a separate page so existing dashboard stays untouched.

Phase 2 — Database migrations (unified under existing runner)
- Preferred: extend Target’s [apply-migrations.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/apply-migrations.ts) to also run:
  - RSS migrations from [src/RssPipeline/DataAccess/Migrations](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/src/RssPipeline/DataAccess/Migrations) in order:
    - 20251007_1000_InitRssPipeline.sql
    - 20251007_1400_AddCollectedAt.sql
    - 20251007_1500_FixSchema.sql
    - 20251007_1600_MakeMinifluxIdNullable.sql
    - 20251007_1700_AddStatusColumn.sql
  - RPC: [002_create_claim_pending_summaries_function.sql](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/supabase/migrations/002_create_claim_pending_summaries_function.sql).
- Note: Code writes to `rss_summaries`, but there’s no create-table migration in the Source tree. We must add a simple DDL migration for `rss_summaries` before turning on summaries. Recommend adding it to `src/RssPipeline/DataAccess/Migrations/20251007_1100_CreateRssSummaries.sql` with columns used in [RssRepository.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/src/RssPipeline/DataAccess/Repositories/RssRepository.ts) (entry_id, model_version, summary_text, key_points jsonb, sentiment, topics jsonb, processed_at, latency_ms, created_at default now()).
- Alternate (not preferred): bring over [apply-rss-migrations.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/scripts/apply-rss-migrations.ts) + [bootstrap-exec-function.sql](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/scripts/bootstrap-exec-function.sql) and run via Supabase RPC. The unified runner via psql is simpler.

Phase 3 — Dependencies and scripts
- Merge deps in [package.json] Target vs Source:
  - Add runtime: `chart.js`, `react-chartjs-2` (needed by dashboard-v2).
  - Dev (optional, if we import tests): `@playwright/test`, `pg`, `@types/pg`.
- Add NPM scripts (names can be aligned to your conventions):
  - `apply-rss-migrations`, `sync-rss-entries`, `summarize-rss-entries`, `cleanup-rss-failures`, `reset-and-sync-rss` using Source scripts:
    - [apply-rss-migrations.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/scripts/apply-rss-migrations.ts) (or integrate into existing runner as above)
    - [sync-rss-entries.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/scripts/sync-rss-entries.ts)
    - [summarize-rss-entries.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/scripts/summarize-rss-entries.ts)
    - [cleanup-rss-failures.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/scripts/cleanup-rss-failures.ts)
    - [reset-and-sync-rss.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/scripts/reset-and-sync-rss.ts)
- Files to compare:
  - Target [package.json](file:///home/prinova/CodeProjects/agent-vibes/package.json) vs Source [package.json](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/package.json).

Phase 4 — Environment and config
- Add envs to `.env.example` and `.env.local`:
  - `MINIFLUX_URL`, `MINIFLUX_API_KEY`
  - `OLLAMA_BASE_URL` (default http://localhost:11434), `OLLAMA_MODEL` (e.g., llama3.1:8b)
  - Reuse existing `CRON_SECRET`/`INTERNAL_API_KEY` for protected endpoints (RSS endpoints already follow the same pattern in [GenerateSummariesEndpoint.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/src/RssPipeline/Web/Application/Commands/GenerateSummaries/GenerateSummariesEndpoint.ts) and [SyncEntriesEndpoint.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/src/RssPipeline/Web/Application/Commands/SyncEntries/SyncEntriesEndpoint.ts)).
- Cron: merge Source [vercel.json](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/vercel.json) into Target [vercel.json](file:///home/prinova/CodeProjects/agent-vibes/vercel.json):
  - Add crons:
    - `/api/rss/sync` → every 15m
    - `/api/rss/summarize` → every 30m
  - Ensure existing Apify schedules (if desired) are added similarly.

Phase 5 — VSA guardrails
- Keep RSS as its own slice: [RssPipeline](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/src/RssPipeline).
- Use slice Web/Application command endpoints wired via `app/api/*` for request entry points.
- Reuse shared Supabase client in [supabase.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Infrastructure/Config/supabase.ts). If desired later, extract to `src/Shared/Infrastructure/Config/supabase.ts`. For simplicity now, leave as-is.

Phase 6 — Validation steps
- DB:
  - Run unified migrations.
  - Verify function exists: `claim_pending_summaries`.
- API smoke tests:
  - GET [app/api/rss/health/route.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/app/api/rss/health/route.ts)
  - POST [app/api/rss/sync/route.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/app/api/rss/sync/route.ts) (authorized)
  - POST [app/api/rss/summarize/route.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/app/api/rss/summarize/route.ts) (authorized)
  - GET [app/api/rss/entries/route.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/app/api/rss/entries/route.ts)
  - GET [app/api/social-sentiment/route.ts](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/app/api/social-sentiment/route.ts)
- UI:
  - Visit [app/dashboard-v2/page.tsx](file:///home/prinova/CodeProjects/agent-vibes.worktrees/sj/testing/app/dashboard-v2/page.tsx), verify charts render after adding `chart.js` + `react-chartjs-2`.
- Local scripts:
  - `npm run sync-rss-entries` then `npm run summarize-rss-entries`.
- Repo checks:
  - `npm run check`, `npm run build`, `npm start`.

Phase 7 — Rollout
- Enable Vercel cron after verifying manual runs succeed.
- Monitor RSS health endpoint for backlog/failure signals.
- Keep Apify pipeline unchanged; slices operate independently.

Known gaps/risks to resolve
- Missing create-table for `rss_summaries`: add a migration prior to summaries insert as described above.
- Source’s RSS migrations mix two approaches (psql vs RP-exec). For simplicity, unify under Target’s [apply-migrations.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/apply-migrations.ts).
- New deps (chart.js/react-chartjs-2) affect bundle size; safe given they are only used by `/dashboard-v2`.

Phase 2 — Completed 2025-10-09 17:51
- Unified DB migrations under existing psql-based runner.
- Artifacts added/updated:
  - /home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations/20251007_1100_CreateRssSummaries.sql
  - /home/prinova/CodeProjects/agent-vibes/supabase/migrations/002_create_claim_pending_summaries_function.sql
  - /home/prinova/CodeProjects/agent-vibes/scripts/apply-migrations.ts

Phase 3 — Completed 2025-10-09 17:54
- Added runtime deps for dashboard-v2: chart.js, react-chartjs-2
- Added RSS scripts: sync-rss-entries, summarize-rss-entries, cleanup-rss-failures, reset-sync-rss
- Copied RSS operation scripts into scripts/; no other changes

Phase 4 — Completed 2025-10-09 17:59
- Appended safe env placeholders to `.env.example` (no secrets): MINIFLUX_URL, MINIFLUX_API_KEY, OLLAMA_BASE_URL, OLLAMA_MODEL; optional commented: CRON_SECRET, INTERNAL_API_KEY
- Updated Vercel cron schedules in [vercel.json](file:///home/prinova/CodeProjects/agent-vibes/vercel.json): /api/rss/sync (*/15 * * * *), /api/rss/summarize (*/30 * * * *)

Phase 5 — Completed 2025-10-09 18:03
- Guardrails: RSS slice is isolated; application access is via `app/api/rss/*` endpoints. UI fetches `/api/rss/*` and does not import from the slice directly. Ops scripts under `scripts/` invoke slice commands for maintenance.
- Supabase: API handlers (`entries`, `health`) reuse `createSupabaseServerClient` from ApifyPipeline Infrastructure; command handlers instantiate via env (no cross-slice coupling). Optional future: unify creation via Infra or extract to `src/Shared/Infrastructure/Config/supabase.ts`.
- No Shared moves now: left as-is per scope; future extraction noted as optional.
- Readiness: VSA boundaries intact, access only via endpoints, and cron/auth patterns match existing.
