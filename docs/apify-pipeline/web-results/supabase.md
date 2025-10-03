# Supabase Documentation Review — 29 Sep 2025

> Slice note: Persistence and Edge Functions are in the Vertical Slice `src/ApifyPipeline/DataAccess` and `src/ApifyPipeline/ExternalServices` respectively, with related ADRs in `src/ApifyPipeline/Docs`.

## Current Alignment with Pipeline Docs
- Supabase remains a fully managed Postgres stack with instant APIs, realtime streaming, extension support (pgvector, pg_cron, PostGIS), and tooling suited for append-only tweet storage, so the persistence claims in the pipeline overview/spec continue to hold. [Source](https://supabase.com/docs/guides/database/overview)

## 2025 Changes to Incorporate
- Supabase now issues `sb_publishable_` and `sb_secret_` keys alongside legacy `anon`/`service_role` JWT keys; docs should note secret keys are the recommended choice for backend workloads and clarify migration/rotation guidance. [Source](https://supabase.com/docs/guides/api/api-keys)
- Postgres 17 rollout deprecates extensions such as TimescaleDB, plv8, and pgjwt while encouraging alternatives like `pg_partman`; highlight this for any time-series or token features you plan to rely on. [Source](https://supabase.com/changelog)
- Realtime quotas and controls now expose configurable channel limits, connection pools, and rate limits in the dashboard—useful context for the optional realtime stretch goal. [Source](https://supabase.com/changelog)
- Edge Functions gained persistent S3-compatible storage and ~97% faster cold starts, making them more viable for sentiment processing triggers; link these benefits in the spec. [Source](https://supabase.com/blog/persistent-storage-for-faster-edge-functions)
- Supabase’s own guidance for large scheduled workloads favors Cron + Queue layering and single-item processing loops, which complements the existing `maxItems` backfill plan; consider referencing this pattern. [Source](https://supabase.com/blog/processing-large-jobs-with-edge-functions)

## Operational Considerations
- Free tier still caps databases at 500 MB, while Pro includes 8 GB (expandable) and 5M realtime messages—factor this into 500+ tweet runs and retention planning. [Source](https://supabase.com/pricing)
- Edge Function secrets remain the right place for service role credentials; document the CLI/dashboard workflow so Apify and Vercel stays aligned. [Source](https://supabase.com/docs/guides/functions/secrets)

## Next Steps for Docs
1. Update secret management sections to reference `sb_secret_` keys and rotation practices.
2. Add a note about Postgres 17 extension removals and recommend alternatives if needed.
3. Mention new realtime controls and quotas when describing dashboard capabilities.
4. Link to Supabase’s queue/cron guidance for large ingestion runs.
