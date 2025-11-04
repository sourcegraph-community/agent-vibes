# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Goal
Align Recent Social Activity to show exactly the last N UTC calendar days by posted date, ensure case-insensitive keyword filtering, and keep API payloads minimal and consistent.

### Added
- Repository method to fetch tweets by posted-day window with required sentiment and latest-per-tweet selection: [DashboardRepository.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/DataAccess/Repositories/DashboardRepository.ts).

### Changed
- Group by posted day (no processed fallback) and slice to last `days` groups; sort days via ISO string compare in desc order in [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts).
- Anchor window start to UTC midnight using `setUTCHours(0,0,0,0)` to match ISO date grouping in [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts).
- Normalize product keywords to lowercase at the API boundary and in repository queries to avoid case-sensitive misses in [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts) and [DashboardRepository.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/DataAccess/Repositories/DashboardRepository.ts).
- Switch data source to strict posted-day window via `getTweetsByPostedWindow` and use it in the tweets API route in [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts).
- Early-return payload aligned across empty/non-empty responses to include `summary.product` and `generatedAt` in [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts).

### Removed
- `processedAt` from tweets API payloads and types in [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts) and [DashboardRepository.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/DataAccess/Repositories/DashboardRepository.ts).
- `getTweetsByProcessedWindow` in favor of strict posted-day window selection in [DashboardRepository.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/DataAccess/Repositories/DashboardRepository.ts).
- Transient `dayKey` from the returned tweets (used only for grouping) in [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts).


## [Agent-Vibes 0.1.5]

### Goal
Implement and refine “Recent Social Activity” in dashboard-v2: group tweets by day (collapsibles), filter by brand, always last 7 days, per‑day scroll without server truncation, subtle separators, themed scrollbar, and sentiment badges (green/red).

### Added
- New grouped tweets API endpoint returning last N days grouped by day with latest sentiment per tweet in [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts). Supports optional brand filtering via keyword overlap and optional language filter. Fetch window is capped; the server does not slice per day (UI controls scroll).
- New collapsible Recent Social Activity component rendering day groups with compact spacing, thin dividers, themed scrollbar, and sentiment badges in [RecentSocialActivity.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RecentSocialActivity.tsx).

### Changed
- Integrated Recent Social Activity into Social Sentiment and decoupled from chart timeframe; uses fixed last 7 days and an optional brand prop in [SocialSentiment.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/SocialSentiment.tsx).
- Added reusable themed thin scrollbar styles used by the day list in [dashboard.css](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/dashboard.css).

### Fixed
- Eliminated double URL encoding for the `products` param on the client; rely on `URLSearchParams` single encoding in [RecentSocialActivity.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RecentSocialActivity.tsx). Removed server-side manual decode and parse query directly in [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts).
- Replaced manual array literal filter with Supabase `.overlaps('keyword_snapshot', productKeywords)` for robust keyword matching in [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts).
- Parallelized product keyword lookups with `Promise.all` and deduped merged results in [route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/social-sentiment/tweets/route.ts).

## [nextjs 0.1.4]

### Goal
Replace Social Sentiment brand radio group with a labeled dropdown in the Sentiment Trends header; fix select chevron spacing and ensure visible focus.

### Changed
- Replaced brand radio buttons with a right-aligned labeled `<select>` inside the Sentiment Trends card header in [SocialSentiment.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/SocialSentiment.tsx); preserved `selectedBrand` state and fetch behavior and added an "All brands" placeholder option to keep the control fully controlled and allow clearing.
- Updated shared `.select` styles in [dashboard.css](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/dashboard.css) to add right padding and a custom chevron (appearance reset + inline SVG with `background-position: right 0.75rem`) so the caret has breathing room; applies to both timeframe and brand selects.
- Added `.select:focus-visible` outline and border-color to restore clear keyboard focus after removing native appearance.

### Goal
Align highlight cards layout and behavior for TL;DR, Product Updates, and Research Papers: clamp abstracts, pin footer to bottom, ensure consistent heights, and streamline badge/time rendering.

