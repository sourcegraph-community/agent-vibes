-- Migration: Allow service role and authenticated users to read dashboard data
-- Date: 2024-11-04
-- Reason: API routes using service role key need to bypass the dashboard_role() check

BEGIN;

-- Allow authenticated users (including service role) to read normalized_tweets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'normalized_tweets'
      AND policyname = 'allow_authenticated_reads'
  ) THEN
    CREATE POLICY allow_authenticated_reads
      ON public.normalized_tweets
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;

-- Allow authenticated users to read tweet_sentiments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tweet_sentiments'
      AND policyname = 'allow_authenticated_reads'
  ) THEN
    CREATE POLICY allow_authenticated_reads
      ON public.tweet_sentiments
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;

COMMIT;
