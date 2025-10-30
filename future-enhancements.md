# Future Enhancements

Recommended improvements and optimizations for future implementation.

## Pending Enhancements

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
- Why: Current strict parsing only treats the string `"false"` as false; more flexible parsing reduces footguns.
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
