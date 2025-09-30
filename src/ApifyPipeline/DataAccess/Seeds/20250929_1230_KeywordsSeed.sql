begin;

insert into public.keywords (keyword, is_enabled, priority, source, note)
values
  ('agentic ai', true, 10, 'analytics', 'Core campaign keyword'),
  ('prompt engineering', true, 20, 'analytics', 'High-signal technique discussions'),
  ('autonomous agents', true, 30, 'analytics', 'Track broader agent discourse'),
  ('workflow automation', false, 40, 'analytics', 'Secondary focus – keep disabled until Q4'),
  ('multi-agent systems', true, 30, 'analytics', 'Monitor academic/research mentions')
on conflict (keyword) do update set
  is_enabled = excluded.is_enabled,
  priority = excluded.priority,
  source = excluded.source,
  note = excluded.note,
  last_used_at = case when excluded.is_enabled then now() else public.keywords.last_used_at end;

-- Seed demo run and normalized tweets to hydrate analytic views if empty.
-- Note: Fixed UUIDs (11111111-..., 22222222-..., etc.) are used intentionally for:
--   1. Deterministic testing - same IDs across environments for test validation
--   2. Idempotent re-seeding - 'on conflict do nothing' prevents duplicate errors
--   3. Foreign key references - normalized_tweets and sentiments reference these stable IDs
-- This is safe because seed data is demo/test content only, never production data.
with seed_run as (
  insert into public.cron_runs (
    id,
    trigger_source,
    keyword_batch,
    started_at,
    finished_at,
    status,
    processed_new_count,
    processed_duplicate_count,
    processed_error_count,
    metadata,
    errors,
    created_at
  ) values (
    '11111111-1111-4111-8111-111111111111',
    'seed-demo',
    array['agentic ai', 'prompt engineering'],
    now() - interval '1 day',
    now() - interval '1 day' + interval '12 minutes',
    'succeeded',
    48,
    6,
    0,
    jsonb_build_object('runType', 'demo'),
    '[]'::jsonb,
    now() - interval '1 day'
  ) on conflict (id) do nothing
  returning id
), run_id as (
  select coalesce((select id from seed_run), '11111111-1111-4111-8111-111111111111'::uuid) as id
)
insert into public.normalized_tweets (
  id,
  raw_tweet_id,
  run_id,
  platform,
  platform_id,
  revision,
  author_handle,
  author_name,
  posted_at,
  collected_at,
  language,
  content,
  url,
  engagement_likes,
  engagement_retweets,
  keyword_snapshot,
  status,
  status_changed_at,
  model_context,
  ingested_at,
  created_at
)
select
  s.normalized_id,
  s.raw_id,
  r.id,
  s.platform,
  s.platform_id,
  s.revision,
  s.author_handle,
  s.author_name,
  s.posted_at,
  s.collected_at,
  s.language,
  s.content,
  s.url,
  s.engagement_likes,
  s.engagement_retweets,
  s.keyword_snapshot,
  s.status,
  s.status_changed_at,
  s.model_context,
  s.ingested_at,
  s.created_at
from run_id r
cross join lateral (
  values
    (
      '22222222-2222-4222-9222-222222222222'::uuid,
      '32222222-2222-4222-9222-222222222222'::uuid,
      'twitter',
      '1876543210',
      1,
      'c0dingwizard',
      'Coding Wizard',
      now() - interval '26 hours',
      now() - interval '25 hours',
      'en',
      'Exploring agentic AI workflows to boost developer productivity. #AgenticAI',
      'https://twitter.com/c0dingwizard/status/1876543210',
      128,
      34,
      array['agentic ai', 'workflow automation'],
      'processed',
      now() - interval '25 hours',
      jsonb_build_object('collector', 'apify-demo'),
      now() - interval '25 hours',
      now() - interval '25 hours'
    ),
    (
      '33333333-3333-4333-9333-333333333333'::uuid,
      '43333333-3333-4333-9333-333333333333'::uuid,
      'twitter',
      '1876543999',
      1,
      'mlops_daily',
      'MLOps Daily',
      now() - interval '20 hours',
      now() - interval '19 hours',
      'en',
      'Prompt engineering is evolving into fully autonomous agent pipelines. Fascinating times!',
      'https://twitter.com/mlops_daily/status/1876543999',
      89,
      22,
      array['prompt engineering', 'agentic ai'],
      'processed',
      now() - interval '19 hours',
      jsonb_build_object('collector', 'apify-demo'),
      now() - interval '19 hours',
      now() - interval '19 hours'
    )
) as s(normalized_id, raw_id, platform, platform_id, revision, author_handle, author_name, posted_at, collected_at, language, content, url, engagement_likes, engagement_retweets, keyword_snapshot, status, status_changed_at, model_context, ingested_at, created_at)
on conflict (platform, platform_id, revision) do nothing;

insert into public.tweet_sentiments (
  id,
  normalized_tweet_id,
  model_version,
  sentiment_label,
  sentiment_score,
  reasoning,
  processed_at,
  latency_ms,
  created_at
) values
  (
    '44444444-4444-4444-9444-444444444444',
    '22222222-2222-4222-9222-222222222222',
    'gemini-2.5-flash:2025-09-15',
    'positive',
    0.71,
    jsonb_build_object('summary', 'Highlights automation gains for developers'),
    now() - interval '25 hours',
    812,
    now() - interval '25 hours'
  ),
  (
    '55555555-5555-4555-9555-555555555555',
    '33333333-3333-4333-9333-333333333333',
    'gemini-2.5-flash:2025-09-15',
    'positive',
    0.64,
    jsonb_build_object('summary', 'Describes momentum for autonomous agents in production'),
    now() - interval '19 hours',
    734,
    now() - interval '19 hours'
  )
on conflict (normalized_tweet_id, model_version) do nothing;

commit;
