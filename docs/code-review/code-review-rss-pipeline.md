## Review files in this order

Read first: [src/RssPipeline/DataAccess/Migrations/20251007_1700_AddStatusColumn.sql](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations/20251007_1700_AddStatusColumn.sql) — it defines status semantics for RSS entries and currently conflicts with the code’s status values, which will cause runtime DB constraint failures.

1. [src/RssPipeline/DataAccess/Migrations/20251007_1700_AddStatusColumn.sql](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations/20251007_1700_AddStatusColumn.sql) — adds status columns and check constraint for RSS entries, but uses 'completed' where code expects 'summarized'.
2. [app/api/rss/health/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/health/route.ts) — introduces RSS health metrics, but queries non-existent columns/statuses that don’t match the new schema.
3. [src/RssPipeline/Web/Application/Commands/GenerateSummaries/GenerateSummariesCommandHandler.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/GenerateSummaries/GenerateSummariesCommandHandler.ts) — orchestrates summary generation and status transitions; mismatches column names and environment variables.
4. [supabase/migrations/002_create_claim_pending_summaries_function.sql](file:///home/prinova/CodeProjects/agent-vibes/supabase/migrations/002_create_claim_pending_summaries_function.sql) — adds atomic claim function for batching, but includes an “OR TRUE” condition that nullifies retry-limit logic.
5. [src/RssPipeline/DataAccess/Repositories/RssRepository.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Repositories/RssRepository.ts) — data access for RSS entries/summaries; contains status inconsistencies and a likely incorrect markProcessing implementation.
6. [app/dashboard-v2/page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx) — new dashboard; imports global CSS in a page (likely Next.js violation) and depends on new API endpoints.
7. [app/dashboard-v2/components/RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx) — renders entry cards; CSS class names won’t match categories provided by API.
8. [app/api/rss/entries/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/entries/route.ts) — paginated entries endpoint for dashboard sections.
9. [src/RssPipeline/ExternalServices/Summarizer/OllamaSummarizer.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Summarizer/OllamaSummarizer.ts) — model-backed summarizer; robust retry/timeout handling.
10. [src/RssPipeline/Web/Application/Commands/SyncEntries/SyncEntriesCommandHandler.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/SyncEntries/SyncEntriesCommandHandler.ts) — syncs from Miniflux with basic transforms; mostly fine but uses insert over upsert.
11. [app/dashboard-v2/components/SocialSentiment.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/SocialSentiment.tsx) and [app/api/social-sentiment/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/route.ts) — adds sentiment chart and backend aggregation; looks consistent with existing DashboardRepository.
12. [scripts/... (4 new scripts)](file:///home/prinova/CodeProjects/agent-vibes/scripts) — operational scripts for RSS; mostly fine but bypass repository and need schema alignment.
13. [src/RssPipeline/DataAccess/Migrations/* (rest)](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations) — initial table and follow-on fixes; ensure apply order and constraints align with code.
14. [src/RssPipeline/Core/*](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Core) — types and transforms; minor mismatches vs DB noted.
15. [app/dashboard-v2/components/RssSection.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssSection.tsx) — fetches entries and renders sections; OK but depends on CSS class/category mismatch.
16. [app/dashboard-v2/dashboard.css](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/dashboard.css) — global styles; requires correct import location.
17. [scripts/apply-migrations.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/apply-migrations.ts) — extends migration runner with RSS migrations and RPC; order looks intentional.
18. [app/api/rss/summarize/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/summarize/route.ts) and [app/api/rss/sync/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/sync/route.ts) — re-export endpoints; simple and correct.
19. [src/RssPipeline/ExternalServices/Miniflux/client.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/client.ts) — Miniflux client with retries; looks solid.
20. [src/RssPipeline/ExternalServices/Summarizer/client.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Summarizer/client.ts) and [types.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Summarizer/types.ts) — extra summarizer abstraction; currently unused by handlers (may be dead code).
21. [app/dashboard-v2/layout.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/layout.tsx) — layout container; should import CSS here instead of page.tsx.
22. [docs/dashboard_rss_migration/dashboard_rss_migration.md](file:///home/prinova/CodeProjects/agent-vibes/docs/dashboard_rss_migration/dashboard_rss_migration.md) — migration plan doc; a few references don’t match the final file names.
23. [.env.example](file:///home/prinova/CodeProjects/agent-vibes/.env.example) — adds Miniflux/Ollama vars; one variable name conflicts with code usage.
24. [vercel.json](file:///home/prinova/CodeProjects/agent-vibes/vercel.json) — adds RSS cron schedules.
25. [package.json](file:///home/prinova/CodeProjects/agent-vibes/package.json) and [package-lock.json](file:///home/prinova/CodeProjects/agent-vibes/package-lock.json) — adds chart.js/react-chartjs-2 and scripts; consistent with UI.

## File Changes

### [src/RssPipeline/DataAccess/Migrations/20251007_1700_AddStatusColumn.sql](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations/20251007_1700_AddStatusColumn.sql)

- Major notes:
    - Introduces status tracking fields and a CHECK constraint restricting status to ('pending_summary', 'processing_summary', 'completed', 'failed').
    - Adds status_changed_at, summary_attempts, ai_summary, and a partial index on status.
- Questionable/wrong:
    - Code uses 'summarized' while migration uses 'completed'; this will violate the CHECK constraint when code sets 'summarized'. Example: see code writing 'summarized' in [GenerateSummariesCommandHandler.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/GenerateSummaries/GenerateSummariesCommandHandler.ts#L90-L110).
    - Recommendation: align both to a single canonical value. Either:
        - Change the migration to include 'summarized', or
        - Change all code to use 'completed' consistently.
- Needs tests:
    - Migration smoke tests that insert each allowed status and ensure no constraint violations from handlers.

### [app/api/rss/health/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/health/route.ts)

- Major notes:
    - Exposes operational health metrics: pending queue size, failure rate in last 24h, and stuck entries.
- Questionable/wrong:
    - Uses non-existent column names and statuses for this schema:
        - Queries 'summary_status' with values 'pending', 'failed', 'processing'; the current schema uses 'status' with values like 'pending_summary', 'processing_summary', etc. Search occurrences in the file for 'summary_status'.
        - Uses 'updated_at' to find “stuck” entries; your migration introduced 'status_changed_at' for this purpose.
    - Recommendation:
        - Replace summary_status → status and map values consistently.
        - Use status_changed_at (not updated_at) when determining stuck entries (e.g., older than 30 minutes).
- Needs tests:
    - Unit tests to validate each check triggers at thresholds and that column names match the schema.

### [src/RssPipeline/Web/Application/Commands/GenerateSummaries/GenerateSummariesCommandHandler.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/GenerateSummaries/GenerateSummariesCommandHandler.ts)

- Major notes:
    - End-to-end orchestration of summarization batches with stuck-entry reset and atomic claim calls.
    - Good logging and metrics return.
- Questionable/wrong:
    - Status mismatch: updates to 'summarized' status, which is not allowed by the migration’s CHECK constraint ('completed' expected). See the update here: [GenerateSummariesCommandHandler.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/GenerateSummaries/GenerateSummariesCommandHandler.ts#L90-L110).
    - Env var mismatch: passes baseUrl: process.env.OLLAMA_URL, but .env and other code use OLLAMA_BASE_URL. Update to OLLAMA_BASE_URL (and optionally keep OLLAMA_URL as backward compatibility).
    - Dry run: returns a message as an “error” string; consider using a dedicated dryRun field in the response instead of treating it as an error.
- Needs tests:
    - Handler integration test with a mocked Ollama response and Supabase client to verify status transitions and error paths.
    - Test resetStuckEntries path.

### [supabase/migrations/002_create_claim_pending_summaries_function.sql](file:///home/prinova/CodeProjects/agent-vibes/supabase/migrations/002_create_claim_pending_summaries_function.sql)

- Major notes:
    - Implements an atomic claim function using FOR UPDATE SKIP LOCKED; solid approach for serverless/concurrency.
- Questionable/wrong:
    - The condition block includes “OR TRUE”, making the max attempts logic effectively a no-op. See: [002_create_claim_pending_summaries_function.sql#L22-L33](file:///home/prinova/CodeProjects/agent-vibes/supabase/migrations/002_create_claim_pending_summaries_function.sql#L22-L33).
    - Recommendation: Either remove the placeholder OR TRUE or implement a real attempts-based filter with a proper summary_attempts column.
- Needs tests:
    - Concurrency test to ensure two callers don’t claim the same row.

### [src/RssPipeline/DataAccess/Repositories/RssRepository.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Repositories/RssRepository.ts)

- Major notes:
    - Provides upsert/insert, claim, status updates, and join-with-summary capabilities.
    - Maps DB rows to domain objects with camelCase.
- Questionable/wrong:
    - markProcessing sets status back to 'pending_summary' (very likely a typo); it should set to 'processing_summary'. This currently does nothing useful and could cause “stuck” logic not to work as intended.
    - getEntriesWithSummaries returns 'latestSummary' as the first in the array without ordering; you should ORDER BY processed_at DESC to ensure you get the latest.
    - mapToRssEntry casts id as string even though DB is BIGINT; subsequent updateStatus uses the string id in a numeric column comparison. It may work via implicit casts but is risky. Prefer number type for id or ensure explicit cast to numeric on usage.
    - insertEntries uses insert and throws on duplicate; Sync handler compensates by catching error per entry. Using upsert on entry_id would be faster and simpler.
- Needs tests:
    - Unit tests for claimPendingEntries() and resetStuckEntries().
    - Tests for getEntriesWithSummaries() returning the newest summary.

### [app/dashboard-v2/page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx)

- Major notes:
    - New dashboard view composing highlights, sentiment chart, and RSS sections.
- Questionable/wrong:
    - Global CSS import inside a page component: `import './dashboard.css';` In Next.js app router, global CSS can only be imported from a layout. Move this import into [app/dashboard-v2/layout.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/layout.tsx), or convert to CSS modules.
- Needs tests:
    - UI smoke tests to ensure the page renders without CSS import errors in Next.js.

### [app/dashboard-v2/components/RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx)

- Major notes:
    - Renders a card with category badge, summary, and metadata.
- Questionable/wrong:
    - CSS class mismatch: component outputs classes based on category values like 'product_updates' and 'industry_research', but the CSS defines classes for '.product', '.research', '.perspective'. The badges won’t style correctly.
    - Recommendation: Map server categories to CSS classes (e.g., product_updates → product, industry_research → research, perspectives → perspective, uncategorized → a neutral style).
- Needs tests:
    - Snapshot tests to ensure badges render as expected with various categories.

### [app/api/rss/entries/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/entries/route.ts)

- Major notes:
    - Server-side pagination and category filtering with validation on page/limit.
    - Uses createSupabaseServerClient and RssRepository; sensible separation.
- Questionable/wrong:
    - No obvious issues; consider defaulting totalPages to 1 when totalCount is 0 to keep pagination semantics predictable, but it’s optional.

### [src/RssPipeline/ExternalServices/Summarizer/OllamaSummarizer.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Summarizer/OllamaSummarizer.ts)

- Major notes:
    - Good timeout and retry strategy with exponential backoff and error typing.
    - Returns measured latency and model version cleanly.
- Questionable/wrong:
    - The outer generateSummary tracks latency, but callOllamaApi returns latencyMs 0; it’s corrected at a higher level, but consider returning response timings if Ollama provides them (eval_duration, etc.).
- Needs tests:
    - Unit tests with fetch mock to cover timeout, server error, and success.

### [src/RssPipeline/Web/Application/Commands/SyncEntries/SyncEntriesCommandHandler.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/SyncEntries/SyncEntriesCommandHandler.ts)

- Major notes:
    - Fetches from Miniflux, strips HTML, infers categories, inserts entries.
- Questionable/wrong:
    - Uses insertEntries (insert) and catches duplicates per entry; prefer repository upsert with onConflict 'entry_id' to cut DB error noise and improve throughput.
    - Potentially large loop of single inserts; batching via repository (it does batch in 500s) is good—ensure you’re actually passing arrays in meaningful chunks (currently you insert one-by-one in a loop).
- Needs tests:
    - Handler test with Miniflux client stub to validate category inference and duplicate handling.

### [app/dashboard-v2/components/SocialSentiment.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/SocialSentiment.tsx) and [app/api/social-sentiment/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/route.ts)

- Major notes:
    - Adds sentiment chart via chart.js/react-chartjs-2 and summary cards.
    - API validates days param and returns aggregated metrics and daily breakdown.
- Questionable/wrong:
    - None major; be mindful of bundle size—chart.js is large but acceptable for a dedicated dashboard page.
- Needs tests:
    - API unit test to validate days param bounds and summary math (percentages and averaging).

### [scripts/reset-and-sync-rss.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/reset-and-sync-rss.ts)

- Major notes:
    - Hard-resets rss_entries table and backfills from Miniflux for last 30 days.
- Questionable/wrong:
    - Bypasses repository and writes directly; ensure the schema (e.g., miniflux_id nullable) is already migrated before running, or it may fail.
    - No protection/confirmation—this will delete everything; consider requiring a CLI flag like --confirm.
- Needs tests:
    - Manual validation or a dry-run mode before destructive operations.

### [scripts/sync-rss-entries.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/sync-rss-entries.ts), [scripts/summarize-rss-entries.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/summarize-rss-entries.ts), [scripts/cleanup-rss-failures.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/cleanup-rss-failures.ts)

- Major notes:
    - Provide ops tooling for on-demand sync/summarize/cleanup; good observability with console outputs.
- Questionable/wrong:
    - cleanup-rss-failures assumes a 'summary_status'/'error' approach and fields (summary_attempts) that don’t fully align with the final schema; re-check against current columns and statuses (status, status_changed_at).
- Needs tests:
    - Dry-run validation and small dataset runs in CI (optional).

### [src/RssPipeline/DataAccess/Migrations/20251007_1000_InitRssPipeline.sql](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations/20251007_1000_InitRssPipeline.sql)

- Major notes:
    - Initial table with unique miniflux_id and common columns; adds triggers and useful indexes.
- Questionable/wrong:
    - Later migration drops a constraint and index whose names may not match auto-generated names (dropping “rss_entries_miniflux_id_key” might be fine but can be brittle across PG versions).
    - Index on starred is partial; OK.
- Needs tests:
    - Apply order validation covered by scripts/apply-migrations.ts.

### [src/RssPipeline/DataAccess/Migrations/20251007_1100_CreateRssSummaries.sql](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations/20251007_1100_CreateRssSummaries.sql)

- Major notes:
    - Creates rss_summaries with FK and basic metadata; good defaults.
- Questionable/wrong:
    - None major; ensure FK cascade aligns with your retention (OK: ON DELETE CASCADE).
- Needs tests:
    - FK integrity test.

### [src/RssPipeline/DataAccess/Migrations/20251007_1400_AddCollectedAt.sql](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations/20251007_1400_AddCollectedAt.sql), [20251007_1500_FixSchema.sql](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations/20251007_1500_FixSchema.sql), [20251007_1600_MakeMinifluxIdNullable.sql](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations/20251007_1600_MakeMinifluxIdNullable.sql)

- Major notes:
    - Pragmatic follow-ups to add missing columns, indices, and relax constraints.
- Questionable/wrong:
    - Ensure onConflict='entry_id' is used in code (right now only in upsertEntry), or duplicates will still throw.
- Needs tests:
    - Migration idempotency tests.

### [src/RssPipeline/Core/Models/RssEntry.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Core/Models/RssEntry.ts)

- Major notes:
    - Defines RssEntryStatus with 'summarized' and data shapes for entries/summaries.
- Questionable/wrong:
    - Status string must be aligned with DB constraint ('completed' vs 'summarized').
- Needs tests:
    - Type-level tests to ensure status is consistent project-wide.

### [src/RssPipeline/Core/Transformations/categoryMapper.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Core/Transformations/categoryMapper.ts), [htmlStripper.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Core/Transformations/htmlStripper.ts)

- Major notes:
    - Useful keyword-based categorization and HTML cleanup with truncation.
- Questionable/wrong:
    - None; consider logging low-confidence categorizations.

### [app/dashboard-v2/components/RssSection.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssSection.tsx)

- Major notes:
    - Fetches /api/rss/entries by category; handles loading/empty states with a setup link.
- Questionable/wrong:
    - Category names must match the API; styling mismatch cascades from RssEntryCard.

### [app/dashboard-v2/dashboard.css](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/dashboard.css)

- Major notes:
    - Global design system CSS for the dashboard.
- Questionable/wrong:
    - Should be imported in [app/dashboard-v2/layout.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/layout.tsx), not in page.tsx, to satisfy Next.js rules.
    - CSS class names for categories expect .product/.research/.perspective; adjust components accordingly.

### [scripts/apply-migrations.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/apply-migrations.ts)

- Major notes:
    - Integrates all RSS migrations and function creation in the correct order after Apify migrations.
- Questionable/wrong:
    - None; be sure Supabase permissions allow creating functions in public schema.

### [app/api/rss/summarize/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/summarize/route.ts), [app/api/rss/sync/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/sync/route.ts)

- Major notes:
    - Thin re-exports of endpoints; correctly encapsulate logic in the VSA slice.

### [src/RssPipeline/ExternalServices/Miniflux/client.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/client.ts)

- Major notes:
    - Well-structured client with retries and proper error classification.
- Questionable/wrong:
    - None.

### [src/RssPipeline/ExternalServices/Summarizer/client.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Summarizer/client.ts), [src/RssPipeline/ExternalServices/Summarizer/types.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Summarizer/types.ts)

- Major notes:
    - An alternative summarizer client and types; not used by current handlers (which use OllamaSummarizer directly).
- Questionable/wrong:
    - Consider removing or unifying to a single abstraction to avoid confusion.

### [app/dashboard-v2/layout.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/layout.tsx)

- Major notes:
    - Basic layout wrapper; ideal place to import dashboard.css globally.

### [docs/dashboard_rss_migration/dashboard_rss_migration.md](file:///home/prinova/CodeProjects/agent-vibes/docs/dashboard_rss_migration/dashboard_rss_migration.md)

- Major notes:
    - Helpful high-level migration notes and phases.
- Questionable/wrong:
    - References to “supabase/migrations/002_rss_pipeline.sql” don’t match actual filenames; update docs to point to the correct SQL files (e.g., 002_create_claim_pending_summaries_function.sql and the src/RssPipeline/DataAccess/Migrations set).

### [.env.example](file:///home/prinova/CodeProjects/agent-vibes/.env.example)

- Major notes:
    - Adds MINIFLUX_URL, MINIFLUX_API_KEY, OLLAMA_BASE_URL, OLLAMA_MODEL placeholders.
- Questionable/wrong:
    - Code in GenerateSummariesCommandHandler reads OLLAMA_URL instead of OLLAMA_BASE_URL; align variable names.

### [vercel.json](file:///home/prinova/CodeProjects/agent-vibes/vercel.json)

- Major notes:
    - Adds cron schedules for RSS sync and summarize; consistent with handlers’ auth checks.

### [package.json](file:///home/prinova/CodeProjects/agent-vibes/package.json), [package-lock.json](file:///home/prinova/CodeProjects/agent-vibes/package-lock.json)

- Major notes:
    - Adds chart.js/react-chartjs-2 dependencies and RSS scripts; matches UI needs.
- Questionable/wrong:
    - None.

## Additional recommendations and fixes summary

- Align status values across code and DB:
    - Choose either 'summarized' or 'completed' everywhere. If keeping 'summarized', update the CHECK in [20251007_1700_AddStatusColumn.sql](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Migrations/20251007_1700_AddStatusColumn.sql) accordingly.
- Fix health endpoint schema usage:
    - Replace 'summary_status' → 'status', map to 'pending_summary'/'processing_summary'/'failed', and use 'status_changed_at'.
- Fix env var mismatch:
    - Use OLLAMA_BASE_URL in [GenerateSummariesCommandHandler.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/GenerateSummaries/GenerateSummariesCommandHandler.ts) or set OLLAMA_URL consistently in .env.
- Fix markProcessing:
    - Update to set status='processing_summary' in [RssRepository.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Repositories/RssRepository.ts).
- Remove “OR TRUE” placeholder in the claim function:
    - Implement attempts logic or drop that condition in [002_create_claim_pending_summaries_function.sql](file:///home/prinova/CodeProjects/agent-vibes/supabase/migrations/002_create_claim_pending_summaries_function.sql#L22-L33).
- CSS import location:
    - Move import './dashboard.css' into [app/dashboard-v2/layout.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/layout.tsx) or convert to CSS module.
- Category styling:
    - Map API categories to CSS classes in [RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx) (product_updates→product, industry_research→research, perspectives→perspective).
- Summaries ordering:
    - Order rss_summaries by processed_at DESC in [RssRepository.getEntriesWithSummaries](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/DataAccess/Repositories/RssRepository.ts) before selecting the “latest”.

These changes will eliminate schema-runtime mismatches, prevent health check failures, ensure CSS renders correctly, and improve resilience and correctness of batch processing.