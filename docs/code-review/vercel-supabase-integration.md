# Vercel + Supabase Deployment Notes

_Last updated: 2025-09-18_

## Findings

- **Marketplace Integration** – The Vercel Marketplace provides one-click Supabase provisioning (`vc i supabase`), shared billing, and a streamlined onboarding flow that aligns with our plan to host the frontend on Vercel while managing data in Supabase [[source](https://vercel.com/blog/how-supabase-increased-signups-through-the-vercel-marketplace)].
- **Environment Variables & Redeploys** – Supabase migrated managed projects from PgBouncer to Supavisor in January 2024. Because Vercel lacks IPv6 support, production redeploys are required to pull the updated `POSTGRES_URL*` variables; projects that have not been redeployed since that change risk stale credentials [[source](https://supabase.com/partners/vercel)].
- **Connectivity Considerations** – Supabase’s deprecation thread highlights IPv6-only DNS for direct connections, recommends using Supavisor for Vercel workloads, and documents options (e.g., paid IPv4 add-on) plus CLI/CI implications when operating from IPv4-only networks [[source](https://github.com/orgs/supabase/discussions/17817)].

## Future Refactor Opportunities

- **Analytics Dashboard State Management** – The current mock analytics page relies on a large imperative script to drive interactions. Before wiring the dashboard to Supabase-backed data, consider migrating to React state/controllers to centralize filters and reduce DOM querying complexity.
- **Filter Synchronization Strategy** – Implement a shared filter state that drives metrics, highlights, and feeds alongside the sentiment chart. This work will be easier once the dashboard is componentized.
- **Operational Checklist** – Capture a deployment runbook covering Supabase environment pulls, CLI version expectations, and IPv6/IPv4 contingencies so the future Supabase integration is resilient across local, CI, and Vercel environments.
