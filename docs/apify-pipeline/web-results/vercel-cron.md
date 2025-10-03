# Vercel Cron ↔ Apify Trigger Review (29 Sep 2025)

> Slice note: Cron flows live in the Vertical Slice `src/ApifyPipeline/Scheduler`, with exported endpoints residing under `src/ApifyPipeline/Web/Application/Commands`.

## Summary
- [overview.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/overview.md#L6-L8) and [specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md#L16-L18) state that a Vercel Cron job directly triggers the Apify Actor via webhook. Current Vercel docs confirm cron invocations only fetch paths on the same Vercel deployment, e.g. `https://<project>.vercel.app/api/...`, so direct calls to external Apify webhooks are not supported. The pipeline must route cron invocations through a Vercel Function that then calls the Apify Run API.

## Updated Guidance
- Configure the cron entry (`vercel.json` or Build Output API) to hit an internal endpoint such as `/api/start-apify-run`; inside that handler, invoke Apify's Run Actor API with the required payload and authentication.
- Finely grained schedules (for example every 2 hours) require the Pro plan or higher. The Hobby plan limits cron jobs to one invocation per day, which would not meet the documented 2-hour cadence.
- Manual execution remains available via Apify Console, API, CLI, or scheduler; no documentation change needed for the manual trigger claim.

## References
- Vercel Docs – Cron jobs only call production deployment paths (`https://*.vercel.app/api/...`): https://vercel.com/docs/cron-jobs (see “How cron jobs work”).
- Vercel Guide – Cron `path` must start with `/` (internal route requirement): https://vercel.com/guides/how-to-setup-cron-jobs-on-vercel.
- Vercel Cron Usage & Pricing – Plan limits (Hobby once/day, Pro unlimited minute-level scheduling): https://vercel.com/docs/cron-jobs/usage-and-pricing.
- Apify Actors – Manual runs via Console/API/CLI/Scheduler remain supported: https://docs.apify.com/platform/actors.
