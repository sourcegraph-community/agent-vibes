# Apify Tweet Scraper Actor Mocks

This folder provides deterministic fixtures for the **Tweet Scraper V2 – X / Twitter Scraper** Apify actor. The assets reproduce common, high-signal scenarios so that UI components, pipelines, and monitoring logic can be exercised without issuing paid API calls.

## Folder Structure

- `inputs/` – JSON payloads that can be sent to the actor.
- `outputs/` – Representative JSON datasets produced by the actor for the paired inputs.
- `scenarios.json` – Registry that maps high-level test cases to their fixture files.

## Scenarios

| Scenario | Description | Input | Output |
| --- | --- | --- | --- |
| `nasa-monthly-2023-01` | Captures NASA tweets for January 2023 using `from`, `since`, `until` search segments. | `inputs/nasa-monthly-2023-01.json` | `outputs/nasa-monthly-2023-01.json` |
| `hashtag-conversation-doge` | Fetches replies to a conversation that includes the `#DogeMission` hashtag. | `inputs/hashtag-conversation-doge.json` | `outputs/hashtag-conversation-doge.json` |

Each output file contains only a concise slice of the actor response while preserving field structure, enabling snapshot assertions without overwhelming fixtures.

## Usage

1. **Pair the files.** Load the relevant input fixture and assert against the matching output fixture.
2. **Extend cautiously.** When adding scenarios, update `scenarios.json` to include metadata (`id`, `title`, `input`, `output`, `notes`). Keep payloads minimal but structurally accurate.
3. **Stay deterministic.** For any generated fields (timestamps, counts), freeze them in the fixture so downstream tests remain stable.

## Pricing & Policy Notes

- Fixtures encode the actor’s guidance around batching (`~800 tweets/search`) and minimum item counts (≥ 50 per query) to reflect production usage rules.
- Monitoring-style polling is intentionally excluded; avoid adding such scenarios per actor restrictions.

## Next Steps

A lightweight tooling layer will be introduced separately to stream these fixtures into local mocks and contract tests. See the main project tracking issue for progress updates.
