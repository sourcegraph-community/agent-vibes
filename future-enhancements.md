# Future Enhancements

Recommended improvements and optimizations for future implementation.

## Pending Enhancements

### Adopt Supabase generated Database types in shared client
- Goal: Improve type safety for database interactions.
- What: Replace `any` with project’s generated `Database` types in the shared Supabase client exports and usage sites.
- Why: Strengthens compile-time guarantees and prevents schema drift across repositories/services.
- Priority: Medium
- Status: Pending

### Parameterize `X-Client-Info` for shared Supabase client
- Goal: Make the shared client suitable across slices without Apify-specific branding.
- What: Add an optional parameter or environment-driven default for the `X-Client-Info` header in the client factory; set a neutral default.
- Why: Keeps Shared layer generic and avoids leaking slice-specific identifiers.
- Priority: Medium
- Status: Pending

### Remove re-export shim once imports are updated
- Goal: Reduce indirection after consumers adopt the Shared client import path.
- What: Replace imports from `src/ApifyPipeline/ExternalServices/Supabase/client.ts` with `src/Shared/Infrastructure/Storage/Supabase/serviceClient.ts` and delete the shim file.
- Why: Simplifies dependency graph and clarifies source of truth for the Supabase client.
- Priority: Low
- Status: Pending

### Consolidate any remaining direct `createClient` usages
- Goal: Ensure a single creation path for Supabase service clients.
- What: Audit the repository for direct `@supabase/supabase-js` `createClient` calls outside the Shared client and refactor to use the shared factory.
- Why: Centralizes configuration, enforces consistent headers/options, and eases future changes (e.g., retries, logging).
- Priority: Medium
- Status: Pending

### Reintroduce RSS content via Miniflux + AI summaries
- Goal: Restore dynamic content for Product Updates, Research Papers, and Perspective Pieces using Miniflux-backed feeds with AI summaries.
- What: Rewire [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx) sections to use the existing [RssSection.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssSection.tsx) component (or successor) and connect to configured Miniflux categories.
- Why: The current placeholders unblock layout changes while deferring integration. Reinstating feeds returns value by surfacing real-time content.
- Priority: Medium
- Status: Pending

