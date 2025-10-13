# In‑House Miniflux Replacement (TypeScript) — Implementation Plan

Audience: junior developer hand‑off. Goal: replace external Miniflux dependency with an in‑house module that provides the minimal functionality our codebase currently uses, without changing public APIs in our app.

Reference: https://github.com/miniflux/v2

## Objectives

- Preserve existing app behavior and endpoints (no UI changes).
- Keep `sync` → Supabase → `summarize` pipeline intact.
- Replace calls to external Miniflux with an internal aggregator that fetches configured RSS feeds and returns the same data shape our code expects.
- Keep changes small, vertical-slice friendly, and easy to revert if needed.

## Current Usage Summary (What we must replicate)

- "Miniflux" client used only to read entries, optionally filter by time/status, and limit/order results.
  - Source: `src/MiniFlux/client.ts`
  - Consumers write normalized entries into Supabase in `sync` command:
    - `src/RssPipeline/Web/Application/Commands/SyncEntries/SyncEntriesCommandHandler.ts`
- Dashboard reads from Supabase via `/api/rss/entries` — no direct Miniflux calls.

Minimal surface to implement:
- `getEntries(params)` — return `{ total, entries[] }` with fields we use:
  - entry: `id`, `feed_id`, `title`, `url`, `author`, `content`, `published_at`, `feed.title`, optional `feed.category.title`
- Optional: `markEntryAsRead(entryId)` — currently unused; can be a no‑op stub.

## Non‑Goals (Phase 1)

- Feed CRUD, OPML import/export, Fever/Google Reader APIs, webhooks, icon fetching, scrape/readability rules.
- Full Miniflux parity.

## Architecture (MVP)

- Keep the existing import path and class name to avoid churn: reuse `MinifluxClient` but implement an "in‑house" mode.
- Add a small aggregator that:
  1) Fetches a configured set of RSS/Atom/JSON feeds concurrently
  2) Parses and normalizes entries into our `MinifluxEntry` shape
  3) Applies simple filters (published_after, limit, order, category)
  4) Returns `{ total, entries }`

### Directory and Files

- Reuse existing ExternalServices slice:
  - `src/MiniFlux/client.ts` (switchable between external and in‑house)
  - New: `src/MiniFlux/inhouse.ts` (aggregator implementation)
  - New: `src/MiniFlux/types.ts` (shared types if needed)

## Configuration

Add env vars (document in `.env.example`):

- `MINIFLUX_MODE=inhouse | external` (default `external` for backward compatibility)
- `INHOUSE_RSS_FEEDS` — JSON array of feed configs, example:
  ```json
  [
    { "url": "https://example.com/changelog.xml", "title": "Example Changelog", "category": "product_updates" },
    { "url": "https://arxiv.org/rss/cs.AI", "title": "arXiv AI", "category": "industry_research" },
    { "url": "https://blog.example.dev/rss", "title": "Example Blog", "category": "perspectives" }
  ]
  ```
- Optional tuning:
  - `INHOUSE_RSS_TIMEOUT_MS=20000`
  - `INHOUSE_RSS_MAX_CONCURRENCY=5`

Note: Existing `MINIFLUX_URL`/`MINIFLUX_API_KEY` will be ignored in `inhouse` mode (kept for compatibility in `external` mode).

## Data Model and Mapping

- Feed identity: `feed_id = stable hash(feed URL)` (e.g., hex of SHA1/MD5; deterministic)
- Entry identity: `id = stable hash(guid || link || (title + published + feedUrl))`
- Fields mapping per entry:
  - `title` ← feed item title
  - `url` ← link
  - `author` ← author/creator if available
  - `content` ← prefer `content:encoded` → `content` → `summary` (raw HTML OK; we already sanitize via `stripHtml` downstream)
  - `published_at` ← ISO string; fallback to current date if missing
  - `feed.title` ← configured feed title or channel title
  - `feed.category.title` ← configured `category` string mapped to dashboard categories (`product_updates | industry_research | perspectives | uncategorized`)
  - `starred` ← false (MVP)
  - `reading_time` ← null/0 (MVP)

