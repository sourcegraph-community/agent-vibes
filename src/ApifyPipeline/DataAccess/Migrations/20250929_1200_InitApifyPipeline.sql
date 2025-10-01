begin;

create schema if not exists public;

create extension if not exists "pgcrypto" schema public;
create extension if not exists "uuid-ossp" schema public;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'normalized_tweet_status'
  ) then
    create type public.normalized_tweet_status as enum ('pending_sentiment', 'processed', 'failed');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'cron_run_status'
  ) then
    create type public.cron_run_status as enum ('queued', 'running', 'succeeded', 'partial_success', 'failed');
  end if;
end;
$$;

create or replace function public.enforce_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Append-only table "%": % operations are not permitted', TG_TABLE_NAME, TG_OP;
end;
$$;

create or replace function public.set_ingestion_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.ingested_at is null then
    new.ingested_at := now();
  end if;
  if new.created_at is null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.set_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status_changed_at is null then
    new.status_changed_at := now();
  end if;
  if new.ingested_at is null then
    new.ingested_at := now();
  end if;
  if new.created_at is null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.set_processed_at()
returns trigger
language plpgsql
as $$
begin
  if new.processed_at is null then
    new.processed_at := now();
  end if;
  if new.created_at is null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null,
  keyword_batch text[] not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.cron_run_status not null,
  processed_new_count integer not null default 0 check (processed_new_count >= 0),
  processed_duplicate_count integer not null default 0 check (processed_duplicate_count >= 0),
  processed_error_count integer not null default 0 check (processed_error_count >= 0),
  metadata jsonb not null default '{}',
  errors jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.raw_tweets (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.cron_runs(id) on delete restrict,
  platform text not null default 'twitter',
  platform_id text not null,
  collected_at timestamptz not null,
  payload jsonb not null,
  ingestion_reason text not null default 'initial',
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint raw_tweets_unique_per_run unique (run_id, platform, platform_id)
);

create table if not exists public.normalized_tweets (
  id uuid primary key default gen_random_uuid(),
  raw_tweet_id uuid references public.raw_tweets(id) on delete restrict,
  run_id uuid references public.cron_runs(id) on delete restrict,
  platform text not null default 'twitter',
  platform_id text not null,
  revision smallint not null default 1 check (revision > 0),
  author_handle text,
  author_name text,
  posted_at timestamptz not null,
  collected_at timestamptz not null,
  language text,
  content text not null,
  url text,
  engagement_likes integer check (engagement_likes >= 0),
  engagement_retweets integer check (engagement_retweets >= 0),
  keyword_snapshot text[] not null default '{}',
  status public.normalized_tweet_status not null default 'pending_sentiment',
  status_changed_at timestamptz not null default now(),
  model_context jsonb not null default '{}',
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint normalized_tweets_unique_version unique (platform, platform_id, revision)
);

create table if not exists public.tweet_sentiments (
  id uuid primary key default gen_random_uuid(),
  normalized_tweet_id uuid not null references public.normalized_tweets(id) on delete restrict,
  model_version text not null,
  sentiment_label text not null check (sentiment_label in ('positive', 'neutral', 'negative')),
  sentiment_score numeric(4,3) check (sentiment_score between -1 and 1),
  reasoning jsonb,
  processed_at timestamptz not null default now(),
  latency_ms integer check (latency_ms >= 0),
  created_at timestamptz not null default now(),
  constraint tweet_sentiments_unique_model unique (normalized_tweet_id, model_version)
);

