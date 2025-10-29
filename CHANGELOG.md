# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed

### Added

### Changed

### Removed

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