## API Contract (as used by our code)

- Function: `getEntries(params?: { limit?, offset?, status?, starred?, published_after?, order?, direction?, category_id? })`
  - Implemented filters (MVP):
    - `limit`, `offset`,
    - `published_after` (ISO),
    - `order=published_at`, `direction=asc|desc`,
    - ignore `status`, `starred`, `category_id` (not used by our sync handler); safe to accept and no‑op
- Return: `{ total: number; entries: MinifluxEntry[] }`
- Error behavior: mirror current client classification (timeout, server error, rate limit) and retry up to N for transient errors.

## Implementation Steps

1) Add dependency for feed parsing
- Choose one: `rss-parser` (simple) or `fast-xml-parser` + light normalizer.
- MVP recommendation: `rss-parser` (good defaults, handles RSS/Atom; we can extend later).
- Add to `package.json` and install.

2) Create aggregator
- File: `src/MiniFlux/inhouse.ts`
- Responsibilities:
  - Load `INHOUSE_RSS_FEEDS` (throw if missing or invalid JSON)
  - Fetch feeds concurrently (bounded by `INHOUSE_RSS_MAX_CONCURRENCY`)
  - Parse each feed into items
  - Normalize items to `MinifluxEntry`
  - Merge items from all feeds and apply filters:
    - `published_after`: keep items with `published_at >=` value
    - Sort by `published_at` then apply `direction`
    - Apply `offset` and `limit`
  - Return `{ total, entries }`

3) Wire `MinifluxClient` switch
- File: `src/MiniFlux/client.ts`
- Add `MINIFLUX_MODE` switch in `createMinifluxClient()`:
  - If `inhouse`, instantiate a client that delegates `getEntries` to `inhouse.ts`
  - Keep existing external implementation intact for `external` (no changes to consumers)
- Relax env checks in `inhouse` mode (don’t require `MINIFLUX_URL`/`MINIFLUX_API_KEY`).
- Keep `markEntryAsRead()` as a no‑op, return `{ success: true }`.

4) Deterministic IDs
- Implement small util in `inhouse.ts`:
  - `hashToId(input: string): number` — produce a 53‑bit safe integer or use a hex string and store as number via modulo. Deterministic across runs.
  - Use `guid`/`id`/`link`/`title+date+feedUrl` fallback to build `entry.id`.

5) Env and docs
- Update `.env.example` with new vars and example `INHOUSE_RSS_FEEDS`.
- Add a short note at the top of `docs/miniflux-integration.md` about `MINIFLUX_MODE=inhouse` option.

6) Tests
- Unit (Vitest):
  - Feed normalization: given sample RSS XML, map to `MinifluxEntry` correctly.
  - Sorting/filtering logic.
  - Deterministic ID generation.
- Integration:
  - `sync-rss-entries.ts` with `MINIFLUX_MODE=inhouse` inserts rows into Supabase.
- e2e smoke:
  - Run `/api/rss/sync` (dry run) and verify success payload; `/api/rss/entries` returns data.

7) Operational checklist
- Cron: keep existing schedules (vercel.json) — no changes.
- Observability: log counts and failure reasons in sync handler (already present).
- Rollback: set `MINIFLUX_MODE=external` to revert to original behavior.

## Pseudocode / Snippets

inhouse.ts (sketch)

