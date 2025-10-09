## High-level summary
This change-set grafts an entire “RSS Pipeline” vertical slice into the project together with a second-generation dashboard.  
Major themes:

* **Back-end**  
  * New database objects (`rss_entries`, `rss_summaries`, status/attempt columns, RPC `claim_pending_summaries`) + runner wiring in `scripts/apply-migrations.ts`.
  * New API routes under `/api/rss/*` for sync, summarise, paginate entries, and health, plus `/api/social-sentiment`.
  * New domain, repo, command-handler, and external-service layers inside `src/RssPipeline/**`.
* **Front-end**  
  * New `app/dashboard-v2` React page with supporting components/CSS and Chart.js.
* **Ops & tooling**  
  * Vercel cron entries, CLI scripts for sync/summarise/cleanup, `.env.example` additions, new npm dependencies.

The implementation is coherent but a few high-risk mismatches exist between SQL migrations and TypeScript code (status enums, column names, claim RPC filter, CSS class names, etc.).

---

## Tour of changes
The **first place to read is the DB migration set (`20251007_*` + `claim_pending_summaries`) and the matching TypeScript enums**:

1. `20251007_1700_AddStatusColumn.sql` – defines the only allowed status literals.
2. `src/RssPipeline/Core/Models/RssEntry.ts` – uses a different literal set (`'summarized'` vs `'completed'`).
3. `src/RssPipeline/DataAccess/Repositories/RssRepository.ts` & command-handlers – rely on those TS literals.
4. `supabase/migrations/002_create_claim_pending_summaries_function.sql` – contains logic gaps (`OR TRUE`) that silently disable retry filtering.

Understanding the schema/enum contract is prerequisite for reviewing every other file (repository logic, health endpoint, handlers, UI).

---

## File level review

### `.env.example`
* ✅ Adds placeholders for Miniflux and Ollama.  
* ⚠️ Code reads `process.env.OLLAMA_URL` in `GenerateSummariesCommandHandler.ts`; should match `OLLAMA_BASE_URL`.

---

### `app/api/rss/entries/route.ts`
* Pagination logic is fine.  
* Consider returning `totalPages = 0` when `totalCount=0` to avoid divide-by-zero or use `Math.max(1, …)`.

---

### `app/api/rss/health/route.ts`
* Uses columns `summary_status`, `updated_at`, and status literals `pending|failed|processing` – **do not exist** after the new migrations (`status`, `status_changed_at`, `pending_summary` …).  
* Stuck-entry query should use `status_changed_at`.  
* Failure-rate math reads all rows but doesn’t limit by `language` or `category` – okay if intentional.  
* No authentication – maybe acceptable for a public health check but decide.

---

### `app/api/rss/summarize/route.ts` / `app/api/rss/sync/route.ts`
* Simple re-exports – fine.  Make sure the command endpoints themselves enforce auth (they do).

---

### `app/api/social-sentiment/route.ts`
* Solid; validates `days` 1-365.  
* Very large `limit` (`days*10`) could be a problem if languages >10 – maybe compute dynamically (`count(distinct language)`).

---

### Dashboard V2 assets (`app/dashboard-v2/**`)
* `page.tsx` imports global CSS – **must move to `layout.tsx`** to satisfy Next-JS app-router global-CSS constraint.
* Category CSS classes (`.product`, `.research`, `.perspective`) don’t match runtime categories (`product_updates`, `industry_research`, `perspectives`).  Map or rename.
* Mobile sidebar toggling relies on `.sidebar.open` class; no CSS rule for that yet (`@media` section toggles only transform). You already add/remove `open`, so add CSS for `.sidebar.open` on desktop too or hide on large screens.
* Chart.js adds sizeable bundle; consider `next/dynamic` import to keep main bundle small.

---

### `src/RssPipeline/Core/Models/RssEntry.ts`
* Status enum has `'summarized'`; migration allows `'completed'` instead. Pick one value and update everywhere.
* Good separation of DTOs.

---

### `src/RssPipeline/Core/Transformations/*`
* `categoryMapper.ts` – heuristic scoring is simple and fast; acceptable.  
* `htmlStripper.ts` – regex-based strip is okay for dashboard display; if you later feed content to LLM you may want a stricter sanitizer.

