# Apify Tweet Scraper Input Validation (2025-09-29)

> Slice-Hinweis: Änderungen fließen in den Vertical Slice `src/Features/ApifyPipeline`, insbesondere in die Dokumente unter `src/Features/ApifyPipeline/Docs` und die Input-Kontrakte in `src/Features/ApifyPipeline/Scheduler/Application/Contracts`.

## Parameter Findings
- The actor exposes the field name `tweetLanguage` (ISO 639-1 enum) rather than `twitterLanguage`; the current table in [specification.md §12](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L162-L193) should be updated to reflect the official schema.
  - Source: [Apify input schema](https://apify.com/apidojo/tweet-scraper/input-schema), [Apify API example](https://apify.com/apidojo/tweet-scraper/api/python)
- A `sort` parameter (`Top` | `Latest`) is now available for search flows and is absent from the documentation table.
  - Source: [Apify input schema](https://apify.com/apidojo/tweet-scraper/input-schema), [Apify API example](https://apify.com/apidojo/tweet-scraper/api/python)
- All other listed fields and defaults match the actor table published on the store page; defaults such as `maxItems: Infinity` and booleans remain accurate.
  - Source: [Apify actor page](https://apify.com/apidojo/tweet-scraper)

## Compliance & Rate Limit Notes (2025)
- Apify now enforces anti-monitoring rules: no more than one concurrent run, at most five batched queries, mandatory pauses of several minutes between runs, and a minimum of 50 tweets per query; scraping single tweets requires prior approval.
  - Source: [Apify actor page](https://apify.com/apidojo/tweet-scraper)

## Migration Guidance
- Apify recommends moving off the official X API due to tightened pricing and rate limits, suggesting ready-made Apify scrapers (including Tweet Scraper V2) or custom Python crawlers augmented with proxies, cookie reuse, and anti-blocking strategies.
  - Source: [Apify blog (Sep 9, 2025)](https://blog.apify.com/how-to-scrape-tweets-and-more-on-twitter-59330e6fb522/)

## Suggested Documentation Updates
- Rename `twitterLanguage` to `tweetLanguage` and add the enum note for supported ISO codes in [specification.md §12](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L162-L193).
- Insert the missing `sort` parameter (enum `Top`/`Latest`, default `Top`) in the same input table with a brief usage note.
- Add a compliance callout summarizing Apify's concurrency, batching, and minimum-volume requirements so runs remain within 2025 policy.
- Consider linking to Apify's 2025 guidance on migrating from the official API for additional context in an appendix or operational notes.
