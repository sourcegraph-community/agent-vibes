-- Create rss_summaries table for generated AI summaries of RSS entries
CREATE TABLE IF NOT EXISTS public.rss_summaries (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES public.rss_entries(id) ON DELETE CASCADE,
  model_version TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  key_points TEXT[] NOT NULL DEFAULT '{}',
  sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative')),
  topics TEXT[] NOT NULL DEFAULT '{}',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_rss_summaries_entry_id ON public.rss_summaries(entry_id);
CREATE INDEX IF NOT EXISTS idx_rss_summaries_processed_at ON public.rss_summaries(processed_at);
