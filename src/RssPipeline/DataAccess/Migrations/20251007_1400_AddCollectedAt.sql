begin;

-- Add missing collected_at column
alter table public.rss_entries
add column if not exists collected_at timestamptz default now();

commit;
