## High-level summary
Two files were modified:

1. **scripts/start-apify-run.ts**  
   • Re-structured keyword-resolution logic.  
   • Adds a two–step fallback when a `COLLECTOR_PRODUCT` is present (first try product-specific keywords, then all keywords).  
   • When the DB query throws, the script now *re-throws* instead of silently falling back to static defaults, after logging a detailed error.  

2. **KeywordsRepository.ts**  
   • Changes the Supabase filter from a case-sensitive equality (`eq`) to a case-insensitive match (`ilike`) for the `product` column.

## Tour of changes
Start the review in **scripts/start-apify-run.ts**.  
All downstream behaviour (including the need for a case-insensitive query) is driven by the way this function now attempts, retries and fails. Understanding this restructuring clarifies why `KeywordsRepository.ts` was updated.

## File level review

### `scripts/start-apify-run.ts`

What changed
------------
1. Replaced one Supabase query with a small decision tree:
   • If `COLLECTOR_PRODUCT` is set  
     – Try `fetchEnabledKeywordsByProduct`.  
     – If no rows, fall back to all enabled keywords.  
   • If `COLLECTOR_PRODUCT` is unset  
     – Fetch all enabled keywords.  

2. Error handling  
   • Used to swallow all DB errors and keep running with static defaults.  
   • Now logs (`console.error`) and **re-throws** the error; static defaults are *not* used in this scenario.

Correctness & bugs
------------------
• Functional improvement: the new “fallback to all keywords when product has none” removes an edge case where the crawler would run with the *static* default list even though the DB is reachable.

• Possible **breaking change**: by re-throwing, any connectivity problem, Supabase outage or auth error will now crash the process instead of running with defaults.  
  – Verify that the calling environment (CI pipeline? lambda? docker entrypoint?) is prepared for this stop-the-world behaviour.  
  – If partial availability is desirable, consider restoring the previous swallow-and-default strategy or making it configurable (e.g. `FAIL_ON_DB_ERROR=true`).

• `toErrorMessage(err)` is used but not imported in this diff. Make sure it already exists in this file; otherwise build will fail.

• Minor style: inside the `else` branch we shadow `kws` (`const kws = ...`) while in the `if` branch it is a `let`. Shadowing is legal but slightly harder to read. Consider using a single `let kws` outside both branches.

Performance
-----------
• In the product path we sometimes execute two sequential DB queries (product-filtered then full list). A single query with `or` logic could cut latency by half, but the current approach is clear and acceptable.

Security
--------
• No additional attack surface. Logging the error body is fine as long as credentials are not embedded in the message (Supabase throws normally do not include secrets).

### `src/ApifyPipeline/DataAccess/Repositories/KeywordsRepository.ts`

What changed
------------
`eq('product', normalized)` → `ilike('product', normalized)`

Correctness & bugs
------------------
• `.ilike` is case-insensitive but still performs a *pattern match*. If `normalized` does **not** contain wildcards (`%`), behaviour equals a case-insensitive equality, which is probably what you want. If you actually intended substring matching, you must wrap the value (`%${normalized}%`).

• Supabase JS returns an error if the column is not of type `text`. Make sure `product` is `text`/`varchar` and not `enum('product')`. Otherwise Postgres may complain that `ilike` is not defined for that type.

• Indexes: changing to `ilike` disables any B-tree index on `product` unless the index is created with `LOWER(product)` or a `citext` column is used. If this table grows, query could become slower. Consider:
  – Converting column to `citext`, or  
  – Adding an index on `LOWER(product)` and querying with `.ilike(normalized.toLowerCase())`.

Security
--------
No additional risks.

### Other files (static defaults array at bottom of `start-apify-run.ts`)
No changes, but note that the array is now unreachable on DB failure because the error is thrown earlier. Confirm that this is intentional.

## Recommendation checklist
1. Decide if crashing on DB errors is acceptable or should be gated behind a feature flag.  
2. Confirm `toErrorMessage` import.  
3. Evaluate the need for `%` wildcards with `.ilike`.  
4. Assess performance / indexing impact of `ilike` on `product`.  
5. Optional: refactor variable shadowing for clarity.