---

### SQL migrations (`20251007_*`)
1. `...1000_InitRssPipeline.sql`  
   * Creates `miniflux_id integer unique not null` then later `1500` drops uniqueness and `1600` makes it nullable. Less churn if initial DDL matched final shape, but acceptable.
2. `...1700_AddStatusColumn.sql`  
   * CHECK constraint values (`completed`) conflict with TS.  
   * Adds `ai_summary` column although the code stores summaries in separate table too – duplication?
3. Indexes: `idx_rss_entries_status` is partial (`pending_summary|processing_summary`) – good.

---

### `supabase/migrations/002_create_claim_pending_summaries_function.sql`
* Retry filter currently disabled by `AND ( … OR TRUE )`. Remove `OR TRUE` and add real `summary_attempts` tracking.
* Function ignores `p_max_attempts` arg; implement logic or drop parameter.
* Returns full rows – those contain the *old* status values; make sure caller converts.

---

### `src/RssPipeline/DataAccess/Repositories/RssRepository.ts`
* `markProcessing()` sets `status: 'pending_summary'` – typo, should be `'processing_summary'`.
* `insertEntries()` throws on duplicates; caller then catches – consider `upsert` or `ON CONFLICT DO NOTHING` to reduce noise.
* `getEntriesWithSummaries()` returns `summaries[0]` without ordering; add `ORDER BY processed_at DESC` on the join.
* `mapToRssEntry()` casts `id` to string; later `updateStatus()` compares id string to numeric column – relies on implicit cast; safer to keep as number.

---

### `src/RssPipeline/ExternalServices/Miniflux/client.ts`
* Sturdy client with retries/back-off.  
* `makeRequest` treats PUT/DELETE as returning no body – correct for Miniflux.  
* Consider surfacing `rate_limit_remaining` header for smarter retry.

---

### `src/RssPipeline/ExternalServices/Summarizer/OllamaSummarizer.ts`
* Good exponential retry.  
* Returns `latencyMs` but inner `callOllamaApi` zeros it; propagate actual latency once calculated.
* JSON parsing of Ollama response fine for v0.1 spec.

---

### Command Handlers
#### `GenerateSummariesCommandHandler.ts`
* Reads `process.env.OLLAMA_URL` (mismatch).  
* Calls `repository.updateStatus(entry.id,'summarized')` – will violate CHECK constraint.  
* No batching / concurrency (one-by-one awaits) – okay for 20 default, but could parallelise with `p-limit`.  
* On error marks status `failed` but does **not** increment `summary_attempts`; retry function can’t work.  
* `resetStuckEntries` cycles through claim-logic again – good.

#### `SyncEntriesCommandHandler.ts`
* Inserts entries one-by-one with `repository.insertEntries([entry])` → repository still batches at 500 but you call with array of length 1 each time. Build one large array then call once.

---

### `scripts/*`
* Destructive `reset-and-sync-rss.ts` truncates table without confirmation; add `--confirm` flag.  
* All scripts `dotenv` load `.env.local`; good.

---

### `scripts/apply-migrations.ts`
* RSS migrations are appended after Apify migrations – fine. Ensure earlier migrations don’t depend on later Apify ones.

---

### `vercel.json`
* Adds two cron jobs; remember to set `CRON_SECRET` in Vercel project.

---

## Key risk items & recommendations
1. **Status naming mismatch** (`completed` vs `summarized`, `summary_status` vs `status`).  
   • Decide canonical literals, update migration, repo, handlers, health check, and CHECK constraint.

2. **Claim function logic gap** – remove `OR TRUE`, increment/use `summary_attempts`.

3. **Repository bugs**  
   • `markProcessing` typo, missing summary ordering.

4. **Environment variable drift** – align on `OLLAMA_BASE_URL` (or keep alias).

5. **Dashboard CSS/category mismatch** – map category strings or rename CSS classes.

6. **Global CSS import** – move to `layout.tsx`.

7. **Duplicate `ai_summary` column** – either drop column or stop writing separate `rss_summaries` row to avoid divergence.

Addressing the above will prevent runtime constraint violations, duplicate processing, and broken UI styling.