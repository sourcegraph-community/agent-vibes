begin;

-- Create index on collected_at for efficient date-based queries
create index if not exists idx_normalized_tweets_collected_at 
  on normalized_tweets(collected_at desc);

comment on index idx_normalized_tweets_collected_at is 
  'Optimizes queries for finding the most recent collected tweet';

commit;
