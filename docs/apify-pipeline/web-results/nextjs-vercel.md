# Next.js 15 & Vercel Hosting Review (29 Sep 2025)

> Slice-Hinweis: Frontend-Änderungen betreffen den Vertical Slice `src/ApifyPipeline/Web/Components/Dashboard` sowie begleitende Server Actions in `src/ApifyPipeline/Web/Application/Commands`.

## Release Status & Core Changes
- Next.js 15 has been stable since 21 Oct 2024, and the 15.5 release on 18 Aug 2025 confirms the branch remains current with features such as beta Turbopack production builds, stable Node.js middleware, typed routes, and upcoming Next.js 16 deprecations that teams should prepare for (e.g., `next lint`, AMP removal, image quality configs). [Source](https://nextjs.org/blog/next-15) · [Source](https://nextjs.org/blog/next-15-5)
- Dynamic App Router request APIs (`cookies`, `headers`, `draftMode`, `params`, `searchParams`) are now asynchronous; migrations require `await`/`React.use` plus the `next-async-request-api` codemod. This impacts any Supabase auth/session helpers referencing these APIs. [Source](https://nextjs.org/blog/next-15) · [Source](https://nextjs.org/docs/messages/sync-dynamic-apis)
- Server Actions gained hardened IDs and the optional `unstable_after` helper for post-stream side work, while data-fetching improvements reuse cached `fetch` calls across worker boundaries to speed builds. [Source](https://nextjs.org/blog/next-15)

## Partial Prerendering (PPR)
- PPR remains experimental in Next.js 15 and requires the canary channel plus explicit `experimental_ppr = true` per route. It should not be positioned as production-ready yet. [Source](https://nextjs.org/docs/app/api-reference/config/next-config-js/ppr)

## Supabase Integration Notes
- Supabase’s recommended path is the `@supabase/ssr` helpers with async Server Components, middleware-driven token refresh, and Server Actions—aligning with Next.js 15’s async request APIs and App Router defaults. Auth Helpers are deprecated in favor of this flow. [Source](https://supabase.com/docs/guides/auth/server-side/nextjs)

## Vercel Hosting Considerations
- Node.js 18 is deprecated for Vercel Builds/Functions on 1 Sep 2025; Next.js dashboards must target Node.js 20+ for future deployments, though existing prod deployments continue running. [Source](https://vercel.com/changelog/node-js-18-is-being-deprecated)
- Vercel’s pricing (Hobby vs Pro) caps free usage at 1M Edge Requests, 100 GB transfer, and 5K image transforms per month; Pro at $20/month adds higher allowances and credits. Documenting expected traffic/costs for the dashboard will help choose the right tier. [Source](https://vercel.com/pricing)
- Vercel’s Next.js guidance highlights zero-config App Router support, streaming, ISR, and experimental PPR; teams can safely adopt Turbopack in dev today and evaluate beta production builds from 15.5 for faster CI/CD. [Source](https://vercel.com/docs/frameworks/nextjs) · [Source](https://nextjs.org/blog/next-15-5)

## Documentation Gaps to Address
- Note the async request API change and Supabase’s `@supabase/ssr` guidance in the frontend spec so integration work aligns with current best practices (e.g., update the frontend description in `docs/apify-pipeline/specification.md`).
- Record Vercel’s Node.js 20 requirement and pricing expectations in the deployment section to keep hosting guidance current.
- Treat PPR as optional/experimental rather than baseline until it leaves canary.
- Encourage evaluating `next build --turbopack` once dashboards are validated, but caution that it remains beta and requires monitoring for CSS ordering regressions.
