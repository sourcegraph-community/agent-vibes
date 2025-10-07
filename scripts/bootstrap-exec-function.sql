-- Create exec function for running raw SQL via RPC
-- Run this manually via Supabase SQL Editor first

CREATE OR REPLACE FUNCTION public.exec(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.exec(text) TO service_role;
