# Future Enhancements

Recommended improvements and optimizations for future implementation.

## Pending Enhancements

### Build Crew Daily Digest follow-ups
- Goal: Harden the digest ingestion and rendering path and polish UX while keeping the solution simple.
- What:
  - Add `public, max-age=0` to Cache-Control for clearer browser caching semantics alongside existing `s-maxage` and `stale-while-revalidate` in the digest route; consider `ETag` if needed.
  - Update sanitizer config to explicitly set `allowProtocolRelative: false` and keep the restricted schemes (`http`, `https`, `mailto`).
  - After highlighting channel mentions, either re-run sanitization or escape the hashtag text before injecting the `<span>` to be maximally safe.
  - Add a fetch timeout (AbortController) and a basic retry/backoff in the API route when fetching the RSS feed to avoid long hangs during transient network issues.
  - Make heading parsing resilient to `<h3>` or alternative markup by supporting `(h2|h3)` or switching to a lightweight DOM parsing approach.
  - Consider switching to `edge` runtime for the route if no Node-only APIs are needed to improve cold start; otherwise document `nodejs` choice explicitly.
  - Remove unused `formatDay` helper in BuildCrewDigest and delete the empty placeholder file [CollapsibleDay.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/CollapsibleDay.tsx).
  - Add focused tests for section extraction with odd RSS inputs (missing headings, different casing, extra wrappers) to lock behavior.
  - Use a DOM-based approach (e.g., `DOMParser`) for `highlightChannelMentions` to avoid brittle text-node regex replacements and allow safer element insertion.
  - Clamp/normalize date parsing via `Date.parse()` or explicit UTC handling to avoid Safari edge cases when building day keys.
  - Show a generic error message in the digest UI (hide raw error text) and consider adding a lightweight SWR layer for client-side revalidation.
  - Abort the client fetch on unmount in the digest component using `AbortController` to prevent state updates after unmount.
- Why: Improves safety, resilience, and UX without increasing complexity, and aligns with the project’s simplicity-first principle.
- Priority: Medium
- Status: Pending

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

### Remove legacy folder→RSS map from resolver
- Goal: Reduce duplication now that normalization handles human labels and slugs.
- What: Delete the redundant `MINIFLUX_CATEGORY_TO_RSS` mapping in [categoryResolution.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Core/Transformations/categoryResolution.ts) and rely solely on `normalizeLabelToRssCategory`.
- Why: Keeps the resolver explicit and avoids drift between two mappings.
- Priority: Low
- Status: Pending

### Tighten OPML filename → category inference
- Goal: Avoid unintended matches when inferring research category from file names.
- What: In [inhouse.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/inhouse.ts), restrict `deriveCategoryFromFilename` to exact filename tokens (e.g., `research-papers.opml`) rather than broad `includes('research')`.
- Why: Prevents accidental routing if future OPML filenames contain "research" in unrelated contexts.
- Priority: Low
- Status: Pending

### Tests for category normalization and precedence
- Goal: Pin behavior and prevent regressions in resolver precedence.
- What: Add unit tests covering: folder/OPML category short‑circuit, perspective allowlist (dev.to and subdomains), research whitelist precedence, and heuristic fallback thresholds in [categoryResolution.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Core/Transformations/categoryResolution.ts).
- Why: Ensures strict content separation remains robust.
- Priority: Medium
- Status: Pending

### Config‑ify host allowlists
- Goal: Make perspective/research host lists explicit and easy to extend without code changes.
- What: Move `PERSPECTIVE_HOSTS` and `RESEARCH_HOSTS` into a small config module (or JSON) consumed by the resolver; consider environment overrides for experiments.
- Why: Improves extensibility while keeping behavior explicit and simple.
- Priority: Low
- Status: Pending

