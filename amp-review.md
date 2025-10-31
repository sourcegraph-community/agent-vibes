## High-level summary
The change set completely removes support for talking to an external Miniflux instance and makes the “in-house” RSS implementation the single, hard-wired path.  
Key themes:

* Environment / configuration clean-up (no more `MINIFLUX_MODE`, no need for external URL / API key, `.env.example` updated).
* Miniflux client drastically simplified – all HTTP code deleted, only the in-house code path remains.
* Feed source configuration is now driven by one or more OPML files checked into the repo (currently only `product-updates.opml`).  The large, catch-all `miniflux-feeds.opml` file was deleted and a smaller, topical OPML file added.
* Scripts/tests updated to the new expectations (no `MINIFLUX_MODE`, no `INHOUSE_RSS_FEEDS` env variable).
* README, `.gitignore` and misc clean-ups.

## Tour of changes
Start with `src/RssPipeline/ExternalServices/Miniflux/client.ts`.  
This file embodies the fundamental architectural change: everything related to external HTTP Miniflux is gone, and all other changes in the diff are ripple effects (env vars, OPML handling, tests, docs).

## File level review

### `.env.example`
* `MINIFLUX_MODE` removed.  
  ✔️ Correct given single-mode design.
* Consider adding a comment clarifying that OPML paths are hard-coded in code (`inhouse.ts`) so users aren’t left guessing where to configure feeds.

### `.gitignore`
* Added `plan/`. Harmless.

### `scripts/dry-run-inhouse-rss.ts`
* Now supports an array of OPML paths instead of a single path and stops mutating `MINIFLUX_MODE` / `INHOUSE_RSS_FEEDS`.
* Suggestion: accept paths via CLI arg or env to avoid code edits when someone wants to test a different OPML.

### `src/RssPipeline/Data/miniflux-feeds.opml` (deleted)
* Big feed list removed. If it’s still useful, keep it under `archive/` or docs rather than full deletion.

### `src/RssPipeline/Data/product-updates.opml` (new)
* Focused OPML that matches the hard-coded category `product_updates`.
* ✅ XML well-formed.

### `src/RssPipeline/ExternalServices/Miniflux/client.ts`
* External‐only code (HTTP, retries, timeout, auth) stripped.
* `MinifluxConfig` and ctor parameters removed; `MinifluxClient` now has no state.
* `makeRequest` and `markEntryAsRead` deleted.
* `getEntries` simply delegates to `inhouse.getEntries` and wraps errors.
* `createMinifluxClient` is now a one-liner.
#### Review comments
1. Type safety: `new MinifluxClient()` compiles because there is no constructor; fine, but document that `MinifluxClient` is stateless.
2. The exported public shape changed; any downstream code that previously imported `MinifluxConfig` or called `markEntryAsRead` will break.  Search/compile before merge.
3. The file retained the extensive interface declarations (`MinifluxEntry`, etc.); good for consumers but double-check unreachable types (e.g., error codes for HTTP that no longer exist).

### `src/RssPipeline/ExternalServices/Miniflux/inhouse.ts`
* Introduces hard-coded `OPML_PATHS`.
* `parseFeedsEnv` renamed behaviour: no longer uses env JSON; instead parses all OPML files.
* Better error messages if no feeds found.
#### Review comments
1. Path robustness: `join(__dirname, '../../../Data/product-updates.opml')` depends on being executed from `dist/.../inhouse.js` after compilation.  For Jest/ts-node runs the file path is `src/RssPipeline/ExternalServices/Miniflux`, so the relative depth looks correct (three levels up).  Still, add a helper to resolve project root to avoid fragile `../../../`.
2. Extensibility: users must modify code to add feeds.  Expose an env such as `INHOUSE_OPML_PATHS` or read `plan/` directory to avoid source changes.
3. Concurrency / timeout envs continue to work. 👍
4. Consider caching parsed OPML results between calls to avoid re-reading files for every request.

### `src/RssPipeline/README.md`
* Docs now accurately describe single-mode architecture.
* Example env section still mentions “provide a single-line JSON array of feed configs” which no longer does anything. Remove or rephrase.

### `src/RssPipeline/__tests__/inhouse-dry-run.test.ts`
* Removes now-obsolete env setup of `MINIFLUX_MODE` and `INHOUSE_RSS_FEEDS`.  
* The test indirectly relies on the hard-coded OPML to provide feeds; if the OPML ever empties the test will start failing.  For hermetic tests prefer injecting mock feeds (e.g., via dependency injection or overriding `OPML_PATHS`).

## Overall assessment
The simplification eliminates a lot of complexity and dependency on an external service, which is great, but the new configuration mechanism is rigid.  I recommend:

1. Make OPML paths configurable (CLI arg, env, or config file) to avoid code edits.
2. Audit the codebase for dead references (`MinifluxConfig`, `markEntryAsRead`, HTTP error codes).
3. Ensure documentation & environment examples no longer mention the JSON feed env var.
4. Add a unit test covering the new OPML parsing path explicitly (mock file system) so future refactors don’t silently break feed discovery.

With these tweaks the patch should be safe to merge.