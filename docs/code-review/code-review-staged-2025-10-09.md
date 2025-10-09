# Code Review — Staged Changes (2025-10-09)

This review analyzes the currently staged changes. It highlights risks, schema–code mismatches, and concrete fixes. Links point to exact files in the repo.

## Executive Summary
- Adds a full RSS Pipeline vertical slice (Core, DataAccess, ExternalServices, Web/Application) and a new dashboard at `/app/dashboard-v2`.
- Primary risks:
  - Status enum mismatch between SQL and TypeScript causes imminent DB constraint violations.
  - Claim RPC contains a placeholder condition that disables retry filtering.
  - Repository status transition bug (`markProcessing` sets the wrong status).
  - Dashboard CSS/global import placement and category-class mismatches will break styling.
- Build checks: `npm run check` passes. Unit tests: 5 failing tests (in Apify pipeline; likely unrelated to staged changes).

## CI Signals
- Typecheck/lint: OK (`npm run check`).
- Tests: 5 failing tests (Apify-related), unrelated to these staged changes but worth tracking.

## File-by-File Notes

### API and Web
- [app/api/rss/entries/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/entries/route.ts)
  - Good pagination and validation. Optional: when `totalCount=0`, consider returning `totalPages = 0` or clamp to 1 consistently across the app.

- [app/api/rss/health/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/health/route.ts)
  - Uses `summary_status`, `updated_at`, and values `pending|failed|processing`. Migrations establish `status`, `status_changed_at`, and values like `pending_summary|processing_summary|...`.
  - Fix: swap to `status`, `status_changed_at`, and aligned literal values.

- [app/api/rss/summarize/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/summarize/route.ts)
- [app/api/rss/sync/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/sync/route.ts)
  - Thin re-exports; fine.

- [app/api/social-sentiment/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/route.ts)
  - Solid endpoint, validates `days`. `limit = days*10` may under/over-shoot per-language totals; adjust if needed.

- [app/dashboard-v2/page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx)
  - Imports global CSS in a page (`import './dashboard.css'`). In Next.js App Router, global CSS must be imported at a layout. Move import to [app/dashboard-v2/layout.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/layout.tsx) or use a CSS module.

- [app/dashboard-v2/components/RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx)
  - Category classes rendered as `product_updates|industry_research|perspectives` while CSS defines `.product|.research|.perspective`. Map these before adding as CSS classes.

- [app/dashboard-v2/dashboard.css](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/dashboard.css)
  - Lacks a rule for `.sidebar.open` outside mobile; consider desktop behavior. Large CSS is OK for a dedicated page; ensure import location fix above.

### Core/Domain
- [src/RssPipeline/Core/Models/RssEntry.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Core/Models/RssEntry.ts)
  - `RssEntryStatus` includes `'summarized'` but SQL allows `'completed'`. Pick one canonical value and align everywhere.

### DataAccess and SQL
- [src/RssPipeline/DataAccess/Repositories/RssRepository.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Repositories/RssRepository.ts)
  - `markProcessing()` sets `status: 'pending_summary'` (typo). Should be `'processing_summary'`.
  - `getEntriesWithSummaries()`: selects the first summary without ordering; add `ORDER BY processed_at DESC` and pick the latest.
  - `id` handling: maps DB BIGINT to string; ensure consistent type when updating by `id`.
  - `insertEntries()` throws on duplicates; prefer `upsert` with `onConflict: 'entry_id'` where applicable.

- Migrations
  - [20251007_1700_AddStatusColumn.sql](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations/20251007_1700_AddStatusColumn.sql)
    - CHECK constraint allows `'completed'`, not `'summarized'`. Align with TS or change constraint to include `'summarized'`.
  - [20251007_1100_CreateRssSummaries.sql](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations/20251007_1100_CreateRssSummaries.sql)
    - Reasonable schema; ensure code always writes to this table (avoid duplicate `ai_summary` in `rss_entries` unless intentionally denormalized).

