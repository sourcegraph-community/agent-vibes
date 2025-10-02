begin;

-- 1) Temporarily drop append-only trigger on raw_tweets to allow deletion
drop trigger if exists raw_tweets_prevent_mutation on public.raw_tweets;

-- 2) Relax FK on normalized_tweets.raw_tweet_id to ON DELETE SET NULL (idempotent)
alter table if exists public.normalized_tweets
  drop constraint if exists normalized_tweets_raw_tweet_id_fkey;

alter table if exists public.normalized_tweets
  add constraint normalized_tweets_raw_tweet_id_fkey
  foreign key (raw_tweet_id)
  references public.raw_tweets(id)
  on delete set null;

-- 3) Delete all rows from raw_tweets (not TRUNCATE to avoid cascading)
delete from public.raw_tweets;

-- 4) Re-create append-only trigger on raw_tweets
create trigger raw_tweets_prevent_mutation
  before update or delete on public.raw_tweets
  for each row execute function public.enforce_append_only();

commit;
