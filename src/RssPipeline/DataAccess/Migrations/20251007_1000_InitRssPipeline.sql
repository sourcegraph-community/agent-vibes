begin;

-- Updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- RSS entries table
create table if not exists public.rss_entries (
  id bigserial primary key,
  miniflux_id integer unique not null,
  title text not null,
  url text not null,
  content text,
  summary text,
  ai_summary text,
  author text,
  source text,
  category text,
  published_at timestamptz not null,
  starred boolean default false,
  reading_time integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for queries
create index if not exists idx_rss_entries_category on public.rss_entries(category);
create index if not exists idx_rss_entries_published on public.rss_entries(published_at desc);
create index if not exists idx_rss_entries_starred on public.rss_entries(starred) where starred = true;

-- Updated_at trigger
drop trigger if exists rss_entries_set_updated_at on public.rss_entries;
create trigger rss_entries_set_updated_at
  before update on public.rss_entries
  for each row execute function public.set_updated_at();

commit;
