# Apify Pipeline — Multi‑Product Extension (Data‑Only)

Scope: add product coverage (Windsurf, Augment, Cline, Kilo, OpenCode, etc.) by tagging keywords in DB and rolling up via new views. Collectors now default to sequential per‑product runs; sentiment processors unchanged.

—

## Acceptance
- Add `keywords.product` and supporting index.
- Add product rollup views based on `keyword_snapshot` → `keywords` join.
- Seed new product keywords (enabled) without breaking Amp.
- Default per‑product sequential collection (one run per product). Single‑product runs remain supported via `COLLECTOR_PRODUCT`.

—

## High‑Level Steps
1) DB migration: add `product` column to `keywords`, create index, create two views.
2) Seeds: append keyword rows per product.
3) Ops: default to sequential per‑product runs; single‑product invocation optional.
4) Validate: check views return rows per product.

—

## 1) Database Migration
Create a new migration under `src/ApifyPipeline/DataAccess/Migrations/` named `YYYYMMDD_HHMM_AddProductToKeywords.sql` with:

```sql
begin;

-- 1) Add product tag to keywords
alter table if exists public.keywords
  add column if not exists product text not null default 'amp';

-- 2) Index to help selection/batching
create index if not exists idx_keywords_enabled_product_priority
  on public.keywords (is_enabled, product, priority);

-- 3) Product daily sentiment (similar to vw_daily_sentiment, grouped by product)
create or replace view public.vw_product_daily_sentiment as
with kw as (
  select lower(trim(k.keyword)) as keyword,
         lower(trim(k.product)) as product
  from public.keywords k
),
kw_rows as (
  select
    nt.id as normalized_tweet_id,
    date_trunc('day', nt.posted_at) as sentiment_day,
    coalesce(nullif(nt.language, ''), 'unknown') as language,
    kw.product
  from public.normalized_tweets nt
  cross join lateral unnest(nt.keyword_snapshot) as raw_kw(keyword)
  join kw on kw.keyword = lower(trim(raw_kw.keyword))
),
sentiment as (
  select kr.sentiment_day, kr.language, kr.product,
         ts.sentiment_label as label,
         ts.sentiment_score as score
  from kw_rows kr
  left join public.tweet_sentiments ts on ts.normalized_tweet_id = kr.normalized_tweet_id
)
select
  sentiment_day,
  language,
  product,
  count(*) filter (where label = 'positive') as positive_count,
  count(*) filter (where label = 'neutral')  as neutral_count,
  count(*) filter (where label = 'negative') as negative_count,
  count(*) as total_count,
  avg(score) as avg_sentiment_score
from sentiment
where sentiment_day is not null and product is not null
group by sentiment_day, language, product
order by sentiment_day desc, language, product;

-- 4) Product trends (counts/avg by product and day)
create or replace view public.vw_product_trends as
with kw as (
  select lower(trim(k.keyword)) as keyword,
         lower(trim(k.product)) as product
  from public.keywords k
),
kw_rows as (
  select
    nt.id as normalized_tweet_id,
    date_trunc('day', nt.posted_at) as sentiment_day,
    kw.product
  from public.normalized_tweets nt
  cross join lateral unnest(nt.keyword_snapshot) as raw_kw(keyword)
  join kw on kw.keyword = lower(trim(raw_kw.keyword))
),
sentiment as (
  select kr.sentiment_day, kr.product,
         ts.sentiment_label as label,
         ts.sentiment_score as score
  from kw_rows kr
  left join public.tweet_sentiments ts on ts.normalized_tweet_id = kr.normalized_tweet_id
)
select
  sentiment_day,
  product,
  count(*) as mention_count,
  count(*) filter (where label = 'negative') as negative_count,
  avg(score) as avg_sentiment_score
from sentiment
where sentiment_day is not null and product is not null
group by sentiment_day, product
order by sentiment_day desc, product;

commit;
```

Notes:
- Existing keyword logic and ingestion are untouched.
- Views use `keyword_snapshot` → `keywords.keyword` mapping, so tweets matching multiple products contribute to each product.

—

## 2) Seed New Product Keywords
Append rows for each product to `src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql`. Keep priorities small numbers for most important keywords first.

Example additions:
```sql
-- Windsurf
insert into public.keywords (keyword, is_enabled, priority, source, note, product) values
  ('windsurf', true, 10, 'analytics', 'brand'),
  ('"windsurf ai"', true, 20, 'analytics', 'exact'),
  ('(to:windsurf)', true, 30, 'analytics', 'replies')
on conflict (keyword) do nothing;

-- Augment
insert into public.keywords (keyword, is_enabled, priority, source, note, product) values
  ('augment', true, 10, 'analytics', 'brand'),
  ('"augment ai"', true, 20, 'analytics', 'exact'),
  ('augment.dev', true, 30, 'analytics', 'domain'),
  ('(to:augment)', true, 40, 'analytics', 'replies'),
  ('#augment', true, 50, 'analytics', 'hashtag')
on conflict (keyword) do nothing;

-- Cline
insert into public.keywords (keyword, is_enabled, priority, source, note, product) values
  ('cline', true, 10, 'analytics', 'brand'),
  ('"cline ai"', true, 20, 'analytics', 'exact')
on conflict (keyword) do nothing;

-- Kilo
insert into public.keywords (keyword, is_enabled, priority, source, note, product) values
  ('kilo', true, 10, 'analytics', 'brand')
on conflict (keyword) do nothing;

-- OpenCode
insert into public.keywords (keyword, is_enabled, priority, source, note, product) values
  ('opencode', true, 10, 'analytics', 'brand')
on conflict (keyword) do nothing;
```