### Changed
- Made highlight cards flex columns and pinned footers in [dashboard.css](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/dashboard.css) via `.highlight-card { display:flex; flex-direction:column; height:100% }`.
- Added multi-line clamp with ellipsis for summaries via `.highlight-summary` and applied in [RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx) and TL;DR examples in [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx).
- Anchored footer and clamped metadata in [dashboard.css](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/dashboard.css) via `.highlight-footer { margin-top:auto }` and a 3-line clamp for `.highlight-footer > span`. Emphasized "Read more →" with semibold and hover underline.
- Hid redundant category badges in dedicated sections by adding `showBadge?: boolean` to [RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx), `showBadges?: boolean` to [RssSection.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssSection.tsx), and passing `showBadges={false}` for Product Updates and Research Papers in [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx). Left-align time when badge is hidden via `.highlight-header.single`.
- Mapped API categories to badge tokens in [RssEntryCard.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssEntryCard.tsx) to keep visual tokens consistent.

### Goal
Fix Research categorization by enforcing "feed category wins" with a research-domain whitelist override; no other changes.

### Changed
- Implemented domain whitelist override and feed-first categorization in [SyncEntriesCommandHandler.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/SyncEntries/SyncEntriesCommandHandler.ts):
  - Whitelist research hosts (`arxiv.org`, `export.arxiv.org`, `paperswithcode.com`, `www.artificial-intelligence.blog`, `xaiguy.substack.com`) → force `industry_research`.
  - Else prefer feed-provided category when valid (`isValidCategory`).
  - Else fall back to keyword inference (`inferCategory`).