```ts
// src/MiniFlux/inhouse.ts
import Parser from 'rss-parser';

export interface InhouseFeed {
  url: string;
  title?: string;
  category?: 'product_updates' | 'industry_research' | 'perspectives' | 'uncategorized';
}

const parser = new Parser({ timeout: Number(process.env.INHOUSE_RSS_TIMEOUT_MS ?? 20000) });

function hashNum(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export async function getEntries(params: {
  limit?: number; offset?: number; published_after?: string; order?: 'published_at'; direction?: 'asc' | 'desc';
} = {}) {
  const feeds: InhouseFeed[] = JSON.parse(process.env.INHOUSE_RSS_FEEDS ?? '[]');
  if (!Array.isArray(feeds) || feeds.length === 0) throw new Error('INHOUSE_RSS_FEEDS is empty or invalid');

  const results = await Promise.allSettled(
    feeds.map(async (f) => ({ feed: f, data: await parser.parseURL(f.url) }))
  );

  const items = [] as Array<any>;
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { feed, data } = r.value;
    for (const item of data.items ?? []) {
      const link = item.link ?? '';
      const guid = item.guid ?? link;
      const published = item.isoDate ?? item.pubDate ?? new Date().toISOString();
      items.push({
        id: hashNum(`${guid}|${link}|${published}|${feed.url}`),
        user_id: 0,
        feed_id: hashNum(feed.url),
        title: item.title ?? '(untitled)',
        url: link,
        author: item.creator ?? item.author ?? null,
        content: (item['content:encoded'] ?? item.content ?? item.summary ?? '') as string,
        hash: '',
        published_at: new Date(published).toISOString(),
        created_at: new Date().toISOString(),
        status: 'unread',
        starred: false,
        reading_time: 0,
        feed: {
          id: hashNum(feed.url),
          title: feed.title ?? data.title ?? new URL(feed.url).host,
          category: feed.category ? { id: hashNum(feed.category), title: feed.category } : undefined,
        },
      });
    }
  }

  let list = items;
  if (params.published_after) list = list.filter(i => i.published_at >= params.published_after!);
  list.sort((a, b) => a.published_at.localeCompare(b.published_at));
  if ((params.direction ?? 'desc') === 'desc') list.reverse();

  const total = list.length;
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;
  const entries = list.slice(offset, offset + limit);
  return { total, entries };
}
```

client.ts switch (sketch)

```ts
// src/MiniFlux/client.ts
import * as inhouse from './inhouse';

export class MinifluxClient {
  async getEntries(params?: GetEntriesParams) {
    if ((process.env.MINIFLUX_MODE ?? 'external') === 'inhouse') {
      try {
        const data = await inhouse.getEntries(params);
        return { success: true, data };
      } catch (e) {
        return { success: false, error: { code: 'API_ERROR', message: String(e), retryable: false } };
      }
    }
    // existing external codepath (unchanged)
  }

  async markEntryAsRead(_entryId: number) {
    if ((process.env.MINIFLUX_MODE ?? 'external') === 'inhouse') {
      return { success: true };
    }
    // external path
  }
}
```

For real implementations, use the librarian tool to fetch the relevant task per code chunk.

## QA / Acceptance

- With `MINIFLUX_MODE=inhouse` and `INHOUSE_RSS_FEEDS` set:
  - `npm run apply-rss-migrations` succeeds
  - `npm run sync-rss-entries` reports synced > 0 or cleanly skips duplicates
  - `GET /api/rss/entries?category=product_updates&limit=5` returns 200 with items
  - Dashboard `/dashboard-v2` shows sections populated

## Risks and Mitigations

- Parsing variance (some feeds odd formats): start with a small set; expand rules incrementally.
- Deterministic IDs: ensure stable across runs; include feed URL and guid/link.
- Timezones: always normalize to ISO strings via `new Date(...).toISOString()`.
- Performance: bound concurrency; limit feed count; consider caching later.

## Rollout Plan

1) Land code behind `MINIFLUX_MODE` flag (default remains `external`).
2) Stage with `inhouse` in a preview environment; run `sync-rss-entries` once.
3) Verify dashboard and `/api/rss/entries` responses.
4) Flip production env to `MINIFLUX_MODE=inhouse`.
5) Monitor logs/health.

## Task Checklist

- [ ] Add `rss-parser` dependency
- [ ] Implement `inhouse.ts` aggregator
- [ ] Add `MINIFLUX_MODE` switch in `client.ts`
- [ ] Update `.env.example` and `docs/miniflux-integration.md` header note
- [ ] Add unit tests for mapping/sorting
- [ ] Run `npm run check` and fix any lint/type issues
- [ ] Dry run `npm run sync-rss-entries`
- [ ] Verify `/api/rss/entries` and dashboard

---

If scope expands later, next features to consider: ETag/Last‑Modified caching per feed, favicon/icon cache, per‑feed category overrides, and content readability extraction.
