begin;

insert into public.keywords (keyword, is_enabled, priority, source, note)
values
  ('ampcode.com', true, 10, 'marketing', 'Direct domain mentions'),
  ('"ampcode"', true, 20, 'marketing', 'Exact product name matches'),
  ('"sourcegraph amp"', true, 30, 'marketing', 'Full product references'),
  ('(to:ampcode)', true, 40, 'marketing', 'Direct mentions and replies')
on conflict (keyword) do nothing;

-- Demo tweet seed data is intentionally omitted to keep local datasets empty by default.

commit;
