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
