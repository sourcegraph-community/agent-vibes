# Apify Twitter/X Data Collection Status (2025-09-29)

> Slice note: Operational decisions affect the Vertical Slice `src/ApifyPipeline`, particularly scheduler commands under `src/ApifyPipeline/Scheduler` and slice documents in `src/ApifyPipeline/Docs`.

## Official X API Access (Twitter/X) - Not Used
- **Tier structure:** X maintains Free, Basic (US$200/mo), Pro (US$5,000/mo), and Enterprise tiers. Only Pro and above include full access with full-archive search and filtered streams; Free and Basic tiers are confined to limited search and low monthly post caps (100 and 15,000 respectively). [Source](https://docs.x.com/x-api/getting-started/about-x-api)
- **Recent changes:** Late-2024 updates doubled the Basic tier price, limited top-ups, and pushed annual commitments, raising barriers for sustained keyword monitoring. [Source](https://www.techzine.eu/news/devops/125764/x-makes-access-to-apis-more-expensive/)
- **Decision:** This pipeline does not use the official X API due to cost. Instead, it uses Apify's Twitter Search Scraper.

## Apify Platform Offerings - Current Approach
- **Twitter Search Scraper:** Community-maintained scraper delivering 30–80 tweets/sec, advanced filters, and historical search, priced at about US$0.40 per 1,000 tweets on paid plans. It explicitly forbids monitoring-style frequent runs, enforces batching minimums, and operates via web scraping. [Source](https://apify.com/apidojo/tweet-scraper)
- **Official guidance:** Apify's September 2025 blog recommends using scraper actors instead of the official API due to expensive pricing ($200 Basic for 15k tweets/month, Free capped at 100 per month) and account approval hurdles. [Source](https://blog.apify.com/how-to-download-tweets-from-twitter/)
- **Alternate actors:** Additional 2025 actors such as "X/Twitter Trends Scraper" offer trend monitoring (US$15/month subscription plus usage fees) via Apify API endpoints, also leveraging scraping-based data collection. [Source](https://apify.com/fastcrawler/x-twitter-trends-scraper-2025/api)

## Compliance & Operational Considerations
- Apify scraping actors stress adherence to Twitter's policies, ban high-frequency monitoring, and may throttle or ban users who violate usage rules, implying increased enforcement risk when aiming for cron-based collection.
- This pipeline uses the Apify Twitter Search Scraper with appropriate throttling (2-hour intervals, batch limits) to comply with anti-monitoring restrictions.

## Implementation Status
- This pipeline uses a Node.js/TypeScript Apify Actor with the Apify Twitter Search Scraper for configurable keyword-based collection and cron-based scheduling.
- The implementation follows anti-monitoring restrictions: 2-hour intervals, keyword batch limits (5 keywords per batch), and cooldown periods between batches.
- Date-based filtering ensures incremental collection (fetches only tweets since last run) to minimize API usage and costs.

## Source Log
1. https://docs.x.com/x-api/getting-started/about-x-api (accessed 2025-09-29)
2. https://developer.x.com/en (accessed 2025-09-29)
3. https://www.techzine.eu/news/devops/125764/x-makes-access-to-apis-more-expensive/ (accessed 2025-09-29)
4. https://blog.apify.com/how-to-download-tweets-from-twitter/ (accessed 2025-09-29)
5. https://apify.com/apidojo/tweet-scraper (accessed 2025-09-29)
6. https://apify.com/fastcrawler/x-twitter-trends-scraper-2025/api (accessed 2025-09-29)
