## High-level summary
This patch removes the `NEXT_PUBLIC_SUPABASE_URL` environment variable from both code and documentation, standardising on the single server-side variable `SUPABASE_URL`.  
At the same time, all Supabase *service-role* access is centralised in a new shared helper (`src/Shared/Infrastructure/Storage/Supabase/serviceClient.ts`).  
All call-sites that manually constructed a Supabase client are refactored to use the shared helper, and validation logic in `env.ts` is updated accordingly.  
README files and `.env.example` are aligned with the new contract.

## Tour of changes
Start with the **new shared client helper** (`src/Shared/Infrastructure/Storage/Supabase/serviceClient.ts`).  
It is the core of the refactor: everything else (deleted client, updated handlers, changed env validation) flows from introducing this module.

## File level review

### `.env.example`
* Adds clarifying comment that `NEXT_PUBLIC_SUPABASE_ANON_KEY` is *not* the service-role key.
* Removes `NEXT_PUBLIC_SUPABASE_URL`.
  * ✅  Doc change only – consistent with code.

### `README.md`
* Table rows updated to reflect the removal of `NEXT_PUBLIC_SUPABASE_URL`.
* Wording emphasises that the anon key must never be used server-side.
  * ✅  Correct and welcome clarification.

### `src/ApifyPipeline/ExternalServices/Supabase/client.ts`
* File now re-exports the shared helper/type instead of owning its own implementation.
* ➕  Eliminates duplicate implementation.
* ❓  Consider deleting this file entirely and fixing imports; re-export keeps BC but adds indirection.

### `src/Shared/Infrastructure/Storage/Supabase/serviceClient.ts` (NEW)
```ts
export const createSupabaseServiceClient = (...)
```
* Central, reusable factory for *service-role* Supabase clients.
* Re-uses `getSupabaseEnv` for validation.
* Disables session persistence & token refresh – correct for server-to-server usage.
* Adds `X-Client-Info` custom header.
* ⚠️  Types are still `any`; if the project has generated types (`Database`), pass them (`createClient<Database>()`) to regain type-safety.
* ⚠️  Header value is hard-coded to `apify-pipeline-ingestion`; handlers in `RssPipeline` now reuse it. Consider something generic (e.g., `shared-service-client`) or accept an optional override.

### `src/ApifyPipeline/Infrastructure/Config/env.ts`
* Optional schema: `NEXT_PUBLIC_SUPABASE_URL` is deleted; inline comment added.
* `getSupabaseClientEnv`
  * Drops requirement for `NEXT_PUBLIC_SUPABASE_URL`; instead pulls `supabaseUrl` from `getSupabaseEnv`.
  * Throws if `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing.
* ⚠️  Exposure in browser: `SUPABASE_URL` **is not** exposed to client bundles in Next.js by default.  
  If `getSupabaseClientEnv` is ever used on client side, this will fail at runtime. The comment says "future use", so OK for now, but document clearly.
* ✅  Error messaging kept accurate.

### `src/ApifyPipeline/README.md`
* Mirrors env var change; no code impact.

### `src/RssPipeline/Web/Application/Commands/GenerateSummaries/GenerateSummariesCommandHandler.ts`
### `src/RssPipeline/Web/Application/Commands/SyncEntries/SyncEntriesCommandHandler.ts`
* Replace manual client construction with `createSupabaseServiceClient()`.
  * Removes duplicated env checks.
  * ✅  Simplifies code and avoids typo risk.
* Make sure the shared helper is tree-shakeable; otherwise unused code from ApifyPipeline might be bundled.

### `src/RssPipeline/Web/Application/Commands/GenerateSummaries/README.md`
* Updates sample env list (`SUPABASE_URL` instead of `NEXT_PUBLIC_SUPABASE_URL`).

## Additional observations / recommendations
1. **Search for orphaned references**  
   Ensure no other files still reference `NEXT_PUBLIC_SUPABASE_URL`; otherwise runtime failures will surface.

2. **Client-side usage**  
   If a browser layer eventually needs the public URL, you must either:
   • Re-introduce `NEXT_PUBLIC_SUPABASE_URL`, or  
   • Expose `SUPABASE_URL` through `NEXT_PUBLIC_` prefix during Next.js build (env passthrough) – document this.

3. **Type Safety**  
   Switch from `any` to your generated `Database` types in the shared client to regain compile-time checks.

4. **Header value configurability**  
   Consider making `X-Client-Info` an optional parameter so each caller can identify itself.

5. **Dead wrapper file**  
   The re-export file in `ApifyPipeline/ExternalServices/Supabase` can probably be removed in the next major revision; add a TODO to avoid long-term duplication.

Overall, the refactor consolidates Supabase usage, removes redundant env variables, and improves documentation – 👍.