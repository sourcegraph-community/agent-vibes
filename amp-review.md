## High-level summary
The patch introduces a dual-API for triggering Apify actors:

1. `startApifyActorRunRaw()` – new low-level helper that sends the request payload **exactly as provided** (no `input` wrapper) and moves the `build` specifier to a query-string parameter.
2. `startApifyActorRun()` – now a thin wrapper around the new raw helper to preserve the original higher-level API.
3. `StartApifyRunEndpoint` – detects “tweet-scraper style” requests and, if matched, bypasses the command handler and invokes `startApifyActorRunRaw()` directly.

## Tour of changes
Begin with `src/ApifyPipeline/ExternalServices/Apify/client.ts`.  
That file contains the semantic change (switch to raw body, query-param build, new helper, old helper turned into wrapper).  
Once understood, the modifications in `StartApifyRunEndpoint.ts` make sense—they simply decide *when* to call the new helper.

## File level review

### `src/ApifyPipeline/ExternalServices/Apify/client.ts`

Changes
• Renamed the original function to `startApifyActorRunRaw` (signature now takes `rawInput: Record<string, unknown>`).  
• Request body changed from  
  `{ input, build }` ➜ `rawInput` (plain, no wrapper).  
• `build` moved to `?build=` query string.  
• Added a thin wrapper `startApifyActorRun()` that type-casts and delegates to the raw version.

Review
1. **API contract with Apify**  
   The official Apify REST docs expect the JSON body to look like
   `{ "input": { … }, "build": "latest", … }`.  
   Moving the payload to the root may break all actors that expect the documented contract unless `Content-Type: application/json; charset=utf-8` combined with the absence of the wrapper is explicitly supported. Confirm with Apify – this is the most critical risk.

2. **Loss of optional fields**  
   In the previous design the caller could pass `timeout`, `memory`, `build`, etc. through the body.  The new helper only allows whatever the raw input contains.  
   • `timeoutSecs` and `memoryMbytes` can still be supplied via query parameters (`timeout`, `memory`), but callers must know to do so.  
   • The wrapper (`startApifyActorRun`) now silently drops `build` unless the env var is set, altering behaviour.

3. **Behavioral change for existing callers**  
   Previous callers of `startApifyActorRun()` supplied their domain-specific `input` shape; that still works because of the cast, but will now be sent *without* the `input` wrapper. That is (again) incompatible with the documented API unless the raw format is indeed supported.

4. **Type-safety loss**  
   `as unknown as Record<string, unknown>` removes compile-time guarantees. It’s now possible to call the wrapper with `undefined` or a string and only fail at runtime.

5. **Security** – Acceptable.  We already validated `options.dryRun`, encode the actor id, and pass the token via query string (existing behaviour).  No new attack surface.

6. **Efficiency** – unchanged; one extra wrapper call is trivial.

7. **Nitpick** – Since both helpers live in the same module, consider re-export order: expose the *public* function first, keep the raw one prefixed with “internal” comment to discourage misuse.

### `src/ApifyPipeline/Web/Application/Commands/StartApifyRun/StartApifyRunEndpoint.ts`

Changes
• Imported `startApifyActorRunRaw`.  
• Added `looksLikeTweetScraperRaw()` heuristic to detect tweet-scraper payloads.  
• Stores the raw JSON (`rawBody`) before casting to the command’s shape.  
• If heuristic matches, skips the CQRS command and calls the raw helper directly.

Review
1. **Heuristic stability / false positives**  
   The predicate checks for five optional fields.  
   • False positives: any future command whose payload includes `maxItems`, `sort`, etc. will unexpectedly bypass validation/authorization logic.  
   • False negatives: a minimal tweet-scraper request (e.g. only `"proxyConfiguration":{…}`) will fall through and be wrapped incorrectly, likely failing at the actor.

   Suggestion: require an explicit `actor: "tweet-scraper"` flag, or look at the request path (if the endpoint supports ?actor= tweet-scraper).

2. **Missing options propagation**  
   The call `startApifyActorRunRaw(rawBody)` omits the `options` bag (e.g. `dryRun`). Endpoint currently never sets those, but future features might—pass through for consistency.

3. **Bypassing command validation**  
   Skipping `startApifyRunCommandHandler` means:  
   • No `triggerSource` enrichment  
   • No authentication / authorization that the handler might perform  
   • No logging / metrics tied to the command bus  

   Ensure you are comfortable with that trade-off or replicate the relevant checks before the early return.

4. **Type assertion**  
   `rawBody as Record<string, unknown>` is unchecked. If `rawBody` is e.g. a number (malformed JSON), the call will succeed until Apify rejects it. Add runtime guard (e.g. `typeof rawBody === 'object' && rawBody !== null`).

5. **Cache headers** – unchanged; fine.

6. **Error path consistency**  
   Errors from `startApifyActorRunRaw` propagate and are converted in the catch block of the outer `try`. That maintains existing semantics.

### ❓ Other affected files
No other files modified.

## Recommendations
1. Double-check Apify REST API compatibility before merging—the switch to raw body is the single biggest risk.
2. Formalize the selection logic (“raw vs wrapped”). Replace heuristics with an explicit parameter or header.
3. Re-introduce lost validation/authorization or make it clear that the new path is *intentionally* unauthenticated.
4. Preserve option propagation (`dryRun`, etc.) to the raw helper.
5. Add runtime type guard for `rawInput` inside `startApifyActorRunRaw`, returning a descriptive error early.
6. Document public vs. internal helpers to avoid confusion for future contributors.