- RPC Function
  - [supabase/migrations/002_create_claim_pending_summaries_function.sql](file:///home/prinova/CodeProjects/agent-vibes/supabase/migrations/002_create_claim_pending_summaries_function.sql)
    - Contains a placeholder `( … OR TRUE )` that effectively disables attempts-based filtering. Remove the placeholder and implement real `summary_attempts` logic or drop attempts filtering for now.

### External Services
- [src/RssPipeline/ExternalServices/Summarizer/OllamaSummarizer.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Summarizer/OllamaSummarizer.ts)
  - Retry and timeout logic is solid. Latency handling sets `0` in the inner call and patches at higher level; optional polish.

- [src/RssPipeline/ExternalServices/Miniflux/client.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/client.ts)
  - Good error classification and retry. Consider exposing rate-limit headers if available.

### Command Handlers
- [src/RssPipeline/Web/Application/Commands/GenerateSummaries/GenerateSummariesCommandHandler.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/GenerateSummaries/GenerateSummariesCommandHandler.ts)
  - Uses `process.env.OLLAMA_URL` while `.env.example` introduces `OLLAMA_BASE_URL`. Align env var naming.
  - Sets status `'summarized'` after insert; will violate current CHECK constraint unless aligned.

- [src/RssPipeline/Web/Application/Commands/SyncEntries/SyncEntriesCommandHandler.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/SyncEntries/SyncEntriesCommandHandler.ts)
  - Inserts entries one-by-one (repository batches internally but each call passes a single item). Prefer batching large arrays where feasible.

### Scripts and Ops
- [scripts/reset-and-sync-rss.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/reset-and-sync-rss.ts)
  - Destructive delete of all rows. Consider requiring a `--confirm` flag for safety.

- [scripts/cleanup-rss-failures.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/cleanup-rss-failures.ts)
  - Uses `summary_status`/`updated_at` patterns not present in current migrations; align with `status`/`status_changed_at`/attempts once implemented.

### Environment/Config
- [.env.example](file:///home/prinova/CodeProjects/agent-vibes/.env.example)
  - Adds `MINIFLUX_URL`, `MINIFLUX_API_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`. Ensure code reads `OLLAMA_BASE_URL` (or keep an alias for `OLLAMA_URL`).

- [vercel.json](file:///home/prinova/CodeProjects/agent-vibes/vercel.json)
  - Adds cron for `/api/rss/sync` and `/api/rss/summarize`. Ensure `CRON_SECRET` is set in Vercel.

## Priority Fixes
1) Align status literals across DB and TS:
- Option A: Use `'summarized'` everywhere → update CHECK constraint in [20251007_1700_AddStatusColumn.sql](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations/20251007_1700_AddStatusColumn.sql).
- Option B: Use `'completed'` everywhere → update all code paths (handlers, repo, health).

2) Fix atomic-claim function:
- Remove the `OR TRUE` placeholder and implement `summary_attempts`-based filtering (or explicitly drop attempts filtering for now) in [002_create_claim_pending_summaries_function.sql](file:///home/prinova/CodeProjects/agent-vibes/supabase/migrations/002_create_claim_pending_summaries_function.sql).

3) Repository correctness:
- Change `markProcessing()` to set `status='processing_summary'` in [RssRepository.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Repositories/RssRepository.ts).
- Order summaries by `processed_at DESC` before selecting latest.

4) Dashboard CSS and imports:
- Move global CSS import from `page.tsx` to [layout.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/layout.tsx).
- Map API categories → CSS classes in [RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx).

5) Env var parity:
- Standardize on `OLLAMA_BASE_URL` (update handler) or keep both temporarily.

## Suggested Tests (follow-up)
- Unit tests for repository status transitions and summary ordering.
- Integration: claim function concurrency (no duplicate claims).
- API: health endpoint uses correct columns/status literals.
- UI: smoke test that `/dashboard-v2` renders without global CSS errors.

---
Tino — this review focuses strictly on staged changes. If you want, I can apply the minimal fixes (status literal alignment, repo status bug, health endpoint columns, CSS import move, category mapping) as a follow-up PR.