create table if not exists public.sentiment_failures (
  id uuid primary key default gen_random_uuid(),
  normalized_tweet_id uuid references public.normalized_tweets(id) on delete restrict,
  model_version text,
  failure_stage text not null,
  error_code text,
  error_message text not null,
  retry_count integer not null default 0 check (retry_count >= 0),
  last_attempt_at timestamptz not null default now(),
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.keywords (
  keyword text primary key,
  is_enabled boolean not null default true,
  priority smallint not null default 100,
  source text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  note text
);

create index if not exists idx_cron_runs_started_at on public.cron_runs (started_at desc);
create index if not exists idx_raw_tweets_run_platform on public.raw_tweets (run_id, platform);
create index if not exists idx_normalized_tweets_platform_id on public.normalized_tweets (platform, platform_id, revision desc);
create index if not exists idx_normalized_tweets_posted_at on public.normalized_tweets (posted_at desc);
create index if not exists idx_tweet_sentiments_normalized on public.tweet_sentiments (normalized_tweet_id, processed_at desc);
create index if not exists idx_sentiment_failures_normalized on public.sentiment_failures (normalized_tweet_id, last_attempt_at desc);
create index if not exists idx_keywords_enabled_priority on public.keywords (is_enabled, priority);

drop trigger if exists raw_tweets_set_timestamps on public.raw_tweets;
create trigger raw_tweets_set_timestamps
  before insert on public.raw_tweets
  for each row execute function public.set_ingestion_timestamps();

drop trigger if exists normalized_tweets_set_status_changed_at on public.normalized_tweets;
create trigger normalized_tweets_set_status_changed_at
  before insert on public.normalized_tweets
  for each row execute function public.set_status_changed_at();

drop trigger if exists tweet_sentiments_set_processed_at on public.tweet_sentiments;
create trigger tweet_sentiments_set_processed_at
  before insert on public.tweet_sentiments
  for each row execute function public.set_processed_at();

drop trigger if exists cron_runs_prevent_mutation on public.cron_runs;
create trigger cron_runs_prevent_mutation
  before update or delete on public.cron_runs
  for each row execute function public.enforce_append_only();

drop trigger if exists raw_tweets_prevent_mutation on public.raw_tweets;
create trigger raw_tweets_prevent_mutation
  before update or delete on public.raw_tweets
  for each row execute function public.enforce_append_only();

drop trigger if exists normalized_tweets_prevent_mutation on public.normalized_tweets;
create trigger normalized_tweets_prevent_mutation
  before update or delete on public.normalized_tweets
  for each row execute function public.enforce_append_only();

drop trigger if exists tweet_sentiments_prevent_mutation on public.tweet_sentiments;
create trigger tweet_sentiments_prevent_mutation
  before update or delete on public.tweet_sentiments
  for each row execute function public.enforce_append_only();

drop trigger if exists sentiment_failures_prevent_mutation on public.sentiment_failures;
create trigger sentiment_failures_prevent_mutation
  before update or delete on public.sentiment_failures
  for each row execute function public.enforce_append_only();

drop trigger if exists keywords_prevent_mutation on public.keywords;
create trigger keywords_prevent_mutation
  before update or delete on public.keywords
  for each row execute function public.enforce_append_only();

create or replace view public.vw_daily_sentiment as
with sentiment_data as (
  select
    nt.id as normalized_tweet_id,
    date_trunc('day', nt.posted_at) as sentiment_day,
    coalesce(nullif(nt.language, ''), 'unknown') as language,
    ts.sentiment_label,
    ts.sentiment_score
  from public.normalized_tweets nt
  left join public.tweet_sentiments ts on ts.normalized_tweet_id = nt.id
)
select
  sentiment_day,
  language,
  count(*) filter (where sentiment_label = 'positive') as positive_count,
  count(*) filter (where sentiment_label = 'neutral') as neutral_count,
  count(*) filter (where sentiment_label = 'negative') as negative_count,
  count(*) as total_count,
  avg(sentiment_score) as avg_sentiment_score
from sentiment_data
where sentiment_day is not null
group by sentiment_day, language
order by sentiment_day desc, language;

create or replace view public.vw_keyword_trends as
with keyword_rows as (
  select
    nt.id as normalized_tweet_id,
    date_trunc('day', nt.posted_at) as sentiment_day,
    lower(trim(keyword)) as keyword,
    ts.sentiment_label,
    ts.sentiment_score
  from public.normalized_tweets nt
  left join public.tweet_sentiments ts on ts.normalized_tweet_id = nt.id
  cross join lateral unnest(nt.keyword_snapshot) as keyword
)
select
  sentiment_day,
  keyword,
  count(*) as mention_count,
  count(*) filter (where sentiment_label = 'negative') as negative_count,
  avg(sentiment_score) as avg_sentiment_score
from keyword_rows
where sentiment_day is not null and keyword is not null
group by sentiment_day, keyword
order by sentiment_day desc, keyword;

alter table public.normalized_tweets enable row level security;
alter table public.tweet_sentiments enable row level security;

create or replace function public.dashboard_role()
returns text
language plpgsql
stable
as $$
declare
  claims jsonb;
begin
  begin
    claims := current_setting('request.jwt.claims', true)::jsonb;
  exception when others then
    claims := '{}'::jsonb;
  end;
  return coalesce(claims ->> 'app_role', '');
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'normalized_tweets'
      and policyname = 'normalized_tweets_dashboard_read'
  ) then
    create policy normalized_tweets_dashboard_read
      on public.normalized_tweets
      for select
      using (public.dashboard_role() = 'dashboard');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tweet_sentiments'
      and policyname = 'tweet_sentiments_dashboard_read'
  ) then
    create policy tweet_sentiments_dashboard_read
      on public.tweet_sentiments
      for select
      using (public.dashboard_role() = 'dashboard');
  end if;
end;
$$;

commit;
