# Apify Pipeline Code Review – 2025-10-01

## Summary
- The implementation largely follows the documented slice structure, but I found three material issues that undermine security, ingestion reliability, and compliance with Apify rate-limit guidance.
- Addressing these issues will harden the cron entry point, prevent premature success logging, and keep the collector within documented throttle constraints.

## Major Findings

### 1. `/api/start-apify-run` is unauthenticated
- **Expectation:** The implementation plan calls for the API route to authenticate invocations ([implementation-plan.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/implementation-plan.md#L252-L279)).
- **Reality:** The endpoint accepts any POST request and immediately runs the actor ([StartApifyRunEndpoint.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Web/Application/Commands/StartApifyRun/StartApifyRunEndpoint.ts#L25-L60)). Unlike the other pipeline routes, it never consults `authenticateRequest` or an API key.
- **Impact:** Anyone who discovers the production URL can trigger paid Apify jobs, burn through Vercel cron credits, and skew ingestion metrics.
- **Recommendation:** Reuse the shared `authenticateRequest` helper (or an equivalent guard) before dispatching the command and document the required header alongside the other routes.

### 2. Command defaults override throttle safeguards
- **Expectation:** Documentation states the actor should pause at least five minutes between keyword batches and keep batch sizes within Apify limits ([specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L18-L24), [apify-scraper-params.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/web-results/apify-scraper-params.md#L13-L18)).
- **Reality:** The command layer defaults `cooldownSeconds` to `0` and allows `maxItemsPerKeyword` up to `1000` ([StartApifyRunCommand.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Web/Application/Commands/StartApifyRun/StartApifyRunCommand.ts#L3-L31)). When forwarded to the actor, those values bypass the actor’s five-minute default and exceed its Zod maximum of 500 ([TweetCollectorJob.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Background/Jobs/TweetCollector/TweetCollectorJob.ts#L23-L46)), causing validation failures for large requests.
- **Impact:** Cron-triggered runs hammer Apify with back-to-back batches, breaching the documented operating guidance; manual runs above 500 items abort before ingestion starts.
- **Recommendation:** Remove the zero cooldown from the command defaults (let the actor supply 300 seconds) and align the command’s upper bound with the actor (`maxItemsPerKeyword <= 500`). Consider rejecting overrides that would violate Apify’s pause policy.

### 3. Cron run status logged before persistence completes
- **Observation:** The actor writes a success record to `cron_runs` before inserting `raw_tweets` and `normalized_tweets` ([TweetCollectorJob.ts](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Background/Jobs/TweetCollector/TweetCollectorJob.ts#L202-L260)). If the database insert later fails, the catch block records a second "failed" run with a new UUID instead of correcting the original entry.
- **Impact:** Operators see a successful run even though no tweets were stored, and duplicate records obscure real failure counts—contrary to the metrics described in [overview.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/overview.md#L99-L105).
- **Recommendation:** Defer writing the `cron_runs` record until after the persistence steps succeed, or update the existing row when failures occur. This keeps the append-only audit accurate.

## Additional Notes
- The dashboard pages build Supabase clients with the service-role key; if the UI is meant to be publicly reachable, consider swapping to a restricted role to keep surface area minimal.
- Backfill execution currently writes `cron_runs` entries with status `running` but never flips them to a terminal state; you may want to reuse the ingestion metrics pipeline for those runs as well.
