import { createClient } from 'npm:@supabase/supabase-js';

export const createSupabaseClient = (url: string, serviceRoleKey: string) => {
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
};
