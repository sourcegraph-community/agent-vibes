## High-level summary
The diff refactors how tweets are fetched in the *social-sentiment* API endpoint:

1.  A new `DashboardRepository.getTweetsByPostedWindow()` method encapsulates the SQL logic that used to live in `route.ts`.
2.  The route now:
    • converts incoming keywords to lower-case,  
    • relies on the repository for data,  
    • tweaks day-bucketing and response‐shape (`generatedAt`, `product` in summary).
3.  Miscellaneous clean-ups: UTC-safe date start, hard cap logic, camel-cased DTOs.

Overall the change is an extraction of query logic plus some relatively small functional tweaks in the endpoint.

## Tour of changes
Begin with the **new repository method** (`DashboardRepository.ts`) because:
* It contains the full SQL/filters logic that drives all subsequent behaviour.
* Understanding its return shape (camel-cased) is necessary before reviewing the mapping and grouping that follows in `route.ts`.

Once comfortable with the repository, review `route.ts` to see how the data are post-processed and serialized.

## File level review

### `src/ApifyPipeline/DataAccess/Repositories/DashboardRepository.ts`

**What changed**
* Added the alias type `TweetWithSentiment`.
* Added `getTweetsByPostedWindow()`, essentially moving the old inline Supabase query from the route to the repository.

**Correctness / bugs**
1. Case-sensitivity
   ```ts
   const normalizedKeywords = filters.keywords.map((k) => k.toLowerCase());
   query = query.overlaps('keyword_snapshot', normalizedKeywords);
   ```
   `keyword_snapshot` in Postgres is a `text[]`. The `overlaps` operator is case-sensitive, so down-casing only the filter list will fail to match records whose snapshot values contain upper-case letters.  
   Recommendation: convert both sides (`lower(keyword_snapshot)`) or store snapshots already lower-cased.

2. Latest-sentiment logic
   Same as before: order by `processed_at` desc and `limit(1)` on the FK table. OK.

3. Error handling
   The method throws on Supabase error. That is fine, but callers must catch.

**Performance / efficiency**
* Adds `.order('posted_at', { ascending: false })` **after** the sub-select/limit on the FK table. That yields exactly the same plan as before.
* `limit(filters.limit ?? 1000)` is unchanged.

**Security**
* No SQL injection risk—parameters are passed through Supabase query builder.

**Minor style**
* Could keep the existing `TweetDetail` instead of the alias; harmless.

### `app/api/social-sentiment/tweets/route.ts`

**What changed**
* Imports the new repository and removes the raw Supabase query.
* Normalises keywords to lower-case up-front.
* Uses `setUTCHours(0,0,0,0)` instead of local time; nice fix.
* Builds `dayKey` once in `toTweet`.
* Limits the number of day buckets with `.slice(0, days)`.
* Adds `product` and `generatedAt` to the empty-result response.

**Correctness / bugs**
1.  Unhandled repository errors  
    The previous code returned `NextResponse.json(...)` with HTTP 500 on query error.  
    Now `getTweetsByPostedWindow()` throws; there is no `try/catch`, so Next.js will bubble an unformatted 500 (HTML) instead of the expected JSON envelope. Wrap the call in `try/catch` and keep the previous behaviour.

2.  Case-lowering issue mirrors the repository (see above).

3.  Response schema drift  
    When `productKeywords.length === 0` the summary footer gained `product` & `generatedAt`, but when **keywords exist** the code later still builds
    ```ts
    summary: { days, total: 0 }
    ```
    (unchanged in diff, not shown). Ensure both branches return the same shape.

4.  Type mismatch risk  
    `toTweet` expects row keys in camelCase (`authorHandle`, …) which the repository does provide, but if another caller returns snake_case this would now break at compile time. Acceptable because TS will catch.

5.  Sorting logic  
    `b.localeCompare(a)` is fine. `slice(0, days)` guarantees we never exceed requested days (previously we might).

**Performance / efficiency**
* Delegating query to repository keeps the hard cap; no regression.

### General observations
* Good separation of concerns—route gets thinner.
* Unit tests that previously stubbed `supabase.from(... )` will need updating to stub the repository instead.
* Consider documenting that all keywords should be stored lower-case in the DB to avoid the overlap mismatch highlighted above.

## Recommendations
1. Add `try/catch` around `repo.getTweetsByPostedWindow()` and return a JSON 500 payload as before.
2. Fix case-sensitive keyword overlap: either convert `keyword_snapshot` in the query (`where raw(lower(keyword_snapshot) && ?)`) or persist them lower-case.
3. Align response shape for BOTH branches (`summary.product`, `generatedAt`).
4. Add unit/integration tests for the repository method (filters, limits, keyword overlap).