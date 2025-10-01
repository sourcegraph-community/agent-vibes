-- Add backfill_batches table for managing historical data collection

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'backfill_batch_status'
  ) then
    create type public.backfill_batch_status as enum ('pending', 'running', 'completed', 'failed');
  end if;
end;
$$;

create table if not exists public.backfill_batches (
  id uuid primary key default gen_random_uuid(),
  keywords text[] not null default '{}',
  start_date timestamptz not null,
  end_date timestamptz not null,
  priority smallint not null default 100,
  status public.backfill_batch_status not null default 'pending',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date)
);

create index if not exists idx_backfill_batches_status on public.backfill_batches(status);
create index if not exists idx_backfill_batches_priority on public.backfill_batches(priority desc);
create index if not exists idx_backfill_batches_created_at on public.backfill_batches(created_at);

comment on table public.backfill_batches is 'Queue for historical tweet collection batches respecting Apify rate limits';
comment on column public.backfill_batches.priority is 'Higher values processed first';
comment on column public.backfill_batches.metadata is 'Contains apifyRunId, errorMessage, completedAt, etc.';
