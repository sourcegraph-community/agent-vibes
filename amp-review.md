## High-level summary
This diff is a **pure documentation update** that modernises `docs/apify-pipeline/local-testing-guide.md` to match the current codebase and infrastructure:

* Updates the “last-updated” date and “validated” footer.
* Re-brands the dashboard route to `/dashboard-v2` and adds redirect notes.
* Aligns terminology with the latest API / schema changes (`maxItems` replaces `maxItemsPerKeyword`, `content` replaces `text`, `keyword_snapshot` replaces `keywords`, etc.).
* Adds the new Backfill processor everywhere it is relevant.
* Refreshes environment-variable tables, Supabase Edge-Functions workflow, and troubleshooting guidance.
* Expands CLI / npm script reference and API endpoint reference, especially around auth headers.
* Many small edits: wording, command flags, examples, typos, SQL column names, etc.

No executable code was changed, but the document drives local-developer behaviour, so correctness is still important.

## Tour of changes
Start with the **“API Endpoint Reference”** section (`/api/start-apify-run`, `/api/process-sentiments`, `/api/process-backfill`).  
These pages received the heaviest structural changes and incorporate the key renames (`maxItems`, auth headers). Understanding those updates makes the rest of the diff (examples, SQL snippets, env table, CLI commands) self-explanatory.

## File level review

### `docs/apify-pipeline/local-testing-guide.md`
#### Correctness & coherence
1. Dates and footer  
   ✔  Updated consistently.

2. Dashboard route rename  
   * You changed **all** links except in the architecture diagram at line ~40 (`app/dashboard-v2/` ✓). Good.

3. New ingestion props (`maxItems`)  
   * Examples, cURL and TS test files all replaced `maxItemsPerKeyword` / `keywordBatchSize`.  
   * Ensure the backend actually removed `keywordBatchSize`. If the handler still supports both, note that here for backward compatibility.

4. DB column renames  
   * `text` → `content`, `keywords` → `keyword_snapshot`, `reasoning->>'summary' AS summary`. Those match the 2025-10-10 migration—LGTM.

5. Auth wording  
   * Clarifies three auth mechanisms (Bearer $CRON_SECRET, `x-vercel-cron`, `x-api-key`). Accurate with current middleware.  
   * The note on `ALLOW_API_KEY_QUERY` deviation is good; maybe explicitly state “for development only”.

6. Edge-functions flow  
   * Adds `SUPABASE_FUNCTIONS_URL`, `SENTIMENT_EDGE_FALLBACK`. Matches infra/env.ts.  
   * Build/serve commands are correct.

7. Scripts matrix  
   * Splits into topical blocks (quality/tests/pipeline/maintenance). ✓  
   * The new `npm run fix` alias is documented; make sure it exists in `package.json`.

8. Examples
   * JS→TS conversion (`test-apify-client.ts`) uses `tsx`, not `node --input-type=module`. 👍  
   * Sentiment example switched to `analyzeSentiment` original signature. Verify file path in import (`ExternalServices/Gemini/GeminiClient`) actually exports that method name (v2 renamed, so OK).

9. SQL snippets  
   * Updated column names; the `sentiment_failures` table uses `last_attempt_at`, not `last_attempted_at`. Good catch.

10. Troubleshooting  
    * Error messages now match thrown text constants—nice.

#### Minor nits / suggestions
* The architecture ASCII diagram gained “BackfillProc.”; line length is one char longer—no overflow, but check markdown render width.
* For rate-limit advice, also mention `SENTIMENT_RPM_CAP` env var which appears earlier.
* Typo: “SENTIMENT_RPM_CAP=60” was removed from the shell script example but still listed in the Edge functions env snippet—keep them consistent.
* In “Local Environment” list, Node requirement says “20+ (Next.js 15)”; Next.js 15 is currently in **canary**, maybe add “≥ 15.0.0-canary” to avoid confusion.
* The API reference shows both POST & GET for `/api/start-apify-run`; add a quick sentence telling users that GET is **never** allowed in production to avoid accidental exposure.

#### Security
* The doc now encourages setting `SENTIMENT_EDGE_FALLBACK=true` which could allow large GPT requests to hit Node in prod if someone copies it unchanged. Maybe add a big “Dev-only” caution.
* Query-string API keys: reiterate the danger—docs already limit to non-prod, but bolding wouldn’t hurt.

#### Broken links / paths
* “Operational Runbook” path `../../src/ApifyPipeline/Docs/ApifyPipeline-start-apify-run-runbook.md` looks correct relative to docs/; verify case-sensitivity on Linux.
* `specification.md` and `overview.md` still live one directory above; good.

Overall the documentation is substantially clearer and aligns with the latest codebase. Only minor polishing points remain.