## High-level summary
The patch is almost entirely about redefining what the `limit` request parameter means for the “in-house” Miniflux adapter:

* `limit` now caps **each feed individually** instead of capping the **global result set**.
* Console messages and tests were renamed/updated to communicate this new meaning.
* The core implementation (`src/RssPipeline/ExternalServices/Miniflux/inhouse.ts`) was rewritten to
  * perform per-feed filtering, ordering and limiting before aggregating,
  * drop the final global `limit` slice (but still honours `offset`),
  * expose some derived variables (`perFeedLimit`, `publishedAfterMs`, `direction`) up-front,
  * change one relative path to the OPML file.

A new unit test asserts that no feed contributes more than the per-feed cap.

## Tour of changes
Start with  
`src/RssPipeline/ExternalServices/Miniflux/inhouse.ts`  
because this file contains the behavioural change; every other diff merely surfaces that change in logs or tests.

## File level review

### `scripts/dry-run-inhouse-rss.ts`
Changes
* Rewording log lines (“Per-feed limit”) and printing the theoretical maximum (`feeds.length * limit`).

Review
* ✅  Harmless cosmetic change.
* 💡  Consider printing the *actual* number fetched after the run; that is more actionable than the theoretical maximum.

### `scripts/sync-rss-entries.ts`
Changes
* Same wording tweak for clarity.

Review
* ✅  Trivial.

### `src/RssPipeline/ExternalServices/Miniflux/inhouse.ts`
Changes
1. `OPML_PATHS`
   * Went from `../../../Data/...` to `../../Data/...`.

   Review  
   * ⚠️  This new relative path climbs only two levels (`Miniflux → ExternalServices → RssPipeline`) whereas the old path climbed three (landing at `src`).  
     Unless a `Data` directory exists under `src/RssPipeline`, this will break at runtime. Verify the intended location or use `path.resolve(projectRoot, 'src/Data/...')` to avoid fragile relative hops.

2. Variable extraction
   ```ts
   const perFeedLimit = params.limit ?? 50;
   const publishedAfterMs = params.published_after ? new Date(params.published_after).getTime() : NaN;
   const direction = (params.direction ?? 'desc') as 'asc' | 'desc';
   ```
   Review  
   * ✅  Clear and DRY.
   * ❓  Should validate that `perFeedLimit` is not negative.

3. Main loop
   * Maps each feed’s items to `MinifluxEntry`s, then:
     * Filters by `published_after` **per feed**.
     * Sorts each feed’s items DESC by publication for “fairness”.
     * Pushes up to `perFeedLimit` items per feed.
   * Aggregates all feeds into one `items` array.

   Review  
   * ✅  Achieves the stated fairness goal.
   * ⚠️  The planned “fairness” is only as good as the initial per-feed DESC sort; if `direction` is `'asc'`, early capping still keeps the *newest* `perFeedLimit` entries, not the oldest, which might surprise users requesting ascending order.  
     Fix: compute `perFeed.sort()` according to `direction` before slicing.
   * ⚠️  Performance: for large feeds we now parse every item, then sort, then slice. Consider short-circuiting once `perFeedLimit` is met (e.g. via partial sort) to reduce memory/time.

4. Global ordering & slicing
   ```ts
   items.sort(...);
   if (direction === 'desc') items.reverse();

   const total = items.length;
   const offset = params.offset ?? 0;
   const entries = offset > 0 ? items.slice(offset) : items;
   ```
   Review  
   * 🐛  `limit` is **no longer applied globally**, so `entries` can be unbounded (minus offset).  
     This breaks callers that expect a bounded list and exposes the system to accidental OOMs.
   * ❓  If `offset` is provided, ignoring `limit` is inconsistent with Miniflux behaviour.  
     Recommended fix:
     ```ts
     const globalLimit = params.global_limit ?? params.limit ?? 50; // or keep old semantics
     const entries = items.slice(offset, offset + globalLimit);
     ```
   * ⚠️  You sort ascending then possibly reverse; simpler: sort based on multiplier `(direction === 'asc' ? 1 : -1)`.

5. Return signature unchanged—callers might misinterpret the new semantics.

Security / correctness
* No direct security issues.
* OOM risk if many feeds × many items.
* Potential logic error with `direction === 'asc'` (see above).

### `src/RssPipeline/__tests__/inhouse-dry-run.test.ts`
Changes
* Adjusted description.
* Instead of asserting `entries.length ≤ 3`, the test now asserts no single feed exceeds `perFeed`.

Review
* ✅  Reflects new semantics.
* 🐞  The test no longer fails if the overall size explodes (see OOM risk). Add an assertion on `entries.length` or configure a `globalLimit` to keep the response bounded.

## Recommendations
1. Verify and fix the new OPML path.
2. Re-introduce a global cap (maybe a new param) to prevent unbounded result sets.
3. Respect `direction` when selecting the “top N” per feed.
4. Validate `limit`, `offset`, and `published_after` inputs; reject negatives and invalid dates early.
5. Extend unit tests:
   * Assert overall `entries.length` is reasonable.
   * Cover the `direction: 'asc'` branch.
6. Consider renaming parameters (`per_feed_limit`, `global_limit`) to avoid ambiguity for API consumers.

With these adjustments the feature will be safer and less surprising to downstream callers.