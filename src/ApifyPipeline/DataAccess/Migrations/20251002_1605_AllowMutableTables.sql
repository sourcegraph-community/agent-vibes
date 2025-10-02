begin;

-- Option A: Make tables mutable except raw_tweets and cron_runs
-- - Drop append-only triggers from normalized_tweets, tweet_sentiments, sentiment_failures, keywords
-- - Add updated_at column and BEFORE UPDATE triggers to maintain it

-- 1) Drop append-only triggers on target tables (idempotent)
drop trigger if exists normalized_tweets_prevent_mutation on public.normalized_tweets;
drop trigger if exists tweet_sentiments_prevent_mutation on public.tweet_sentiments;
drop trigger if exists sentiment_failures_prevent_mutation on public.sentiment_failures;
drop trigger if exists keywords_prevent_mutation on public.keywords;

-- Keep raw_tweets and cron_runs append-only triggers intact

-- 2) Ensure updated_at column exists on mutable tables
alter table if exists public.normalized_tweets add column if not exists updated_at timestamptz;
alter table if exists public.tweet_sentiments add column if not exists updated_at timestamptz;
alter table if exists public.sentiment_failures add column if not exists updated_at timestamptz;
alter table if exists public.keywords add column if not exists updated_at timestamptz;
-- backfill_batches already defines updated_at; keep as-is

-- 3) Create helper function to set updated_at (idempotent)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 4) Attach BEFORE UPDATE triggers to maintain updated_at
-- First drop any existing triggers to avoid duplicates
-- normalized_tweets
drop trigger if exists normalized_tweets_set_updated_at on public.normalized_tweets;
create trigger normalized_tweets_set_updated_at
  before update on public.normalized_tweets
  for each row execute function public.set_updated_at();

-- tweet_sentiments
drop trigger if exists tweet_sentiments_set_updated_at on public.tweet_sentiments;
create trigger tweet_sentiments_set_updated_at
  before update on public.tweet_sentiments
  for each row execute function public.set_updated_at();

-- sentiment_failures
drop trigger if exists sentiment_failures_set_updated_at on public.sentiment_failures;
create trigger sentiment_failures_set_updated_at
  before update on public.sentiment_failures
  for each row execute function public.set_updated_at();

-- keywords
drop trigger if exists keywords_set_updated_at on public.keywords;
create trigger keywords_set_updated_at
  before update on public.keywords
  for each row execute function public.set_updated_at();

commit;