### Implement Build Crew Discussions content source
- Goal: Replace the Build Crew Discussions placeholder with real data.
- What: Define the data source and contract (e.g., Supabase table or API) and render discussion threads in the new section at [page.tsx#L236-L244](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L236-L244).
- Why: Enables the new section to deliver actionable insights beyond a stub while keeping VSA boundaries explicit.
- Priority: Medium
- Status: Pending

### Build unified Timeline view
- Goal: Replace the simplified Timeline placeholder with a chronological, merged feed across sections.
- What: Aggregate entries from highlights, product updates, research, perspectives, and build crew discussions into a single timeline in [page.tsx#L361-L367](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L361-L367).
- Why: Provides a comprehensive overview that matches the intended UX.
- Priority: Low
- Status: Pending

### Fully remove Supabase Edge usage from ApifyPipeline execution paths
- Goal: Keep the edge function available, but decouple it from ApifyPipeline (Background + Web/Application) so the pipeline uses only the internal sentiment processor.
- What: Replace all invocations of `invokeSentimentProcessorFunction` in ApifyPipeline with `runSentimentProcessorJob` or a shared Application command that delegates to the job. Specifically update [TweetCollectorJob.ts#L239-L247](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Background/Jobs/TweetCollector/TweetCollectorJob.ts#L239-L247) and [ProcessSentimentsCommandHandler.ts#L24-L29](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Web/Application/Commands/ProcessSentiments/ProcessSentimentsCommandHandler.ts#L24-L29) to remove the edge dependency.
- Why: Simplifies the runtime path, avoids external network dependency during pipeline runs, and makes processing behavior explicit and predictable while preserving the edge function for separate, non-pipeline use cases.
- Priority: High
- Status: Pending

### Add clarity log after normalized inserts in ad-hoc collector
- Goal: Make it explicit that sentiment processing is handled by the subsequent step.
- What: After `insertNormalizedTweets` in [start-apify-run.ts#L400-L402](file:///home/prinova/CodeProjects/agent-vibes/scripts/start-apify-run.ts#L400-L402), add a brief log noting that sentiment processing is deferred to the `process:sentiments` step.
- Why: Aids future maintainers and operators by clarifying that analysis is intentionally decoupled from ingestion.
- Priority: Low
- Status: Pending

### Make `SENTIMENT_LOOP_ALL` accept common falsy values
- Goal: Improve ergonomics for local/dev runs.
- What: Parse `SENTIMENT_LOOP_ALL` with a broader falsy set (e.g., `false`, `0`, `no`, `off`), likely via a small util reused across scripts.
- Why: Current strict parsing only treats the string "false" as false; more flexible parsing reduces footguns.
- Priority: Medium
- Status: Pending

### Return remaining count from sentiment job to avoid pre-pass query
- Goal: Reduce one round trip per pass in the processing loop.
- What: Extend the result of [SentimentProcessorJob.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Background/Jobs/SentimentProcessor/SentimentProcessorJob.ts) to include `remaining` after the batch, so callers like [process-sentiments.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/process-sentiments.ts) can decide to continue without an extra count query.
- Why: Eliminates the pre-pass `count` call when looping, making the loop more efficient and self-sufficient.
- Priority: Medium
- Status: Pending

### Add global `unhandledRejection` handler for CLI scripts
- Goal: Improve resilience and operator feedback during batch runs.
- What: In Node CLI entrypoints, add a one-liner `process.on('unhandledRejection', ...)` to ensure errors surface with non-zero exit.
- Why: Prevents silent failures from unawaited promises during long-running or iterative scripts.
- Priority: Low
- Status: Pending

### Optimize product filtering indexing for case-insensitive queries
- **Goal**: Improve query performance for case-insensitive product lookups as keyword volume grows.
- **What**: Add a database index such as `CREATE INDEX ... ON keywords (LOWER(product));` or migrate the `product` column to `citext` type, then query via lowercased comparison.
- **Why**: The current `.ilike('product', normalized)` won't use a plain B-tree index, which may impact performance if the keywords table grows. Case-insensitive indexing strategies ensure efficient lookups.
- **References**: [KeywordsRepository.ts#L41-L48](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/DataAccess/Repositories/KeywordsRepository.ts#L41-L48)
- **Priority**: Medium
- **Status**: Pending

### Handle "No brands available" UX feedback for Social Sentiment
- **Goal**: Gracefully communicate to users when no sentiment brands are available.
- **What**: Display a small UX note (e.g., "No brands available") near the brand filter area when the products list is empty.
- **Why**: Currently, the radio group filter renders nothing when no brands are returned from `/api/social-sentiment/brands`, which may confuse users. An explicit message improves clarity and sets expectations.
- **Priority**: Medium
- **Status**: Pending

### Optimize Social Sentiment effect to guard against initial no-op fetch
- **Goal**: Prevent unnecessary API calls when no brand is selected.
- **What**: Add a guard condition `if (selectedBrand)` at the beginning of the `useEffect` hook that calls `fetchProductData`.
- **Why**: On initial load, if `selectedBrand` is `null` and the effect runs before the brand list is populated, it triggers a fetch with an empty/null product parameter. Guarding the effect prevents this minor redundant request.
- **References**: [SocialSentiment.tsx#L120-L122](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/SocialSentiment.tsx#L120-L122)
- **Priority**: Low
- **Status**: Pending

### Improve semantic HTML with legend inside fieldset
- **Goal**: Enhance semantic HTML structure for the brand radio group.
- **What**: Replace the standalone `<h3>` with a `<legend>` element inside the `<fieldset>`.
- **Why**: A `<legend>` is the semantic way to describe a `<fieldset>` and is more standard for accessibility. Current ARIA labeling works but using native semantics is cleaner and requires less scaffolding.
- **References**: [SocialSentiment.tsx#L320-L339](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/SocialSentiment.tsx#L320-L339)
- **Priority**: Low
- **Status**: Pending

### Standardize API parameter naming for single-product queries
- **Goal**: Clarify intent and reduce potential confusion about parameter semantics.
- **What**: Consider renaming the `products` query parameter to `product` (singular) in the `/api/social-sentiment/by-product` route to reflect the single-value behavior in the radio group UI.
- **Why**: The current parameter name `products` implies multiple values, but the radio group enforces single selection. Renaming to singular clarifies the contract and aligns parameter name with actual usage.
- **References**: [by-product/route.ts#L27-L29](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/by-product/route.ts#L27-L29)
- **Priority**: Low
- **Status**: Pending

### Centralize sticky header height in CSS variable
- **Goal**: Reduce drift and maintenance overhead for sticky header offset calculations.
- **What**: Move the hardcoded `96px` header height into a single reusable CSS variable, referenced in both `page.tsx` and `dashboard.css`.
- **Why**: Currently the header height is defined in two places—once as a JS fallback and again in CSS. A single source of truth avoids synchronization bugs if the header size changes.
- **References**: [page.tsx#L29-L31](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L29-L31), [dashboard.css#L192-L204](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/dashboard.css#L192-L204)
- **Priority**: Low
- **Status**: Pending

### Simplify active navigation state to rely solely on hashchange
- **Goal**: Eliminate redundant state updates from both click and hashchange handlers.
- **What**: Remove the `onClick` handler from sidebar links and rely entirely on the `hashchange` listener to drive active state updates.
- **Why**: Currently, both click handlers and hashchange events update `activeSection`, which can cause double renders. A single source of truth (hashchange) simplifies the logic and ensures consistency with browser back/forward behavior.
- **References**: [page.tsx#L13-L23](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L13-L23), sidebar link handlers around [page.tsx#L51-L75](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L51-L75)
- **Priority**: Low
- **Status**: Pending

### Preserve semantic section wrapper for Social Sentiment
- **Goal**: Maintain proper semantic HTML and anchor navigation structure.
- **What**: Consider wrapping `<SocialSentiment>` in its own `<section id="social">` element even in its new location within the Overview section.
- **Why**: Previously the component had semantic grouping and its own section ID for anchor navigation. Embedding it directly within the Overview section may confuse accessibility tools and downstream CSS/JS selectors that target the `#social` ID. A dedicated wrapper preserves intent and enables independent styling or layout adjustments.
- **References**: [SocialSentiment.tsx#L352-L356](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/SocialSentiment.tsx#L352-L356)
- **Priority**: Low
- **Status**: Pending

### Clarify RSS docs to OPML-only configuration
- Goal: Make documentation explicit that in-house RSS aggregation is OPML-only (no `INHOUSE_RSS_FEEDS` JSON input).
- What: Update [README.md](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/README.md) to remove or reword residual references to JSON-fed configs and ensure examples point to OPML aggregation.
- Why: Reduces confusion and aligns docs with the new single source of truth.
- Priority: Low
- Status: Pending

### Harden OPML path resolution for diverse runtimes
- Goal: Improve robustness of OPML path discovery across build and runtime environments.
- What: Replace direct `__dirname` joins in [inhouse.ts#L6-L13](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/inhouse.ts#L6-L13) with a more resilient approach (e.g., config module, `process.cwd()`-based resolution, or `import.meta.url`), and centralize OPML path list in a small config.
- Why: Minimizes brittleness across transpiled/packaged contexts and improves discoverability.
- Priority: Low
- Status: Pending

### Simplify Miniflux client error union for in-house only
- Goal: Remove unused HTTP-specific error codes/types now that only in-house path remains.
- What: Trim unused error variants and align the error surface to `API_ERROR` (and any internal parsing/timeout semantics if applicable) in [client.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/client.ts).
- Why: Keeps the API explicit and reduces dead code.
- Priority: Low
- Status: Pending

### Centralize OPML path list in a configuration module
- Goal: Make OPML sources easier to extend without touching reader logic.
- What: Extract the OPML paths array from [inhouse.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/inhouse.ts) into a small config file under `Data/` or `ExternalServices/Miniflux/`.
- Why: Improves extensibility while keeping the single source of truth explicit.
- Priority: Low
- Status: Pending