—

## 3) Operations (Run Strategy)
- Default: sequential per‑product runs when `COLLECTOR_PRODUCT` is omitted. Each run uses that product’s keywords with its own `maxItems` cap (default 100).
- Single product: set `COLLECTOR_PRODUCT=<product>` to run one brand only.
- Explicit keywords: set `COLLECTOR_KEYWORDS` to override product scoping.

 Examples:
- All products, default per‑brand: `COLLECTOR_MAX_ITEMS=100 npm run start:collector`
- Single product: `COLLECTOR_PRODUCT=windsurf COLLECTOR_MAX_ITEMS=100 npm run start:collector`
- Explicit keywords: `COLLECTOR_KEYWORDS="ampcode,ampcode.com" npm run start:collector`

—

## 4) Validation
- Apply migration and seeds: `npm run apply-migrations` (then re‑seed via Supabase SQL editor if needed).
- Confirm views:
  - `select * from vw_product_daily_sentiment limit 20;`
  - `select * from vw_product_trends limit 20;`
- Sanity for existing flow:
  - Collector still resolves keywords: DB → [StartApifyRunEndpoint.ts](../../src/ApifyPipeline/Web/Application/Commands/StartApifyRun/StartApifyRunEndpoint.ts) env override fallback.
  - Sentiment creation unchanged and should populate product views via join.

—

## Rollback (Easy)
- Drop views, index, and column (schema only; no tweet data touched):
```sql
begin;

-- If you want to stop using product rollups only
drop view if exists public.vw_product_daily_sentiment;
drop view if exists public.vw_product_trends;

-- If you want to remove the index
drop index if exists public.idx_keywords_enabled_product_priority;

-- If you want to remove the column (and its default)
alter table if exists public.keywords drop column if exists product;

commit;
```
- Optional: fully revert competitor tracking (data toggles):
```sql
-- Disable competitor keywords first (before dropping the column)
update public.keywords
set is_enabled = false
where product in ('windsurf','augment','cline','kilo','opencode');

-- Or permanently remove competitor keywords (rare; prefer disable)
delete from public.keywords
where product in ('windsurf','augment','cline','kilo','opencode');
```
Notes:
- Rolling back views keeps all tweet data intact; aggregates revert to existing non‑product views.
- Disabling or deleting competitor keyword rows stops future collection immediately; the collector reads enabled keywords at runtime.

—

## Key References (with line ranges)
- Migrations
  - `src/ApifyPipeline/DataAccess/Migrations/20250929_1200_InitApifyPipeline.sql`
    - keywords table: L168–176
    - keyword index: L184
    - views (daily, keyword trends): L231–276
- Keyword selection
  - `src/ApifyPipeline/DataAccess/Repositories/KeywordsRepository.ts`
    - enabled keyword query: L15–19
- Collector execution
  - `scripts/start-apify-run.ts`
    - resolve keywords (per product): see `resolveKeywords()`
    - run scraper + await completion: `startTweetScraper()` / `waitForRunCompletion()`
    - dataset read: `fetchDatasetItems()`
    - persist + trigger sentiment: normalized/cron repositories + `invokeSentimentProcessorFunction()`
- Normalization (keyword capture)
  - `src/ApifyPipeline/Core/Transformations/normalizeTweet.ts`
    - collectKeywords: L168–201
    - normalized return (keyword_snapshot): L220–241
- Sentiment processing
  - `src/ApifyPipeline/DataAccess/Repositories/TweetSentimentsRepository.ts`
    - insert sentiment: L26–38
    - get pending: L69–86
    - update status: L89–100
  - Edge function
    - `src/ApifyPipeline/ExternalServices/Gemini/EdgeFunctions/sentimentProcessor/web/ProcessSentimentsEndpoint.ts`: L21–47
    - `.../infrastructure/supabaseTweetRepository.ts` fetch/update: L26–41, L74–86
- Start endpoint (pass‑through + keyword resolution)
  - `src/ApifyPipeline/Web/Application/Commands/StartApifyRun/StartApifyRunEndpoint.ts`
    - resolve keywords: L113–121
    - tweet‑scraper passthrough: L164–168
    - scraper payload synthesis: L170–197

—

## Extensibility
- To add a new product later: insert keywords with `product` value, enable them, adjust `priority` as needed; product views auto‑reflect without code changes.
- If balanced sampling is required: schedule per‑product runs with per‑run `maxItems`.```}
