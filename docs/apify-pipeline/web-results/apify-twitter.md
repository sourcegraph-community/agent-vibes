# Apify Twitter/X Data Collection Status (2025-09-29)

## Official X API Access (Twitter/X)
- **Tier structure:** X maintains Free, Basic (US$200/mo), Pro (US$5,000/mo), and Enterprise tiers. Only Pro and above include full X API v2 access with full-archive search and filtered streams; Free and Basic tiers are confined to limited standard v1.1 search and low monthly post caps (100 and 15,000 respectively). [Source](https://docs.x.com/x-api/getting-started/about-x-api)
- **Recent changes:** Late-2024 updates doubled the Basic tier price, limited top-ups, and pushed annual commitments, raising barriers for sustained keyword monitoring. [Source](https://www.techzine.eu/news/devops/125764/x-makes-access-to-apis-more-expensive/)
- **Feasibility:** Scheduled multi-keyword harvesting at two-hour intervals would exhaust Free tier immediately and likely exceed Basic tier caps; achieving reliable search coverage now effectively requires the Pro tier or higher.

## Apify Platform Offerings
- **Tweet Scraper V2 actor:** Community-maintained scraper delivering 30–80 tweets/sec, advanced filters, and historical search, priced at about US$0.40 per 1,000 tweets on paid plans. It explicitly forbids monitoring-style frequent runs, enforces batching minimums, and operates without official API credentials, indicating reliance on web scraping rather than Twitter API v2. [Source](https://apify.com/apidojo/tweet-scraper)
- **Official guidance:** Apifys September 2025 blog recommends using scraper actors instead of the official X API due to expensive pricing ($200 Basic for 15k tweets/month, Free capped at 100 per month) and account approval hurdles. [Source](https://blog.apify.com/how-to-download-tweets-from-twitter/)
- **Alternate actors:** Additional 2025 actors such as "X/Twitter Trends Scraper" offer trend monitoring (US$15/month subscription plus usage fees) via Apify API endpoints, again leveraging scraping-based data collection. [Source](https://apify.com/fastcrawler/x-twitter-trends-scraper-2025/api)

## Compliance & Operational Considerations
- Apify scraping actors stress adherence to Twitters policies, ban high-frequency monitoring, and may throttle or ban users who violate usage rules, implying increased enforcement risk when aiming for cron-based collection.
- Relying on official API credentials now requires budget approval for the Pro tier (~US$5k/month) and compliance with Xs tightened rate limits and access reviews.

## Implications for Existing Documentation
- The current pipeline docs assume a Node.js/TypeScript Apify Actor using Twitter API v2 with configurable keywords and cron-based scheduling. Given 2025 pricing and access shifts, that architecture is no longer viable without the Pro tier budget.
- Documentation must acknowledge the cost/feasibility gap and either (a) budget for X API Pro access, or (b) pivot to Apifys scraping actors while outlining their anti-monitoring restrictions and legal considerations.
- Scheduled two-hour cron runs against scraper actors conflict with Apifys monitoring prohibition; the docs should warn about acceptable run cadence and potential account throttling.

## Source Log
1. https://docs.x.com/x-api/getting-started/about-x-api (accessed 2025-09-29)
2. https://developer.x.com/en (accessed 2025-09-29)
3. https://www.techzine.eu/news/devops/125764/x-makes-access-to-apis-more-expensive/ (accessed 2025-09-29)
4. https://blog.apify.com/how-to-download-tweets-from-twitter/ (accessed 2025-09-29)
5. https://apify.com/apidojo/tweet-scraper (accessed 2025-09-29)
6. https://apify.com/fastcrawler/x-twitter-trends-scraper-2025/api (accessed 2025-09-29)
