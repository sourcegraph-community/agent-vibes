begin;

-- Add missing columns to match the code expectations
alter table public.rss_entries
add column if not exists entry_id text,
add column if not exists feed_id text,
add column if not exists feed_title text;

-- Drop the old unique constraint first, then drop the index
alter table public.rss_entries drop constraint if exists rss_entries_miniflux_id_key;
drop index if exists rss_entries_miniflux_id_key;

-- Create new unique index on entry_id
create unique index if not exists idx_rss_entries_entry_id on public.rss_entries(entry_id);

-- Add index on feed_id
create index if not exists idx_rss_entries_feed_id on public.rss_entries(feed_id);

commit;
