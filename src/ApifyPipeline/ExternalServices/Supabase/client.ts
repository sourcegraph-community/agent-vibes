/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseEnv } from '@/src/ApifyPipeline/Infrastructure/Config/env';

export type SupabaseServiceClient = SupabaseClient<any>;

export const createSupabaseServiceClient = (
  env: NodeJS.ProcessEnv = process.env,
): SupabaseServiceClient => {
  const { supabaseServiceRoleKey, supabaseUrl } = getSupabaseEnv(env);

  return createClient<any>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'apify-pipeline-ingestion',
      },
    },
  });
};