- Documented the policy in [README.md](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/README.md#L36-L44) under "Categorization Policy".

### Goal
Implement OPML directory discovery, wire Research Papers into dashboard, and harden deploy-safe filesystem usage for RSS API routes.

### Added
- Shared OPML discovery utility to find all `.opml` files in configured directories: [opmlDiscovery.ts](file:///home/prinova/CodeProjects/agent-vibes/src/Shared/Infrastructure/Utilities/opmlDiscovery.ts).
- Research Papers OPML source list: [research-papers.opml](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Data/research-papers.opml).

### Changed
- Enforced Node.js runtime for RSS API routes to allow filesystem access:
  - [app/api/rss/entries/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/entries/route.ts)
  - [app/api/rss/sync/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/sync/route.ts)
  - [app/api/rss/summarize/route.ts](file:///home/prinova/CodeProjects/agent-vibes/app/api/rss/summarize/route.ts)
- Added `outputFileTracingIncludes` for RSS routes so OPML/Data files are bundled in serverless output: [next.config.ts](file:///home/prinova/CodeProjects/agent-vibes/next.config.ts).
- Aggregator now discovers `.opml` from a directory list using the shared helper and `process.cwd()` for deploy-safe paths: [inhouse.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/inhouse.ts).
- Dry-run script aligned to the same OPML directory discovery and now fails loudly when no feeds are found: [dry-run-inhouse-rss.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/dry-run-inhouse-rss.ts).
- Dashboard “Research Papers” section wired to RSS entries API using the existing `RssSection` component (category `industry_research`, `limit=8`): [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx).

## [Agent-Vibes 0.1.3]

### Goal
Add Build Crew Discussions section and placeholders for content areas; simplify Timeline and remove Miniflux note while preserving existing styling.

### Added
- New sidebar link for Build Crew Discussions in [page.tsx#L64-L70](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L64-L70).
- New "Build Crew Discussions" section above TL;DR Highlights in [page.tsx#L236-L244](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L236-L244).

### Changed
- Sidebar order updated so "Build Crew Discussions" appears above "TL;DR Highlights" in [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx).
- Replaced content of Product Updates, Research Papers, and Perspective Pieces with bold, slightly larger "Coming soon..." placeholders in [page.tsx#L330-L338](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L330-L338), [page.tsx#L340-L348](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L340-L348), and [page.tsx#L350-L358](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L350-L358).
- Simplified Timeline View to a single bold placeholder in [page.tsx#L361-L367](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L361-L367).

### Removed
- Miniflux integration note under TL;DR Highlights removed in [page.tsx#L246-L264](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L246-L264) and trailing section closure at [page.tsx#L328](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L328).
- `RssSection` import and usages removed/replaced with placeholders in [page.tsx#L3-L6](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L3-L6), [page.tsx#L330-L358](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx#L330-L358).

### Goal
Ingest “Product Updates” via in-house RSS only; remove external Miniflux path; keep configuration explicit and simple with OPML sources.

### Added
- New OPML file for Product Updates feeds: [product-updates.opml](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Data/product-updates.opml).

### Changed
- In-house Miniflux client simplified to in-house only; HTTP/external path removed in [client.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/client.ts).
- In-house feed source now hardcoded to OPML list; parses aggregated feeds from OPML in [inhouse.ts#L6-L13](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/inhouse.ts#L6-L13) and [inhouse.ts#L54-L64](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/inhouse.ts#L54-L64).
- Dry-run script updated to read OPML list directly (no env-based INHOUSE_RSS_FEEDS) in [dry-run-inhouse-rss.ts#L12-L16](file:///home/prinova/CodeProjects/agent-vibes/scripts/dry-run-inhouse-rss.ts#L12-L16) and [dry-run-inhouse-rss.ts#L27-L35](file:///home/prinova/CodeProjects/agent-vibes/scripts/dry-run-inhouse-rss.ts#L27-L35).
- RSS Pipeline README updated to reflect in-house only path in [README.md#L1-L6](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/README.md#L1-L6) and structure notes in [README.md#L18-L31](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/README.md#L18-L31).
- Test setup simplified for in-house path in [inhouse-dry-run.test.ts#L38-L47](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/__tests__/inhouse-dry-run.test.ts#L38-L47).
- `.gitignore` updated to ignore `plan/` artifacts in [.gitignore#L49-L52](file:///home/prinova/CodeProjects/agent-vibes/.gitignore#L49-L52).

### Removed
- Legacy combined OPML removed: [miniflux-feeds.opml](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Data/miniflux-feeds.opml).
- External Miniflux config/env path removed from example envs: `MINIFLUX_MODE` deleted in [.env.example#L76-L80](file:///home/prinova/CodeProjects/agent-vibes/.env.example#L76-L80).

### Goal
Align RSS pipeline with shared Supabase client conventions and standardize env usage.

### Added
- Shared Supabase service client under [serviceClient.ts](file:///home/prinova/CodeProjects/agent-vibes/src/Shared/Infrastructure/Storage/Supabase/serviceClient.ts); exported type `SupabaseServiceClient` and factory `createSupabaseServiceClient`.
- Backward-compatible re-export in [client.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/ExternalServices/Supabase/client.ts) to avoid broad import churn.

### Changed
- RSS command handlers now use the shared client: [SyncEntriesCommandHandler.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/SyncEntries/SyncEntriesCommandHandler.ts) and [GenerateSummariesCommandHandler.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/GenerateSummaries/GenerateSummariesCommandHandler.ts).
- Standardized env: replaced documentation references of `NEXT_PUBLIC_SUPABASE_URL` with `SUPABASE_URL` in [README.md](file:///home/prinova/CodeProjects/agent-vibes/README.md), [ApifyPipeline/README.md](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/README.md), and [GenerateSummaries/README.md](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/Web/Application/Commands/GenerateSummaries/README.md). Updated [env.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Infrastructure/Config/env.ts) to source client URL from server `SUPABASE_URL` and adjusted [.env.example](file:///home/prinova/CodeProjects/agent-vibes/.env.example).

### Notes
- Clarified docs: `NEXT_PUBLIC_SUPABASE_ANON_KEY` is client-only and not equivalent to `SUPABASE_SERVICE_ROLE_KEY` in [README.md](file:///home/prinova/CodeProjects/agent-vibes/README.md) and [ApifyPipeline/README.md](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/README.md).

### Goal
Fix RSS dry-run OPML path; implement per-feed cap semantics for `RSS_SYNC_LIMIT`; align dry-run and sync behavior/logs (no new env vars).

### Changed
- Corrected OPML path for the in-house Miniflux client in [inhouse.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/inhouse.ts).
- Implemented per-feed cap semantics in [inhouse.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/ExternalServices/Miniflux/inhouse.ts): filter/sort per feed, cap to `limit`, flatten, then globally order by `published_at`; removed global slicing by `limit`.
- Clarified dry-run logs in [dry-run-inhouse-rss.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/dry-run-inhouse-rss.ts) ("Per-feed limit", "Theoretical max fetched").
- Ensured sync script matches behavior and log wording in [sync-rss-entries.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/sync-rss-entries.ts).
- Updated unit test to assert per-feed cap and descending order in [inhouse-dry-run.test.ts](file:///home/prinova/CodeProjects/agent-vibes/src/RssPipeline/__tests__/inhouse-dry-run.test.ts).

### Goal
Wire back Product Updates in dashboard-v2 and surface the latest Product Update in TL;DR Highlights.

### Added
- Latest Product Update wired into TL;DR Highlights via a client-side fetch of one item from `/api/rss/entries?category=product_updates&limit=1` with a graceful fallback when unavailable in [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx).

### Changed
- Restored Product Updates section to use [RssSection.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssSection.tsx) (category `product_updates`, `limit=8`, `showLoadMore`) in [page.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/page.tsx).
- Updated default `limit` of [RssSection.tsx](file:///home/prinova/CodeProjects/agent-vibes/app/dashboard-v2/components/RssSection.tsx) from `6` to `8` to match historical behavior.

## [Agent-Vibes 0.1.3]

### Goal
Remove Supabase Edge function from the ApifyPipeline execution path for ad-hoc collectors while keeping the edge function available in the codebase.

### Fixed

### Added
- Environment toggles for local sentiment processing loop in [process-sentiments.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/process-sentiments.ts): `SENTIMENT_LOOP_ALL` (default `true`) and `SENTIMENT_LOOP_MAX_RUNS` (default `100`). Batch size continues to be governed by `NUMBER_OF_PENDING_TWEETS` with clamping to 1..200.

### Changed
- Local sentiment processing now loops until no `pending_sentiment` items remain, bounded by `SENTIMENT_LOOP_MAX_RUNS` with clear exit/guard conditions. See loop implementation in [process-sentiments.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/process-sentiments.ts).
- `start:collector` path now defers sentiment analysis to the internal processor step only; the ad-hoc collector script no longer invokes the Supabase Edge function directly. See [start-apify-run.ts#L400-L402](file:///home/prinova/CodeProjects/agent-vibes/scripts/start-apify-run.ts#L400-L402) and the `start:collector` chain in [package.json#L31-L33](file:///home/prinova/CodeProjects/agent-vibes/package.json#L31-L33).

### Removed
- Supabase Edge function invocation from the ad-hoc collector script imports. See [start-apify-run.ts#L1-L12](file:///home/prinova/CodeProjects/agent-vibes/scripts/start-apify-run.ts#L1-L12).

## [Agent-Vibes 0.1.2]

### Fixed
- Product keyword filtering now case-insensitive via `.ilike` in KeywordsRepository, resolving regression caused by DB schema change from lowercase to TitleCase product values
- Keyword resolution fallback logic improved: product-specific queries fall back to all enabled DB keywords before using static defaults, with DB errors logged and rethrown to prevent silent fallback during outages

### Added

### Changed
- Social Sentiment chart refactored to single-brand radio selection (replaces multi-select checkboxes) with first brand auto-selected
- Brand filter UI simplified: removed "All/Clear" buttons and color-hashing logic; now uses fixed two-series chart styling (Positive light grey solid, Negative medium grey dashed)
- API request flow streamlined: single `/api/social-sentiment/by-product` call per selected brand instead of comma-delimited multi-product parameter
- Chart color palette replaced with static greyscale (no brand-based color hashing)

### Removed
- Multi-select checkbox filter for brands (replaced by single-brand radio group)
- Brand color hashing function and color palette array
- "Select All" / "Clear" filter buttons
- Multi-product chart series with brand-specific colors

## [Agent-Vibes 0.1.1]

### Fixed
- Sticky header offset now correctly applied to anchor navigation; sections scroll into view accounting for header height

### Added
- Dynamic CSS variable `--header-offset` calculated from actual header height for responsive scroll-margin
- Active navigation state management via hashchange listener and click handlers
- `#overview` and `#sentiment` anchor IDs for semantic navigation

### Changed
- Dashboard sidebar navigation reordered: Overview → Social Sentiment → TL;DR Highlights
- Removed duplicate "Sentiment Trends" and "Social Sentiment" entries from sidebar
- Removed "Social Sentiment" from Content section (now in Dashboard section)
- `SocialSentiment` component moved from dedicated section to end of Overview section for improved visual hierarchy

### Removed
