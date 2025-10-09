begin;

-- Add status column for tracking summary generation
alter table public.rss_entries
add column if not exists status text default 'pending_summary' check (status in ('pending_summary', 'processing_summary', 'completed', 'failed')),
add column if not exists status_changed_at timestamptz default now(),
add column if not exists summary_attempts integer default 0,
add column if not exists ai_summary text;

-- Add index on status for efficient querying
create index if not exists idx_rss_entries_status on public.rss_entries(status) where status in ('pending_summary', 'processing_summary');

commit;
