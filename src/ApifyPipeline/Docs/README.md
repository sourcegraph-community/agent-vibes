# Apify Pipeline Slice Docs

## Documentation Index

- **[Operational Runbook](ApifyPipeline-start-apify-run-runbook.md)** - Complete operational procedures, incident response, and troubleshooting guide for the Apify Pipeline tweet collection system

## Keyword Ownership
- **Owner:** Analytics Guild – contact via `#analytics-insights`
- **Seed Source:** `src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql`
- **Update Process:** Submit revised keyword list via analytics weekly sync; changes are applied by running the seed script followed by Supabase migration deploy.

## Secret Rotation
- **Responsible:** Ops Platform
- **Script:** `scripts/rotate-supabase-secrets.ts`
- **Process:** Export `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `APIFY_TOKEN` then execute the script. No secrets are logged.
- **Schedule:** Quarterly rotation (see [runbook](ApifyPipeline-start-apify-run-runbook.md#secret-rotation-schedule) for details)

## Schema Migrations
- **Primary Migration:** `src/ApifyPipeline/DataAccess/Migrations/20250929_1200_InitApifyPipeline.sql`
- **Verification:** Run migrations on Supabase dev via `supabase db reset --linked` and confirm views `vw_daily_sentiment` and `vw_keyword_trends` return demo rows from the seed data.

## Operational Support
- **Primary Contact:** `#ops-oncall` (Slack)
- **Escalation:** `#backend-support` (Slack)
- **Full details:** See [operational runbook](ApifyPipeline-start-apify-run-runbook.md)