### Add unit tests for OPML discovery helper
- Goal: Increase confidence and prevent regressions in directory/file detection.
- What: Add a minimal unit test suite for [opmlDiscovery.ts](file:///home/prinova/CodeProjects/agent-vibes/src/Shared/Infrastructure/Utilities/opmlDiscovery.ts) covering: missing paths, directory with mixed files, single-file inclusion, and case-insensitive `.opml` matching.
- Why: The helper is now a shared primitive for scripts and API routes; tests will lock behavior as more directories are added.
- Priority: Medium
- Status: Pending

### Optional DEBUG toggle for OPML discovery
- Goal: Provide lightweight observability without permanent logs.
- What: Add an optional `DEBUG_OPML_DISCOVERY` environment flag that, when truthy, logs discovered directories and files count; default remains silent.
- Why: Helps diagnose missing feeds during deploys without noisy output in normal runs.
- Priority: Low
- Status: Pending

### Maintain `outputFileTracingIncludes` as routes evolve
- Goal: Ensure all RSS-related data files are bundled for serverless/runtime execution.
- What: Establish a maintenance checklist to update [next.config.ts](file:///home/prinova/CodeProjects/agent-vibes/next.config.ts) `outputFileTracingIncludes` when adding new RSS routes or data directories.
- Why: Prevents runtime file-not-found errors on Vercel when new routes or data folders are introduced.
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

### Per-feed sorting direction before capping (RSS)
- Goal: Respect requested ordering semantics during per-feed capping.
- What: Sort entries per feed by the requested `direction` (`asc` or `desc`) before applying the per-feed `limit` in [inhouse.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/inhouse.ts).
- Why: Current behavior always caps using newest-first (desc) for fairness; aligning to the requested direction would make capping semantics consistent with the caller’s sort preference.
- Priority: Low
- Status: Pending

### Optimize per-feed capping without full sort (RSS)
- Goal: Reduce per-feed sorting cost for very large feeds.
- What: Replace full sort-then-slice with a selection-based approach (e.g., bounded heap for top-N by `published_at`) within each feed in [inhouse.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/inhouse.ts).
- Why: Maintains correctness while improving performance when feeds contain many items and only a small cap is required.
- Priority: Low
- Status: Pending

### Product Updates and TL;DR Highlights polish
- Goal: Improve accessibility, resilience, and consistency for the restored Product Updates and the TL;DR highlight card.
- What:
  - Add minimal error logging or surfaced signal on fetch failure in [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx) when fetching latest product update (currently errors are swallowed).
  - Conditionally render summary only when present to avoid empty paragraph gaps in [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx).
  - Add an accessible label/aria-text for the "Read more" link in [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx) and consider mirroring in [RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx).
  - Consider removing explicit `limit` when it matches [RssSection.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssSection.tsx) default to reduce redundancy.
  - Handle future timestamps in `formatTime` to avoid negative "ago" output; default to date string when `publishedAt` is in the future in [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx).
  - Replace static fallback time text with a neutral placeholder (or hide) when no live item is available in [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx).
  - Optionally use `AbortController` to cancel the fetch on unmount in [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx).
  - Provide explicit locale to `toLocaleDateString()` for consistent formatting in [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx).
- Why: Enhances UX, a11y, and robustness while keeping implementation simple and consistent with existing patterns.
- Priority: Medium
- Status: Pending

### Normalize feed category casing before validation
- Goal: Tolerate feed category casing differences.
- What: Lowercase and trim the feed-provided category before passing to `isValidCategory` in [SyncEntriesCommandHandler.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/SyncEntries/SyncEntriesCommandHandler.ts).
- Why: Prevents mismatches due to casing and minor formatting variations in feed metadata.
- Priority: Medium
- Status: Pending

### Add unit tests for RSS categorization helpers
- Goal: Pin behavior of research whitelist and category derivation.
- What: Add focused tests for `deriveCategory` and `isResearchHost` covering whitelist matches (including subdomains), valid/invalid feed categories, and fallback inference.
- Why: Guards against regressions that could mislabel research as product updates.
- Priority: Medium
- Status: Pending

### One-off backfill to correct existing categories by host
- Goal: Correct historical mislabels for research domains.
- What: Create a small script/command to update stored RSS entries whose `url.host` matches the research whitelist to `industry_research`.
- Why: Aligns existing data with the new categorization policy.
- Priority: Low
- Status: Pending

### Normalize multi-line clamp to vendor-prefixed only
- Goal: Avoid relying on the still-unsupported unprefixed `line-clamp` property.
- What: Remove unprefixed `line-clamp` and keep the `-webkit-line-clamp` recipe in [dashboard.css](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/dashboard.css) for `.highlight-summary` and `.highlight-footer > span`.
- Why: Unprefixed `line-clamp` lacks broad support; using the prefixed approach is the most compatible pattern across Chromium/WebKit.
- Priority: Medium
- Status: Pending

### Align prop naming to singular `showBadge`
- Goal: Keep prop naming consistent across card and section components.
- What: Rename `showBadges` in [RssSection.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssSection.tsx) to `showBadge` to match [RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx); update usage sites in [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx).
- Why: Consistent singular naming improves readability and reduces cognitive load.
- Priority: Low
- Status: Pending

### Unify badge token mapping for containers
- Goal: Ensure consistent badge CSS tokens across dynamic and static cards.
- What: Apply the same API-category→token mapping used in [RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx) to container-rendered cards so classes use `product|research|perspective` consistently.
- Why: Prevents subtle styling mismatches when classes derive from different token sets.
- Priority: Low
- Status: Pending

### A11y: Preserve category context when badge is hidden
- Goal: Maintain semantic category information for assistive tech when visuals are suppressed.
- What: When `showBadge=false`, add a non-visual label (e.g., `aria-label` on the header or time) indicating the category in [RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx) and propagate intent from [RssSection.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssSection.tsx).
- Why: Users relying on screen readers should get the same category context even if the badge is not displayed.
- Priority: Medium
- Status: Pending

### Improve link focus visibility for "Read more →"
- Goal: Enhance keyboard accessibility.
- What: Add a `:focus-visible` underline style to the "Read more →" link in [dashboard.css](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/dashboard.css) and ensure the anchor markup in [RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx) supports visible focus.
- Why: Hover-only underline does not help keyboard users; focus-visible makes the link state clear.
- Priority: Low
- Status: Pending

### Themed focus color for selects
- Goal: Align select focus outline with the app’s accent theme.
- What: Update `.select:focus-visible` in [dashboard.css](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/dashboard.css) to use an accent token (e.g., `--ring` or `--primary`) instead of `--foreground`; optionally introduce a dedicated focus token if one exists in theme.
- Why: Improves visual affordance and consistency with other focused controls.
- Priority: Low
- Status: Pending

### Correct clamp comments to match configured counts
- Goal: Keep CSS comments in sync with actual behavior.
- What: Update comments near clamp rules in [dashboard.css](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/dashboard.css) to reflect the configured number of lines.
- Why: Prevents confusion during future maintenance.
- Priority: Low
- Status: Pending

### Skip empty summary paragraph in cards
- Goal: Avoid rendering empty blocks and extra spacing.
- What: Conditionally render the summary in [RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx) only when `summary` is truthy.
- Why: Prevents empty `<p>` from creating layout gaps when no abstract is available.
- Priority: Low
- Status: Pending

### Enforce auth gate on social sentiment tweets API
- Goal: Protect the public API route and align with repo guidance for `/api/*` authentication.
- What: Add header-based auth to [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts) similar to other `/api/*` endpoints (support `Authorization: Bearer ${CRON_SECRET}` and/or `x-api-key: INTERNAL_API_KEY`). Reject unauthorized requests before constructing the Supabase service client.
- Why: Prevents bypass of RLS semantics and adheres to the documented API authentication policy in AGENTS.md.
- Priority: High
- Status: Pending

### Abort client fetch on unmount in RecentSocialActivity
- Goal: Avoid setState on unmounted component and unnecessary work.
- What: Use `AbortController` in [RecentSocialActivity.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RecentSocialActivity.tsx) to cancel the fetch in the `useEffect` cleanup and pass the signal to `fetch`.
- Why: Improves resilience during rapid brand switches/navigation.
- Priority: Medium
- Status: Pending

### Virtualize day tweet lists for large groups
- Goal: Maintain smooth scrolling with very large per-day tweet counts.
- What: Integrate light virtualization (e.g., windowed list) in [RecentSocialActivity.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RecentSocialActivity.tsx) when counts exceed a threshold.
- Why: Reduces render cost and memory footprint for extreme cases without server truncation.
- Priority: Low
- Status: Pending

### Standardize time formatting in RecentSocialActivity
- Goal: Ensure consistent, compact time display across locales.
- What: Provide explicit `hour`, `minute`, and `hour12` options to `toLocaleTimeString()` and consider a consistent `Intl.DateTimeFormat` instance in [RecentSocialActivity.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RecentSocialActivity.tsx).
- Why: Removes minor inconsistencies in time rendering across browsers/locales.
- Priority: Low
- Status: Pending

### Prevent keyword chip key collisions
- Goal: Avoid potential React key collisions for duplicate keywords across tweets.
- What: Use a composite key (e.g., ``${t.id}-${kw}``) or include index when mapping chips in [RecentSocialActivity.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RecentSocialActivity.tsx).
- Why: Ensures stable, unique keys even when keywords repeat.
- Priority: Low
- Status: Pending


### Include error details in development for tweets API
- Goal: Improve debuggability while keeping production responses generic.
- What: In [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts) catch block, include `error.message` when `NODE_ENV !== 'production'`.
- Why: Aids debugging during local/dev without leaking details in prod.
- Priority: Low
- Status: Pending

### Add repository tests for keyword overlap and UTC day bucketing
- Goal: Prevent regressions in case-insensitive keyword matching and last-N UTC calendar day grouping.
- What: Tests for [DashboardRepository.getTweetsByPostedWindow](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/DataAccess/Repositories/DashboardRepository.ts) covering lowercased keyword overlaps and UTC midnight windowing, plus route-level grouping/slicing by `postedAt` day in [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts).
- Why: Codifies behavior, eliminates ambiguity between processed vs posted day, and protects against regressions.
- Priority: Medium
- Status: Pending
