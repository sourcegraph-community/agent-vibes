# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
