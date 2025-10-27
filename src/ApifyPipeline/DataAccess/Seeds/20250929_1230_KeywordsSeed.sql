begin;

insert into public.keywords (keyword, is_enabled, priority, source, note, product)
values
  ('ampcode.com', true, 10, 'marketing', 'Direct domain mentions', 'amp'),
  ('ampcode', true, 20, 'marketing', 'Exact product name matches', 'amp'),
  ('"sourcegraph amp"', true, 30, 'marketing', 'Full product references', 'amp'),
  ('(to:ampcode)', true, 40, 'marketing', 'Direct mentions and replies', 'amp')
on conflict (keyword) do nothing;

-- Windsurf
insert into public.keywords (keyword, is_enabled, priority, source, note, product)
values
  ('windsurf', true, 10, 'analytics', 'brand', 'windsurf'),
  ('(to:windsurf)', true, 20, 'analytics', 'replies', 'windsurf'),
  ('windsurf.com', true, 30, 'analytics', 'domain', 'windsurf')
on conflict (keyword) do nothing;

-- Augment
insert into public.keywords (keyword, is_enabled, priority, source, note, product)
values
  ('augmentcode', true, 10, 'analytics', 'brand', 'augment'),
  ('augmentcode.com', true, 20, 'analytics', 'domain', 'augment'),
  ('(to:augmentcode)', true, 30, 'analytics', 'replies', 'augment')
on conflict (keyword) do nothing;

-- Cline
insert into public.keywords (keyword, is_enabled, priority, source, note, product)
values
  ('cline', true, 10, 'analytics', 'brand', 'cline'),
  ('cline.bot', true, 20, 'analytics', 'domain', 'cline'),
  ('(to:cline)', true, 30, 'analytics', 'replies', 'cline')
on conflict (keyword) do nothing;

-- Kilo
insert into public.keywords (keyword, is_enabled, priority, source, note, product)
values
  ('kilocode', true, 10, 'analytics', 'brand', 'kilo'),
  ('kilocode.ai', true, 20, 'analytics', 'domain', 'kilo'),
  ('(to:kilocode)', true, 30, 'analytics', 'replies', 'kilo')
on conflict (keyword) do nothing;

-- OpenCode
insert into public.keywords (keyword, is_enabled, priority, source, note, product)
values
  ('opencode', true, 10, 'analytics', 'brand', 'opencode'),
  ('opencode.ai', true, 20, 'analytics', 'domain', 'opencode'),
  ('(to:opencode)', true, 30, 'analytics', 'replies', 'opencode')
on conflict (keyword) do nothing;

-- Demo tweet seed data is intentionally omitted to keep local datasets empty by default.

commit;
