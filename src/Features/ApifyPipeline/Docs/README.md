# Apify Pipeline Slice Docs

## Keyword Ownership
- **Owner:** Analytics Guild – contact via `#analytics-insights`
- **Seed Source:** `src/Features/ApifyPipeline/Domain/Persistence/Seeds/20250929_1230_KeywordsSeed.sql`
- **Update Process:** Submit revised keyword list via analytics weekly sync; changes are applied by running the seed script followed by Supabase migration deploy.

## Secret Rotation
- **Responsible:** Ops Platform
- **Script:** `scripts/rotate-supabase-secrets.sh`
- **Process:** Export `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `APIFY_TOKEN` then execute the script. No secrets are logged.

## Schema Migrations
- **Primary Migration:** `src/Features/ApifyPipeline/Domain/Persistence/Migrations/20250929_1200_InitApifyPipeline.sql`
- **Verification:** Run migrations on Supabase dev via `supabase db reset --linked` and confirm views `vw_daily_sentiment` and `vw_keyword_trends` return demo rows from the seed data.
