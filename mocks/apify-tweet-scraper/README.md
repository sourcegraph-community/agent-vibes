# Apify Tweet Scraper Actor Mocks

This folder provides deterministic fixtures for the **Tweet Scraper V2 – X / Twitter Scraper** Apify actor. The assets reproduce common, high-signal scenarios so that UI components, pipelines, and monitoring logic can be exercised without issuing paid API calls.

## Folder Structure

- `data/`
  - `inputs/` – JSON payloads that can be sent to the actor.
  - `outputs/` – Representative JSON datasets produced by the actor for the paired inputs.
  - `scenarios.json` – Registry mapping test cases to their fixture files.
- `apify-tweet-scraper.css` – Styling shared by the Next.js mock route.

## Usage

1. **Primary source:** The Next.js route at `/mocks/apify-tweet-scraper` hydrates directly from the files in `data/` and applies `apify-tweet-scraper.css`, so the rendered dashboard stays synchronized with the mock fixtures.
2. **Local experiments:** If you need a standalone HTML mock again, duplicate the route markup or create an HTML shell that imports the same CSS and data files.

## Notes

- Keep payloads minimal but structurally accurate. Freeze generated fields (timestamps, counts) so downstream tests remain stable.
- Update `scenarios.json` whenever new scenarios are added; the Next.js page will pick up differences automatically.
