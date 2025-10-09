begin;

-- Make miniflux_id nullable since we use entry_id as the primary key
alter table public.rss_entries
alter column miniflux_id drop not null;

commit;
