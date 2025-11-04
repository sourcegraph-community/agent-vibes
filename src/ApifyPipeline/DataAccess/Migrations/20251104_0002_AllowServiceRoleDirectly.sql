-- Migration: Add policy specifically for service_role
-- Date: 2024-11-04
-- Reason: The authenticated policy doesn't apply to service_role

BEGIN;

-- Drop existing policies and create a simpler one for public (all roles)
DROP POLICY IF EXISTS allow_authenticated_reads ON public.normalized_tweets;
DROP POLICY IF EXISTS normalized_tweets_dashboard_read ON public.normalized_tweets;

-- Allow ALL roles to read (public = anon + authenticated + service_role)
CREATE POLICY allow_all_reads
  ON public.normalized_tweets
  FOR SELECT
  USING (true);

-- Same for tweet_sentiments
DROP POLICY IF EXISTS allow_authenticated_reads ON public.tweet_sentiments;
DROP POLICY IF EXISTS tweet_sentiments_dashboard_read ON public.tweet_sentiments;

CREATE POLICY allow_all_reads
  ON public.tweet_sentiments
  FOR SELECT
  USING (true);

COMMIT;
